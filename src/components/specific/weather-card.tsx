
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { summarizeWeather, type WeatherSummaryOutput, type HourlyForecastItem, type DailyForecastItem } from '@/ai/flows/weather-summarization'; // Assuming types are exported
import { AlertTriangle, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Loader2, Sun, Thermometer, Droplet, Wind, CalendarDays, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const getWeatherIcon = (weatherCode: number | undefined, sizeClass = "h-10 w-10"): JSX.Element => {
  if (weatherCode === undefined) return <Cloud className={sizeClass + " text-gray-400"} />;
  switch (weatherCode) {
    case 0: return <Sun className={sizeClass + " text-yellow-400"} />; // Clear sky
    case 1: return <CloudSun className={sizeClass + " text-sky-400"} />; // Mainly clear
    case 2: return <CloudSun className={sizeClass + " text-sky-500"} />; // Partly cloudy
    case 3: return <Cloud className={sizeClass + " text-gray-400"} />; // Overcast
    case 45: case 48: return <CloudFog className={sizeClass + " text-gray-500"} />; // Fog
    case 51: case 53: case 55: return <CloudDrizzle className={sizeClass + " text-blue-300"} />; // Drizzle
    case 56: case 57: return <CloudDrizzle className={sizeClass + " text-blue-400"} />; // Freezing Drizzle
    case 61: case 63: case 65: return <CloudRain className={sizeClass + " text-blue-500"} />; // Rain
    case 66: case 67: return <CloudRain className={sizeClass + " text-blue-600"} />; // Freezing Rain
    case 71: case 73: case 75: return <CloudSnow className={sizeClass + " text-white"} />; // Snow fall
    case 77: return <CloudSnow className={sizeClass + " text-gray-200"} />; // Snow grains
    case 80: case 81: case 82: return <CloudRain className={sizeClass + " text-blue-600"} />; // Rain showers
    case 85: case 86: return <CloudSnow className={sizeClass + " text-gray-100"} />; // Snow showers
    case 95: return <CloudLightning className={sizeClass + " text-yellow-500"} />; // Thunderstorm
    case 96: case 99: return <CloudLightning className={sizeClass + " text-yellow-600"} />; // Thunderstorm with hail
    default: return <Cloud className={sizeClass + " text-gray-400"} />;
  }
};


export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  useEffect(() => {
    const fetchWeather = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await summarizeWeather({ location: 'Domaniç' });
        setWeather(result);
        setLastUpdated(new Date());
      } catch (e: any) {
        setError(e.message || 'Hava durumu bilgisi alınamadı.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather();
    const intervalId = setInterval(fetchWeather, 30 * 60 * 1000); // Update every 30 minutes
    return () => clearInterval(intervalId);
  }, []);

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
                <div className="text-5xl font-bold text-primary">{weather.temperature}</div>
                {getWeatherIcon(weather.currentWeatherCode, "h-12 w-12")}
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
              <Button variant="link" size="sm" className="w-full text-accent -mx-1">Detaylı Tahminleri Gör</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {weather && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl w-[90vw] h-[80vh] flex flex-col p-0">
            <DialogHeader className="p-4 sm:p-6 border-b">
              <DialogTitle className="text-xl sm:text-2xl">Domaniç Detaylı Hava Tahmini</DialogTitle>
              <DialogDescription>
                Saatlik ve günlük tahminler. Son güncelleme: {lastUpdated?.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow overflow-y-auto"> {/* ScrollArea's default padding removed here if content handles it */}
              <div className="space-y-6 p-4 sm:p-6"> {/* Added padding here for overall content */}
                {/* Hourly Forecast Section */}
                {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center">
                      <Clock className="mr-2 h-5 w-5" /> Saatlik Tahmin (İlk 12 Saat)
                    </h3>
                    {/* Wrapper for negative margins to achieve full-width effect relative to ScrollArea's padding */}
                    <div className="-mx-4 sm:-mx-6"> 
                      {/* Actual scroll container with compensating padding */}
                      <div className="overflow-x-auto pb-2 px-4 sm:px-6">
                        <div className="flex space-x-3">
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
                    </div>
                  </section>
                )}

                {/* Daily Forecast Section */}
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
                 {!weather.hourlyForecast && !weather.dailyForecast && (
                    <p className="text-muted-foreground text-center py-4">Detaylı tahmin verisi bulunamadı.</p>
                 )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

