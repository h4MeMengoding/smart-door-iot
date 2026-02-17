'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Upload, FileUp, CheckCircle, XCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config';
import { logSystemEvent } from '@/lib/systemEvents';
import toast from 'react-hot-toast';

type OtaState = 'idle' | 'selected' | 'uploading' | 'flashing' | 'success' | 'error';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max firmware size

export function OtaUpdateCard() {
  const [state, setState] = useState<OtaState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setFile(null);
    setProgress(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate file extension
    if (!selected.name.endsWith('.bin')) {
      setErrorMsg('Only .bin firmware files are allowed');
      setState('error');
      return;
    }

    // Validate file size
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMsg(`File too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      setState('error');
      return;
    }

    // Validate minimum size (at least 100KB to be a valid firmware)
    if (selected.size < 100 * 1024) {
      setErrorMsg('File too small to be a valid firmware');
      setState('error');
      return;
    }

    setFile(selected);
    setErrorMsg('');
    setState('selected');
  }, []);

  const handleUpload = useCallback(() => {
    if (!file) return;

    setState('uploading');
    setProgress(0);

    const formData = new FormData();
    formData.append('firmware', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        if (pct >= 100) {
          setState('flashing');
        }
      }
    });

    xhr.addEventListener('load', () => {
      xhrRef.current = null;
      if (xhr.status === 200) {
        // Parse JSON response from ESP32
        let isSuccess = false;
        try {
          const resp = JSON.parse(xhr.responseText);
          isSuccess = resp.success === true;
        } catch {
          // Fallback: plain text "OK" response
          isSuccess = xhr.responseText.trim() === 'OK';
        }

        if (isSuccess) {
          setState('success');
          toast.success('Firmware updated! ESP32 restarting...');
          logSystemEvent('ota_upload', `OTA firmware uploaded: ${file?.name}`);
          // Auto refresh after 5 seconds
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        } else {
          setErrorMsg(xhr.responseText || 'Upload failed — ESP32 returned an error');
          setState('error');
          toast.error('OTA update failed');
        }
      } else {
        setErrorMsg(xhr.responseText || 'Upload failed — ESP32 returned an error');
        setState('error');
        toast.error('OTA update failed');
      }
    });

    xhr.addEventListener('error', () => {
      xhrRef.current = null;
      setErrorMsg('Connection lost. Check if ESP32 is reachable.');
      setState('error');
      toast.error('Failed to connect to ESP32');
    });

    xhr.addEventListener('timeout', () => {
      xhrRef.current = null;
      setErrorMsg('Upload timed out. Try again.');
      setState('error');
    });

    xhr.timeout = 60000; // 60s timeout

    const baseUrl = getApiBaseUrl();
    xhr.open('POST', `${baseUrl}/do-update`);
    xhr.send(formData);
  }, [file]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <Upload className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>OTA Update</CardTitle>
            <CardDescription>Upload firmware to ESP32</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Idle / File selection */}
        {(state === 'idle' || state === 'selected') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 5%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <FileUp className="w-5 h-5" />
                <span className="text-xs font-medium">Select .bin firmware file</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary-light)' }}
                >
                  <FileUp className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {file.name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {file && (
              <Button
                onClick={handleUpload}
                variant="primary"
                size="lg"
                className="w-full rounded-2xl"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload & Flash
              </Button>
            )}
          </>
        )}

        {/* Uploading */}
        {state === 'uploading' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Uploading firmware...
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Do not close this page
                </p>
              </div>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                {progress}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--primary)' }}
              />
            </div>
          </div>
        )}

        {/* Flashing */}
        {state === 'flashing' && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl"
            style={{
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>
                Flashing firmware...
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                ESP32 is writing firmware. Do not power off.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl"
              style={{
                background: 'var(--success-light)',
                border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
              }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--success-text)' }}>
                  Update successful!
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  ESP32 is restarting. Page will refresh in 5 seconds...
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Waiting for ESP32 to restart...
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl"
              style={{
                background: 'var(--danger-light)',
                border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              }}
            >
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--danger-text)' }}>
                  Update failed
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {errorMsg}
                </p>
              </div>
            </div>
            <Button
              onClick={reset}
              variant="secondary"
              size="sm"
              className="w-full rounded-2xl"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Warning note */}
        {(state === 'idle' || state === 'selected') && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-2xl"
            style={{ background: 'var(--bg-surface-hover)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Door will auto-lock during update. Only upload .bin files built for this device.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}