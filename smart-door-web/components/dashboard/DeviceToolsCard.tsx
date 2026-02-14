'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Plus, X, CreditCard, Loader2,
  Upload, FileUp, CheckCircle, XCircle, AlertTriangle,
  Power, RotateCcw, Wrench, Copy, WifiOff, Clock,
} from 'lucide-react';
import { DoorStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

type ActivePanel = null | 'add-card' | 'ota' | 'restart' | 'clone' | 'rfid-toggle' | 'schedule-restart';
type OtaState = 'idle' | 'selected' | 'uploading' | 'flashing' | 'success' | 'error';
type RestartState = 'idle' | 'confirming' | 'restarting' | 'success';
type CloneUiState = 'idle' | 'wait-source' | 'wait-target' | 'success' | 'failed' | 'timeout';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface DeviceToolsCardProps {
  status: DoorStatus | null;
}

export function DeviceToolsCard({ status }: DeviceToolsCardProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // --- Add Card state ---
  const [isToggling, setIsToggling] = useState(false);
  const isRegistrationMode = status?.state === 'REGISTRATION_MODE';

  // --- OTA state ---
  const [otaState, setOtaState] = useState<OtaState>('idle');
  const [otaFile, setOtaFile] = useState<File | null>(null);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaError, setOtaError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // --- Restart state ---
  const [restartState, setRestartState] = useState<RestartState>('idle');

  // --- Clone state ---
  const [cloneState, setCloneState] = useState<CloneUiState>('idle');
  const [cloneSourceUID, setCloneSourceUID] = useState('');
  const [cloneCountdown, setCloneCountdown] = useState(30);
  const clonePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloneStartRef = useRef<number>(0);

  // --- RFID Toggle state ---
  const [rfidDisabled, setRfidDisabled] = useState(status?.rfidDisabled ?? false);
  const [isTogglingRfid, setIsTogglingRfid] = useState(false);

  // --- Schedule Restart state ---
  const [schedMode, setSchedMode] = useState(0); // 0=off, 1=at_hour, 2=every_hours
  const [schedHour, setSchedHour] = useState(3);
  const [schedInterval, setSchedInterval] = useState(6);
  const [isSavingSched, setIsSavingSched] = useState(false);
  const [schedLoaded, setSchedLoaded] = useState(false);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  // Sync rfidDisabled from status
  useEffect(() => {
    if (status?.rfidDisabled !== undefined) {
      setRfidDisabled(status.rfidDisabled);
    }
  }, [status?.rfidDisabled]);

  // Load schedule restart config when panel opens
  useEffect(() => {
    if (activePanel === 'schedule-restart' && !schedLoaded) {
      (async () => {
        try {
          const config = await api.getScheduledRestart();
          setSchedMode(config.mode);
          setSchedHour(config.hour || 3);
          setSchedInterval(config.interval || 6);
          setSchedLoaded(true);
        } catch {
          // ESP32 offline
        }
      })();
    }
  }, [activePanel, schedLoaded]);

  // ── Add Card handlers ──
  const handleToggleRegistration = async () => {
    setIsToggling(true);
    try {
      const result = await api.toggleRegistrationMode();
      if (result.success) {
        toast.success(result.message || (isRegistrationMode ? 'Exited registration mode' : 'Entered registration mode'));
      } else {
        toast.error(result.message || 'Failed to toggle registration mode');
      }
    } catch {
      toast.error('Failed to communicate with device');
    } finally {
      setIsToggling(false);
    }
  };

  // ── OTA handlers ──
  const otaReset = useCallback(() => {
    setOtaState('idle');
    setOtaFile(null);
    setOtaProgress(0);
    setOtaError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (xhrRef.current) { xhrRef.current.abort(); xhrRef.current = null; }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith('.bin')) { setOtaError('Only .bin firmware files are allowed'); setOtaState('error'); return; }
    if (selected.size > MAX_FILE_SIZE) { setOtaError(`File too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Max 2MB.`); setOtaState('error'); return; }
    if (selected.size < 100 * 1024) { setOtaError('File too small to be a valid firmware'); setOtaState('error'); return; }
    setOtaFile(selected);
    setOtaError('');
    setOtaState('selected');
  }, []);

  const handleOtaUpload = useCallback(() => {
    if (!otaFile) return;
    setOtaState('uploading');
    setOtaProgress(0);
    const formData = new FormData();
    formData.append('firmware', otaFile);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setOtaProgress(pct);
        if (pct >= 100) setOtaState('flashing');
      }
    });
    xhr.addEventListener('load', () => {
      xhrRef.current = null;
      if (xhr.status === 200) {
        let isSuccess = false;
        try { const resp = JSON.parse(xhr.responseText); isSuccess = resp.success === true; } catch { isSuccess = xhr.responseText.trim() === 'OK'; }
        if (isSuccess) {
          setOtaState('success');
          toast.success('Firmware updated! ESP32 restarting...');
          setTimeout(() => window.location.reload(), 5000);
        } else {
          setOtaError(xhr.responseText || 'Upload failed');
          setOtaState('error');
          toast.error('OTA update failed');
        }
      } else {
        setOtaError(xhr.responseText || 'Upload failed');
        setOtaState('error');
        toast.error('OTA update failed');
      }
    });
    xhr.addEventListener('error', () => { xhrRef.current = null; setOtaError('Connection lost.'); setOtaState('error'); toast.error('Failed to connect to ESP32'); });
    xhr.addEventListener('timeout', () => { xhrRef.current = null; setOtaError('Upload timed out.'); setOtaState('error'); });
    xhr.timeout = 60000;
    const baseUrl = getApiBaseUrl();
    xhr.open('POST', `${baseUrl}/do-update`);
    xhr.send(formData);
  }, [otaFile]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // ── Restart handlers ──
  const handleRestart = async () => {
    if (restartState === 'idle') { setRestartState('confirming'); return; }
    if (restartState === 'confirming') {
      setRestartState('restarting');
      try {
        await api.restartEsp();
        setRestartState('success');
        toast.success('ESP32 is restarting...');
        setTimeout(() => { setRestartState('idle'); }, 12000);
      } catch {
        toast.error('Failed to restart ESP32');
        setRestartState('idle');
      }
    }
  };

  // ── RFID Toggle handlers ──
  const handleToggleRfid = async () => {
    setIsTogglingRfid(true);
    try {
      const result = await api.toggleRfid();
      if (result.success) {
        setRfidDisabled(result.rfidDisabled);
        toast.success(result.message);
      } else {
        toast.error('Failed to toggle RFID');
      }
    } catch {
      toast.error('Failed to communicate with device');
    } finally {
      setIsTogglingRfid(false);
    }
  };

  // ── Schedule Restart handlers ──
  const handleSaveScheduleRestart = async () => {
    setIsSavingSched(true);
    try {
      const result = await api.setScheduledRestart({
        mode: schedMode,
        hour: schedHour,
        interval: schedInterval,
      });
      if (result.success) {
        toast.success(
          schedMode === 0
            ? 'Scheduled restart disabled'
            : schedMode === 1
            ? `Restart scheduled at ${schedHour}:00 daily`
            : `Restart every ${schedInterval} hours`
        );
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setIsSavingSched(false);
    }
  };

  // ── Clone handlers ──
  const stopClonePoll = useCallback(() => {
    if (clonePollRef.current) {
      clearInterval(clonePollRef.current);
      clonePollRef.current = null;
    }
  }, []);

  const resetClone = useCallback(() => {
    stopClonePoll();
    setCloneState('idle');
    setCloneSourceUID('');
    setCloneCountdown(30);
  }, [stopClonePoll]);

  const pollCloneStatus = useCallback(async () => {
    try {
      const d = await api.getCloneStatus();

      if (d.cloneResult === 'success') {
        setCloneState('success');
        if (d.sourceUID) setCloneSourceUID(d.sourceUID);
        stopClonePoll();
        setTimeout(resetClone, 4000);
        return;
      }
      if (d.cloneResult === 'failed') {
        setCloneState('failed');
        stopClonePoll();
        setTimeout(resetClone, 4000);
        return;
      }
      if (d.cloneResult === 'timeout') {
        setCloneState('timeout');
        stopClonePoll();
        setTimeout(resetClone, 4000);
        return;
      }
      if (d.state !== 'CLONE_MODE') {
        resetClone();
        return;
      }

      // Update countdown
      const elapsed = Math.floor((Date.now() - cloneStartRef.current) / 1000);
      setCloneCountdown(Math.max(0, 30 - elapsed));

      if (d.step === 'WAIT_SOURCE') {
        setCloneState('wait-source');
      } else if (d.step === 'WAIT_TARGET') {
        setCloneState('wait-target');
        if (d.sourceUID) setCloneSourceUID(d.sourceUID);
      }
    } catch {
      // Connection lost, keep polling
    }
  }, [stopClonePoll, resetClone]);

  const handleStartClone = async () => {
    try {
      const result = await api.startClone();
      if (result.success) {
        cloneStartRef.current = Date.now();
        setCloneState('wait-source');
        toast.success(result.message || 'Clone mode activated');
        clonePollRef.current = setInterval(pollCloneStatus, 600);
      } else {
        toast.error(result.message || 'Failed to start clone mode');
      }
    } catch {
      toast.error('Failed to communicate with device');
    }
  };

  const handleCancelClone = async () => {
    try {
      const result = await api.cancelClone();
      if (result.success) {
        resetClone();
        toast.success('Clone mode cancelled');
      }
    } catch {
      toast.error('Failed to cancel clone mode');
      resetClone();
    }
  };

  // Cleanup clone poll on unmount
  useEffect(() => {
    return () => { stopClonePoll(); };
  }, [stopClonePoll]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <Wrench className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>Device Tools</CardTitle>
            <CardDescription>Manage & configure</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Action Buttons — max 3 per row */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => togglePanel('add-card')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: activePanel === 'add-card' ? 'var(--primary-light)' : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'add-card' ? 'var(--primary)' : 'var(--border)'}`,
              color: activePanel === 'add-card' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="text-[11px] font-medium">Add Card</span>
          </button>

          <button
            onClick={() => togglePanel('ota')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: activePanel === 'ota' ? 'var(--primary-light)' : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'ota' ? 'var(--primary)' : 'var(--border)'}`,
              color: activePanel === 'ota' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <Upload className="w-4 h-4" />
            <span className="text-[11px] font-medium">OTA Update</span>
          </button>

          <button
            onClick={() => togglePanel('clone')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: activePanel === 'clone' ? 'var(--primary-light)' : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'clone' ? 'var(--primary)' : 'var(--border)'}`,
              color: activePanel === 'clone' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <Copy className="w-4 h-4" />
            <span className="text-[11px] font-medium">Clone Card</span>
          </button>

          <button
            onClick={() => togglePanel('restart')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: activePanel === 'restart' ? 'var(--danger-light)' : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'restart' ? 'var(--danger)' : 'var(--border)'}`,
              color: activePanel === 'restart' ? 'var(--danger)' : 'var(--text-secondary)',
            }}
          >
            <Power className="w-4 h-4" />
            <span className="text-[11px] font-medium">Restart</span>
          </button>

          <button
            onClick={() => togglePanel('rfid-toggle')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all relative"
            style={{
              background: activePanel === 'rfid-toggle'
                ? (rfidDisabled ? 'var(--danger-light)' : 'var(--primary-light)')
                : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'rfid-toggle'
                ? (rfidDisabled ? 'var(--danger)' : 'var(--primary)')
                : 'var(--border)'}`,
              color: activePanel === 'rfid-toggle'
                ? (rfidDisabled ? 'var(--danger)' : 'var(--primary)')
                : 'var(--text-secondary)',
            }}
          >
            <WifiOff className="w-4 h-4" />
            <span className="text-[11px] font-medium">RFID</span>
            {rfidDisabled && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
            )}
          </button>

          <button
            onClick={() => togglePanel('schedule-restart')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
            style={{
              background: activePanel === 'schedule-restart' ? 'var(--primary-light)' : 'var(--bg-surface-hover)',
              border: `1px solid ${activePanel === 'schedule-restart' ? 'var(--primary)' : 'var(--border)'}`,
              color: activePanel === 'schedule-restart' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <Clock className="w-4 h-4" />
            <span className="text-[11px] font-medium">Schedule</span>
          </button>
        </div>

        {/* Detail Panels */}
        <AnimatePresence mode="wait">
          {/* ── Add Card Panel ── */}
          {activePanel === 'add-card' && (
            <motion.div
              key="add-card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                {isRegistrationMode ? (
                  <>
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 animate-pulse" style={{ color: 'var(--warning)' }} />
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>Registration Mode Active</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Tap any unregistered card to add it</p>
                      </div>
                    </div>
                    <Button onClick={handleToggleRegistration} isLoading={isToggling} variant="secondary" size="sm" className="w-full">
                      <X className="w-3.5 h-3.5 mr-1.5" /> Exit Registration Mode
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Enter registration mode to add or remove RFID cards.
                    </p>
                    <Button
                      onClick={handleToggleRegistration}
                      isLoading={isToggling}
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={!status || status.doorUnlocked}
                    >
                      {isToggling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                      Enter Registration Mode
                    </Button>
                    {status?.doorUnlocked && (
                      <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>Lock the door first</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── OTA Panel ── */}
          {activePanel === 'ota' && (
            <motion.div
              key="ota"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <input ref={fileInputRef} type="file" accept=".bin" onChange={handleFileSelect} className="hidden" />

                {(otaState === 'idle' || otaState === 'selected') && (
                  <>
                    {!otaFile ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 5%, transparent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <FileUp className="w-5 h-5" />
                        <span className="text-xs font-medium">Select .bin firmware file</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <FileUp className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{otaFile.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatSize(otaFile.size)}</p>
                        </div>
                        <button onClick={otaReset} style={{ color: 'var(--text-muted)' }}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    {otaFile && (
                      <Button onClick={handleOtaUpload} variant="primary" size="sm" className="w-full">
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload & Flash
                      </Button>
                    )}
                    <div className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Door will auto-lock during update. Only upload .bin files for this device.</span>
                    </div>
                  </>
                )}

                {otaState === 'uploading' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Uploading...</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>{otaProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${otaProgress}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                )}

                {otaState === 'flashing' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--warning)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Flashing firmware...</span>
                  </div>
                )}

                {otaState === 'success' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--success-light)' }}>
                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>Update successful! Restarting...</span>
                  </div>
                )}

                {otaState === 'error' && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'var(--danger-light)' }}>
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                      <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{otaError}</span>
                    </div>
                    <Button onClick={otaReset} variant="secondary" size="sm" className="w-full">Try Again</Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Restart Panel ── */}
          {activePanel === 'restart' && (
            <motion.div
              key="restart"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                {restartState === 'idle' && (
                  <>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Restart the ESP32. Device will be offline for ~10 seconds.
                    </p>
                    <Button onClick={handleRestart} variant="danger" size="sm" className="w-full">
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restart Device
                    </Button>
                  </>
                )}

                {restartState === 'confirming' && (
                  <>
                    <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'var(--danger-light)' }}>
                      <Power className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--danger-text)' }}>Are you sure?</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Door will auto-lock and device goes offline ~10s.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleRestart} variant="danger" size="sm" className="flex-1">
                        <Power className="w-3.5 h-3.5 mr-1.5" /> Confirm
                      </Button>
                      <Button onClick={() => setRestartState('idle')} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  </>
                )}

                {restartState === 'restarting' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--warning)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Restarting ESP32...</span>
                  </div>
                )}

                {restartState === 'success' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--success-light)' }}>
                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>Restart initiated. Back online in ~10s.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Clone Panel ── */}
          {activePanel === 'clone' && (
            <motion.div
              key="clone"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                {cloneState === 'idle' && (
                  <>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Clone a card&apos;s UID to a Chinese magic card (Gen1a/Gen2). Only 4-byte UIDs supported.
                    </p>
                    <Button
                      onClick={handleStartClone}
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={!status || (status.state !== 'IDLE' && status.state !== 'CLONE_MODE')}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Start Clone
                    </Button>
                    {status && status.state !== 'IDLE' && status.state !== 'CLONE_MODE' && (
                      <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>System busy ({status.state})</p>
                    )}
                  </>
                )}

                {(cloneState === 'wait-source' || cloneState === 'wait-target') && (
                  <div className="space-y-3">
                    {/* Steps */}
                    <div className="space-y-2">
                      {/* Step 1 */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${cloneState === 'wait-source' ? 'animate-pulse' : ''}`}
                          style={{
                            background: cloneState === 'wait-source' ? 'var(--warning)' : 'var(--success)',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Tap source card</p>
                          {cloneState === 'wait-target' && cloneSourceUID && (
                            <p className="text-[10px] font-mono mt-0.5 px-1.5 py-0.5 rounded inline-block" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                              {cloneSourceUID}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Step 2 */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${cloneState === 'wait-target' ? 'animate-pulse' : ''}`}
                          style={{
                            background: cloneState === 'wait-target' ? 'var(--primary)' : 'var(--border)',
                          }}
                        />
                        <p className="text-xs" style={{ color: cloneState === 'wait-target' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          Tap target (magic card)
                        </p>
                      </div>
                    </div>

                    {/* Countdown */}
                    {cloneCountdown > 0 && (
                      <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                        Timeout: {cloneCountdown}s
                      </p>
                    )}

                    <Button onClick={handleCancelClone} variant="secondary" size="sm" className="w-full">
                      <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
                    </Button>
                  </div>
                )}

                {cloneState === 'success' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--success-light)' }}>
                      <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--success-text)' }}>Clone successful!</p>
                        {cloneSourceUID && (
                          <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{cloneSourceUID}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {cloneState === 'failed' && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'var(--danger-light)' }}>
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--danger-text)' }}>Clone failed</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Target is not a magic card (Gen1a/Gen2)</p>
                      </div>
                    </div>
                  </div>
                )}

                {cloneState === 'timeout' && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Clone mode timed out</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── RFID Toggle Panel ── */}
          {activePanel === 'rfid-toggle' && (
            <motion.div
              key="rfid-toggle"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{
                  background: rfidDisabled
                    ? 'var(--danger-light)'
                    : 'var(--success-light)',
                }}>
                  <WifiOff className="w-4 h-4 shrink-0 mt-0.5" style={{
                    color: rfidDisabled ? 'var(--danger)' : 'var(--success)',
                  }} />
                  <div>
                    <p className="text-xs font-semibold" style={{
                      color: rfidDisabled ? 'var(--danger-text)' : 'var(--success-text)',
                    }}>
                      RFID is {rfidDisabled ? 'DISABLED' : 'ENABLED'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {rfidDisabled
                        ? 'All card scans are ignored. Touch sensor still works.'
                        : 'RFID reader is active and accepting cards.'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleToggleRfid}
                  isLoading={isTogglingRfid}
                  variant={rfidDisabled ? 'primary' : 'danger'}
                  size="sm"
                  className="w-full"
                >
                  <WifiOff className="w-3.5 h-3.5 mr-1.5" />
                  {rfidDisabled ? 'Enable RFID' : 'Disable RFID'}
                </Button>
                <div className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>When disabled, the device will beep 5 times rapidly. The setting persists across restarts.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Schedule Restart Panel ── */}
          {activePanel === 'schedule-restart' && (
            <motion.div
              key="schedule-restart"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="p-3.5 rounded-xl space-y-3"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Automatically restart ESP32 on a schedule to keep it healthy.
                </p>

                {/* Mode selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Mode</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: 0, label: 'Off' },
                      { value: 1, label: 'At Hour' },
                      { value: 2, label: 'Every X hrs' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSchedMode(opt.value)}
                        className="px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                        style={{
                          background: schedMode === opt.value ? 'var(--primary-light)' : 'var(--bg-surface)',
                          color: schedMode === opt.value ? 'var(--primary)' : 'var(--text-muted)',
                          border: `1px solid ${schedMode === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* At hour config */}
                {schedMode === 1 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Restart at</label>
                    <select
                      value={schedHour}
                      onChange={(e) => setSchedHour(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                      ))}
                    </select>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ESP32 will restart once daily at this hour (WIB).
                    </p>
                  </div>
                )}

                {/* Every X hours config */}
                {schedMode === 2 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Restart every</label>
                    <select
                      value={schedInterval}
                      onChange={(e) => setSchedInterval(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
                        <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ESP32 will restart after running for this many hours.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleSaveScheduleRestart}
                  isLoading={isSavingSched}
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  {schedMode === 0 ? 'Save (Disabled)' : 'Save Schedule'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
