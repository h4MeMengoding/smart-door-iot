'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { X, Wifi, Volume2, Power, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { getEsp32Url, setEsp32Url } from '@/lib/config';
import { api } from '@/lib/api';
import { useTheme } from '@/components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [esp32Url, setEsp32UrlState] = useState('https://esp.ilhame.id');
  const [isRestarting, setIsRestarting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setEsp32UrlState(getEsp32Url());
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSaveUrl = () => {
    setEsp32Url(esp32Url);
    api.updateBaseUrl();
    toast.success('ESP32 URL updated');
  };

  const handleRestartEsp = async () => {
    if (!confirm('Are you sure you want to restart the ESP32? The device will be offline for a few seconds.')) return;
    setIsRestarting(true);
    try {
      await api.restartEsp();
      toast.success('ESP32 is restarting...');
      setTimeout(() => {
        toast.success('ESP32 should be back online now');
        setIsRestarting(false);
      }, 10000);
    } catch {
      toast.error('Failed to restart ESP32');
      setIsRestarting(false);
    }
  };

  const handleTestBuzzer = async () => {
    setIsTesting(true);
    try {
      await api.playBuzzer('VALID_CARD');
      toast.success('Buzzer test sent');
    } catch {
      toast.error('Failed to test buzzer');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      toast.loading('Testing connection...', { id: 'test-conn' });
      const status = await api.getDoorStatus();
      toast.success(`Connected! Door is ${status.doorStatus}`, { id: 'test-conn' });
    } catch {
      toast.error('Connection failed. Check IP and API key.', { id: 'test-conn' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-50 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto mt-[8vh] mx-4 rounded-3xl"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-3xl"
          style={{
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <SettingsIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure your smart door lock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Appearance */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sun className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Appearance
              </CardTitle>
              <CardDescription>Choose your preferred theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                  style={{
                    background: theme === 'light' ? 'var(--primary)' : 'var(--bg-surface-hover)',
                    color: theme === 'light' ? 'var(--primary-text)' : 'var(--text-secondary)',
                    border: theme === 'light' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  }}
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                  style={{
                    background: theme === 'dark' ? 'var(--primary)' : 'var(--bg-surface-hover)',
                    color: theme === 'dark' ? 'var(--primary-text)' : 'var(--text-secondary)',
                    border: theme === 'dark' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  }}
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ESP32 Connection */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wifi className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                ESP32 Connection
              </CardTitle>
              <CardDescription>Configure the ESP32 device URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  ESP32 URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={esp32Url}
                    onChange={(e) => setEsp32UrlState(e.target.value)}
                    placeholder="https://esp.ilhame.id"
                    className="flex-1 px-3 py-2 rounded-xl text-[13px] font-mono focus:ring-2 focus:outline-none transition-colors"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                  />
                  <Button onClick={handleSaveUrl} variant="primary" size="sm">Save</Button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Default: https://esp.ilhame.id
                </p>
              </div>
              <Button onClick={handleTestConnection} variant="secondary" disabled={isTesting} size="sm">
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </CardContent>
          </Card>

          {/* System Control */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Power className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                System Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Test Buzzer</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Play a test sound on ESP32</p>
                </div>
                <Button onClick={handleTestBuzzer} isLoading={isTesting} variant="secondary" size="sm">
                  <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                  Test
                </Button>
              </div>

              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'var(--danger-light)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
              >
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Restart ESP32</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Reboot the device (~10s offline)</p>
                </div>
                <Button onClick={handleRestartEsp} isLoading={isRestarting} variant="danger" size="sm">
                  <Power className="w-3.5 h-3.5 mr-1.5" />
                  Restart
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <div
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Smart Door Lock Control Panel</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Version 1.0.0 - Built with Next.js</p>
            </div>
            <div
              className="px-2.5 py-1 rounded-full"
              style={{ background: 'var(--success-light)' }}
            >
              <p className="text-[10px] font-medium" style={{ color: 'var(--success-text)' }}>Online</p>
            </div>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
