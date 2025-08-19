
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { summarizeWeather, type WeatherSummaryOutput } from '@/ai/flows/weather-summarization';
import { AlertTriangle, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Loader2, Sun, Wind, CalendarDays, Clock, Droplets, Compass, ThermometerSun, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const getWeatherIcon = (weatherCode: number | undefined, sizeClass = "h-10 w-10"): JSX.Element => {
  if (weatherCode === undefined) return <Cloud className={sizeClass + " text-gray-400"} />;
  switch (weatherCode) {
    case 0: return <Sun className={sizeClass + " text-yellow-400"} />;
    case 1: case 2: return <CloudSun className={sizeClass + " text-sky-400"} />;
    case 3: return <Cloud className={sizeClass + " text-gray-400"} />;
    case 45: case 48: return <CloudFog className={sizeClass + " text-gray-500"} />;
    case 51: case 53: case 55: case 56: case 57: return <CloudDrizzle className={sizeClass + " text-blue-300"} />;
    case 61: case 63: case 65: case 66: case 67: return <CloudRain className={sizeClass + " text-blue-500"} />;
    case 71: case 73: case 75: case 77: return <CloudSnow className={sizeClass + " text-white"} />;
    case 80: case 81: case 82: return <CloudRain className={sizeClass + " text-blue-600"} />;
    case 85: case 86: return <CloudSnow className={sizeClass + " text-gray-100"} />;
    case 95: case 96: case 99: return <CloudLightning className={sizeClass + " text-yellow-500"} />;
    default: return <Cloud className={sizeClass + " text-gray-400"} />;
  }
};


export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayedDataTimestamp, setDisplayedDataTimestamp] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWeatherAndScheduleNext = async () => {
    setIsLoading(true);
    try {
      console.log(`[WeatherCard] Attempting to fetch weather data at ${new Date().toISOString()}`);
      const result = await summarizeWeather({ location: 'Domaniç' });
      setWeather(result);
      if (result.dataTimestamp) {
        const newTimestamp = new Date(result.dataTimestamp);
        setDisplayedDataTimestamp(newTimestamp);
        console.log(`[WeatherCard] Successfully fetched weather. Data timestamp: ${newTimestamp.toISOString()}`);
      } else {
        setDisplayedDataTimestamp(new Date()); // Fallback
        console.warn(`[WeatherCard] Fetched weather data missing dataTimestamp.`);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Hava durumu bilgisi alınamadı.');
      console.error("[WeatherCard] Error fetching weather:", e);
    } finally {
      setIsLoading(false);
      scheduleNextAlignedFetch();
    }
  };
  
  const scheduleNextAlignedFetch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    
    const minutesToNextTenMinuteMark = 10 - (minutes % 10);
    const delay = (minutesToNextTenMinuteMark * 60 - seconds) * 1000;
    
    console.log(`[WeatherCard] Next aligned fetch scheduled in ${Math.round(delay/1000)}s`);
    timerRef.current = setTimeout(fetchWeatherAndScheduleNext, delay);
  };

  useEffect(() => {
    fetchWeatherAndScheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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
        onClick={() => weather && !isLoading && setIsModalOpen(true)}
      >
        <CardHeader>
          <CardTitle className="flex items-center">
            {weather && !isLoading ? getWeatherIcon(weather.currentWeatherCode, "h-6 w-6 mr-2") : <CloudSun className="h-6 w-6 mr-2 text-primary" />}
            Domaniç Hava Durumu
          </CardTitle>
          {displayedDataTimestamp && (
             <CardDescription>
              Veri zamanı: {getFormattedTime(displayedDataTimestamp)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && !weather && ( 
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Yükleniyor...</p>
            </div>
          )}
          {error && !isLoading && !weather && ( 
            <div className="flex items-center text-destructive">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          )}
          {weather && ( 
            <div className="space-y-4">
               {isLoading && <p className="text-xs text-muted-foreground text-center animate-pulse">Yeni veriler yükleniyor...</p>}
               {error && <p className="text-xs text-destructive text-center">Güncelleme hatası. Gösterilen veriler eski olabilir.</p>}
              <div className="flex items-center justify-between">
                <div className="text-5xl font-bold text-primary">{weather.temperature}</div>
                {getWeatherIcon(weather.currentWeatherCode, "h-12 w-12")}
              </div>
              <p className="text-lg text-muted-foreground capitalize">{weather.conditions}</p>
              <div className="text-sm space-y-1 text-foreground/80">
                <div className="flex items-center"><Droplets className="h-4 w-4 mr-2 text-blue-500" />Nem: {weather.humidity}</div>
                <div className="flex items-center"><Wind className="h-4 w-4 mr-2 text-gray-500" />Rüzgar: {weather.windSpeed}</div>
              </div>
              {weather.aiCommentary && (
                <Alert variant="default" className="bg-primary/5 border-primary/20">
                  <AlertCircle className="h-4 w-4 text-primary/80" />
                  <AlertTitle className="text-primary font-semibold">Hava Durumu Yorumu</AlertTitle>
                  <AlertDescription className="text-primary/90 text-xs">{weather.aiCommentary}</AlertDescription>
                </Alert>
              )}
               {!weather.aiCommentary && (
                 <p className="text-xs pt-2 border-t text-muted-foreground">{weather.summary}</p>
               )}
              <Button variant="link" size="sm" className="w-full text-accent -mx-1">Detaylı Tahminleri Gör</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {weather && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
              <DialogTitle className="text-xl sm:text-2xl">Domaniç Detaylı Hava Tahmini</DialogTitle>
              <DialogDescription>Veri zamanı: {getFormattedDateTime(displayedDataTimestamp)}</DialogDescription>
            </DialogHeader>
            <div className="flex-grow min-h-0 overflow-auto">
              <div className="p-4 sm:p-6 space-y-6">
                {weather.aiCommentary && (
                  <Alert variant="default" className="bg-primary/5 border-primary/20">
                    <AlertCircle className="h-4 w-4 text-primary/80" />
                    <AlertTitle className="text-primary font-semibold">AI Hava Durumu Yorumu ve Uyarılar</AlertTitle>
                    <AlertDescription className="text-primary/90">{weather.aiCommentary}</AlertDescription>
                  </Alert>
                )}

                {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center"><Clock className="mr-2 h-5 w-5" /> Saatlik Tahmin (24 Saat)</h3>
                    <div className="overflow-x-auto pb-2 -mx-4 px-4 touch-pan-x">
                      <div className="flex space-x-3 w-max">
                        {weather.hourlyForecast.map((hour, index) => (
                          <Card key={index} className="min-w-[130px] flex-shrink-0 shadow">
                            <CardHeader className="p-3 text-center"><CardTitle className="text-base">{hour.time}</CardTitle></CardHeader>
                            <CardContent className="p-3 text-center space-y-1 text-xs">
                              {getWeatherIcon(hour.weatherCode, "h-8 w-8 mx-auto mb-1")}
                              <p className="font-semibold text-sm">{hour.temperature}</p>
                              <p className="capitalize text-muted-foreground">{hour.conditions}</p>
                              <div className="pt-2 border-t mt-2 text-left space-y-1">
                                <p className="flex items-center"><Droplets className="h-3 w-3 mr-1.5 text-blue-400" /> %{hour.precipitationProbability}</p>
                                <p className="flex items-center"><ThermometerSun className="h-3 w-3 mr-1.5 text-orange-400" /> {hour.apparentTemperature}</p>
                                <p className="flex items-center"><Wind className="h-3 w-3 mr-1.5 text-gray-400" /> {hour.windSpeed}</p>
                                <p className="flex items-center"><Compass className="h-3 w-3 mr-1.5 text-gray-500" /> {hour.windDirection}</p>
                                <p className="flex items-center"><Sun className="h-3 w-3 mr-1.5 text-purple-400" /> {hour.uvIndex}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {weather.dailyForecast && weather.dailyForecast.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center"><CalendarDays className="mr-2 h-5 w-5" /> Haftalık Tahmin</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead className="text-center">Durum</TableHead>
                            <TableHead className="text-right">Maks/Min</TableHead>
                            <TableHead className="text-right">Yağış</TableHead>
                            <TableHead className="text-right">Max Rüzgar</TableHead>
                            <TableHead className="text-right">Max UV</TableHead>
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
                              <TableCell className="text-right">{day.windSpeedMax}</TableCell>
                              <TableCell className="text-right">{day.uvIndexMax}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
