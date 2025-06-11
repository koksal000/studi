
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { summarizeWeather, type WeatherSummaryOutput } from '@/ai/flows/weather-summarization';
import { AlertTriangle, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Loader2, Sun, Wind, CalendarDays, Clock } from 'lucide-react'; // Thermometer, Droplet kaldırıldı, gereksizdi
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const getWeatherIcon = (weatherCode: number | undefined, sizeClass = "h-10 w-10"): JSX.Element => {
  if (weatherCode === undefined) return <Cloud className={sizeClass + " text-gray-400"} />;
  switch (weatherCode) {
    case 0: return <Sun className={sizeClass + " text-yellow-400"} />;
    case 1: return <CloudSun className={sizeClass + " text-sky-400"} />;
    case 2: return <CloudSun className={sizeClass + " text-sky-500"} />;
    case 3: return <Cloud className={sizeClass + " text-gray-400"} />;
    case 45: case 48: return <CloudFog className={sizeClass + " text-gray-500"} />;
    case 51: case 53: case 55: return <CloudDrizzle className={sizeClass + " text-blue-300"} />;
    case 56: case 57: return <CloudDrizzle className={sizeClass + " text-blue-400"} />;
    case 61: case 63: case 65: return <CloudRain className={sizeClass + " text-blue-500"} />;
    case 66: case 67: return <CloudRain className={sizeClass + " text-blue-600"} />;
    case 71: case 73: case 75: return <CloudSnow className={sizeClass + " text-white"} />;
    case 77: return <CloudSnow className={sizeClass + " text-gray-200"} />;
    case 80: case 81: case 82: return <CloudRain className={sizeClass + " text-blue-600"} />;
    case 85: case 86: return <CloudSnow className={sizeClass + " text-gray-100"} />;
    case 95: return <CloudLightning className={sizeClass + " text-yellow-500"} />;
    case 96: case 99: return <CloudLightning className={sizeClass + " text-yellow-600"} />;
    default: return <Cloud className={sizeClass + " text-gray-400"} />;
  }
};


export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedDataTimestamp, setDisplayedDataTimestamp] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      setIsLoading(true); // Set loading true at the start of each fetch attempt
      // setError(null); // Don't clear previous error immediately, only if new fetch is successful
      try {
        const result = await summarizeWeather({ location: 'Domaniç' });
        setWeather(result);
        if (result.dataTimestamp) {
          setDisplayedDataTimestamp(new Date(result.dataTimestamp));
        } else {
          setDisplayedDataTimestamp(new Date()); // Fallback if dataTimestamp is missing
        }
        setError(null); // Clear error on successful fetch
      } catch (e: any) {
        setError(e.message || 'Hava durumu bilgisi alınamadı.');
        console.error(e);
        // Don't clear old weather data on error, so user can still see stale data
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather(); // Initial fetch
    const intervalId = setInterval(fetchWeather, 10 * 60 * 1000); // Attempt to refresh every 10 minutes
    return () => clearInterval(intervalId);
  }, []);

  const getFormattedTime = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  
  const getFormattedDateTime = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => weather && !isLoading && !error && setIsModalOpen(true)}
      >
        <CardHeader>
          <CardTitle className="flex items-center">
            {weather && !isLoading ? getWeatherIcon(weather.currentWeatherCode, "h-6 w-6 mr-2") : <CloudSun className="h-6 w-6 mr-2 text-primary" />}
            Domaniç Hava Durumu
          </CardTitle>
          {displayedDataTimestamp && (
             <CardDescription>
              Son başarılı güncelleme: {getFormattedTime(displayedDataTimestamp)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && !weather && ( // Show loader only if there's no weather data at all yet
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Yükleniyor...</p>
            </div>
          )}
          {error && !isLoading && !weather && ( // Show error only if loading finished and still no weather data
            <div className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          )}
          {weather && ( // Always display weather data if available, even if loading new or if there was an error with the latest fetch
            <div className="space-y-4">
               {isLoading && <p className="text-xs text-muted-foreground text-center animate-pulse">Yeni veriler yükleniyor...</p>}
               {error && <p className="text-xs text-destructive text-center">Güncelleme hatası: {error}. Gösterilen veriler eski olabilir.</p>}
              <div className="flex items-center justify-between">
                <div className="text-5xl font-bold text-primary">{weather.temperature}</div>
                {getWeatherIcon(weather.currentWeatherCode, "h-12 w-12")}
              </div>
              <p className="text-lg text-muted-foreground capitalize">{weather.conditions}</p>
              <div className="text-sm space-y-1 text-foreground/80">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-blue-500"><path d="M12 2.69l.01-2.69M12 2.69A5 5 0 0117 7.69V12h-1a4 4 0 00-8 0H7v-4.31A5 5 0 0112 2.69zM12 17.31V22M12 17.31a5 5 0 01-5-5H2a10 10 0 0020 0h-5a5 5 0 01-5 5z"/></svg>
                  Nem: {weather.humidity}
                </div>
                <div className="flex items-center">
                  <Wind className="h-4 w-4 mr-2 text-gray-500" />
                  Rüzgar: {weather.windSpeed}
                </div>
              </div>
              <p className="text-xs pt-2 border-t text-muted-foreground">{weather.summary}</p>
              <Button variant="link" size="sm" className="w-full text-accent -mx-1">Detaylı Tahminleri Gör</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {weather && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
              <DialogTitle className="text-xl sm:text-2xl">Domaniç Detaylı Hava Tahmini</DialogTitle>
              <DialogDescription>
                Saatlik ve günlük tahminler. Veri zamanı: {getFormattedDateTime(displayedDataTimestamp)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow min-h-0 overflow-auto">
              <div className="p-4 sm:p-6">
                {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                  <section className={(weather.dailyForecast && weather.dailyForecast.length > 0) ? "mb-6" : ""}>
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
                      <Clock className="mr-2 h-5 w-5" /> Saatlik Tahmin (İlk 12 Saat)
                    </h3>
                    <div className="overflow-x-auto py-2 touch-pan-x">
                      <div className="flex space-x-3 w-max">
                        {weather.hourlyForecast.map((hour, index) => (
                          <Card key={index} className="min-w-[120px] flex-shrink-0 shadow">
                            <CardHeader className="p-3 text-center">
                              <CardTitle className="text-base">{hour.time}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 text-center space-y-1">
                              {getWeatherIcon(hour.weatherCode, "h-8 w-8 mx-auto mb-1")}
                              <p className="text-xs capitalize">{hour.conditions}</p>
                              <p className="font-semibold text-sm">{hour.temperature}</p>
                              <p className="text-xs text-muted-foreground">Yağış: {hour.precipitationProbability}</p>
                              <p className="text-xs text-muted-foreground">Rüzgar: {hour.windSpeed.split(' ')[0]} km/s</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {weather.dailyForecast && weather.dailyForecast.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
                      <CalendarDays className="mr-2 h-5 w-5" /> Günlük Tahmin (7 Gün)
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead className="text-center">Durum</TableHead>
                          <TableHead className="text-right">Maks/Min</TableHead>
                          <TableHead className="text-right">Yağış</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weather.dailyForecast.map((day, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell className="text-center flex flex-col items-center">
                              {getWeatherIcon(day.weatherCode, "h-6 w-6")}
                              <span className="text-xs capitalize mt-1">{day.conditions}</span>
                            </TableCell>
                            <TableCell className="text-right">{day.maxTemperature} / {day.minTemperature}</TableCell>
                            <TableCell className="text-right">{day.precipitationSum}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </section>
                )}
                 {(!weather.hourlyForecast || weather.hourlyForecast.length === 0) && (!weather.dailyForecast || weather.dailyForecast.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">Detaylı tahmin verisi bulunamadı.</p>
                 )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
