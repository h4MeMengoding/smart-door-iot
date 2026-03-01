'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudSun,
  CloudMoon,
  Droplets,
  Wind,
  ChevronRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  precipitationProbability: number;
  description: string;
  icon: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  isDay: boolean;
  code: number;
  hourly?: HourlyForecast[];
}

function getWeatherIcon(icon: string, size = 18) {
  const props = { className: `w-[${size}px] h-[${size}px]`, style: { color: 'var(--text-primary)' } };

  switch (icon) {
    case 'sun': return <Sun {...props} />;
    case 'moon': return <Moon {...props} />;
    case 'cloud-day': return <CloudSun {...props} />;
    case 'cloud-night': return <CloudMoon {...props} />;
    case 'cloud': return <Cloud {...props} />;
    case 'cloud-fog': return <CloudFog {...props} />;
    case 'cloud-drizzle': return <CloudDrizzle {...props} />;
    case 'cloud-rain': return <CloudRain {...props} />;
    case 'cloud-snow': return <CloudSnow {...props} />;
    case 'cloud-lightning': return <CloudLightning {...props} />;
    default: return <Cloud {...props} />;
  }
}

function getWeatherIconSmall(icon: string) {
  const props = { className: 'w-4 h-4', style: { color: 'var(--text-secondary)' } };

  switch (icon) {
    case 'sun': return <Sun {...props} />;
    case 'moon': return <Moon {...props} />;
    case 'cloud-day': return <CloudSun {...props} />;
    case 'cloud-night': return <CloudMoon {...props} />;
    case 'cloud': return <Cloud {...props} />;
    case 'cloud-fog': return <CloudFog {...props} />;
    case 'cloud-drizzle': return <CloudDrizzle {...props} />;
    case 'cloud-rain': return <CloudRain {...props} />;
    case 'cloud-snow': return <CloudSnow {...props} />;
    case 'cloud-lightning': return <CloudLightning {...props} />;
    default: return <Cloud {...props} />;
  }
}

function formatHour(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (!data.error) {
        setWeather(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Close popup on outside click
  useEffect(() => {
    if (!showForecast) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowForecast(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showForecast]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl animate-pulse"
          style={{ background: 'var(--bg-elevated)' }}
        />
        <div className="hidden sm:block">
          <div
            className="h-3 w-10 rounded animate-pulse mb-1"
            style={{ background: 'var(--bg-elevated)' }}
          />
          <div
            className="h-2.5 w-16 rounded animate-pulse"
            style={{ background: 'var(--bg-elevated)' }}
          />
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const hasHourly = weather.hourly && weather.hourly.length > 0;

  return (
    <div className="relative" ref={popupRef}>
      {/* Clickable weather summary */}
      <button
        onClick={() => hasHourly && setShowForecast((p) => !p)}
        className="flex items-center gap-2.5 transition-opacity"
        style={{ cursor: hasHourly ? 'pointer' : 'default' }}
      >
        {/* Weather icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          {getWeatherIcon(weather.icon)}
        </div>

        {/* Temperature + Description */}
        <div className="hidden sm:block text-left">
          <div className="flex items-baseline gap-1">
            <span
              className="text-sm font-bold leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              {weather.temperature}°C
            </span>
          </div>
          <p
            className="text-[10px] leading-tight mt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {weather.description}
          </p>
        </div>

        {/* Mobile: just temperature */}
        <span
          className="sm:hidden text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {weather.temperature}°
        </span>

        {/* Humidity + Wind (desktop only) */}
        <div
          className="hidden md:flex items-center gap-3 pl-2.5 ml-0.5"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1">
            <Droplets className="w-3 h-3" style={{ color: 'var(--info)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {weather.humidity}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {weather.windSpeed} km/h
            </span>
          </div>
        </div>

        {/* Chevron indicator */}
        {hasHourly && (
          <ChevronRight
            className="w-3.5 h-3.5 hidden sm:block transition-transform"
            style={{
              color: 'var(--text-muted)',
              transform: showForecast ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        )}
      </button>

      {/* Hourly Forecast Popup */}
      <AnimatePresence>
        {showForecast && hasHourly && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 z-50 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Hourly Forecast
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Next {weather.hourly!.length} hours
                </p>
              </div>
              <button
                onClick={() => setShowForecast(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hourly list */}
            <div className="max-h-[300px] overflow-y-auto px-2 py-2 space-y-0.5">
              {weather.hourly!.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface-hover)' }}
                >
                  {/* Time */}
                  <span
                    className="text-[12px] font-mono font-medium w-10 shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatHour(h.time)}
                  </span>

                  {/* Icon */}
                  <div className="shrink-0">{getWeatherIconSmall(h.icon)}</div>

                  {/* Temperature */}
                  <span
                    className="text-[13px] font-bold w-10 shrink-0"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {h.temperature}°
                  </span>

                  {/* Description */}
                  <span
                    className="text-[10px] flex-1 truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h.description}
                  </span>

                  {/* Rain probability */}
                  {h.precipitationProbability > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Droplets className="w-3 h-3" style={{ color: 'var(--info)' }} />
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: 'var(--info)' }}
                      >
                        {h.precipitationProbability}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
