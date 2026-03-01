import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Weather API using Open-Meteo (free, no API key required)
// Coordinates configurable via environment variables
const LATITUDE = process.env.WEATHER_LATITUDE || '-6.990567';
const LONGITUDE = process.env.WEATHER_LONGITUDE || '110.456260';

interface WeatherResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    is_day: number[];
  };
}

// WMO Weather interpretation codes → description & icon name
function getWeatherInfo(code: number, isDay: boolean): { description: string; icon: string } {
  const dayNight = isDay ? 'day' : 'night';
  
  if (code === 0) return { description: 'Clear sky', icon: isDay ? 'sun' : 'moon' };
  if (code === 1) return { description: 'Mainly clear', icon: isDay ? 'sun' : 'moon' };
  if (code === 2) return { description: 'Partly cloudy', icon: `cloud-${dayNight}` };
  if (code === 3) return { description: 'Overcast', icon: 'cloud' };
  if (code >= 45 && code <= 48) return { description: 'Foggy', icon: 'cloud-fog' };
  if (code >= 51 && code <= 55) return { description: 'Drizzle', icon: 'cloud-drizzle' };
  if (code >= 56 && code <= 57) return { description: 'Freezing drizzle', icon: 'cloud-drizzle' };
  if (code >= 61 && code <= 65) return { description: 'Rain', icon: 'cloud-rain' };
  if (code >= 66 && code <= 67) return { description: 'Freezing rain', icon: 'cloud-rain' };
  if (code >= 71 && code <= 77) return { description: 'Snow', icon: 'cloud-snow' };
  if (code >= 80 && code <= 82) return { description: 'Rain showers', icon: 'cloud-rain' };
  if (code >= 85 && code <= 86) return { description: 'Snow showers', icon: 'cloud-snow' };
  if (code >= 95 && code <= 99) return { description: 'Thunderstorm', icon: 'cloud-lightning' };
  
  return { description: 'Unknown', icon: 'cloud' };
}

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,weather_code,relative_humidity_2m,precipitation_probability,is_day&forecast_days=1&timezone=auto`;
    
    const res = await fetch(url, { next: { revalidate: 600 } }); // Cache for 10 min
    
    if (!res.ok) {
      throw new Error(`Open-Meteo API returned ${res.status}`);
    }

    const data: WeatherResponse = await res.json();
    const { temperature_2m, relative_humidity_2m, weather_code, wind_speed_10m, is_day } = data.current;
    const weatherInfo = getWeatherInfo(weather_code, is_day === 1);

    // Build hourly forecast (next 12 hours from now)
    const now = new Date();
    const currentHour = now.getHours();
    const hourly = [];
    
    if (data.hourly) {
      for (let i = 0; i < data.hourly.time.length && hourly.length < 12; i++) {
        const hourDate = new Date(data.hourly.time[i]);
        if (hourDate.getHours() <= currentHour) continue; // Skip past hours
        
        const hInfo = getWeatherInfo(data.hourly.weather_code[i], data.hourly.is_day[i] === 1);
        hourly.push({
          time: data.hourly.time[i],
          temperature: Math.round(data.hourly.temperature_2m[i]),
          humidity: data.hourly.relative_humidity_2m[i],
          precipitationProbability: data.hourly.precipitation_probability[i],
          description: hInfo.description,
          icon: hInfo.icon,
        });
      }
    }

    return NextResponse.json({
      temperature: Math.round(temperature_2m),
      humidity: relative_humidity_2m,
      windSpeed: Math.round(wind_speed_10m),
      description: weatherInfo.description,
      icon: weatherInfo.icon,
      isDay: is_day === 1,
      code: weather_code,
      hourly,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
