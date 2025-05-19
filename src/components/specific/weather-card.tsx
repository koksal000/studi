"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { summarizeWeather, type WeatherSummaryOutput } from '@/ai/flows/weather-summarization';
import { AlertTriangle, Cloud, CloudFog, CloudRain, CloudSnow, CloudSun, Loader2, Sun, Thermometer, Droplet, Wind } from 'lucide-react';

const getWeatherIcon = (conditionText: string): JSX.Element => {
  const lowerCondition = conditionText.toLowerCase();
  if (lowerCondition.includes('güneşli') || lowerCondition.includes('açık')) return <Sun className="h-10 w-10 text-yellow-400" />;
  if (lowerCondition.includes('parçalı bulutlu')) return <CloudSun className="h-10 w-10 text-sky-400" />;
  if (lowerCondition.includes('bulutlu')) return <Cloud className="h-10 w-10 text-gray-400" />;
  if (lowerCondition.includes('yağmurlu') || lowerCondition.includes('yağışlı')) return <CloudRain className="h-10 w-10 text-blue-400" />;
  if (lowerCondition.includes('karlı')) return <CloudSnow className="h-10 w-10 text-white" />;
  if (lowerCondition.includes('sisli')) return <CloudFog className="h-10 w-10 text-gray-500" />;
  return <Cloud className="h-10 w-10 text-gray-400" />; // Default icon
};


export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);


  useEffect(() => {
    const fetchWeather = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await summarizeWeather({ location: 'Domaniç' });
        setWeather(result);
        setLastUpdated(new Date());
      } catch (e) {
        setError('Hava durumu bilgisi alınamadı.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather();
    const intervalId = setInterval(fetchWeather, 20 * 60 * 1000); // Update every 20 minutes
    return () => clearInterval(intervalId);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CloudSun className="h-6 w-6 mr-2 text-primary" />
          Domaniç Hava Durumu
        </CardTitle>
        {lastUpdated && (
           <CardDescription>
            Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Yükleniyor...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-center text-destructive">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
        )}
        {weather && !isLoading && !error && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-5xl font-bold text-primary">{weather.temperature.replace(' Celsius', '°C')}</div>
              {getWeatherIcon(weather.conditions)}
            </div>
            <p className="text-lg text-muted-foreground capitalize">{weather.conditions}</p>
            <div className="text-sm space-y-1 text-foreground/80">
              <div className="flex items-center">
                <Droplet className="h-4 w-4 mr-2 text-blue-500" />
                Nem: {weather.humidity}
              </div>
              <div className="flex items-center">
                <Wind className="h-4 w-4 mr-2 text-gray-500" />
                Rüzgar: {weather.windSpeed}
              </div>
            </div>
            <p className="text-xs pt-2 border-t text-muted-foreground">{weather.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}