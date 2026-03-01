'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  isDay: boolean;
  code: number;
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

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex items-center gap-2.5">
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
      <div className="hidden sm:block">
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
    </div>
  );
}
