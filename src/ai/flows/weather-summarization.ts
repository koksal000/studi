
'use server';

/**
 * @fileOverview Fetches and summarizes current weather conditions for Domaniç using Open-Meteo API,
 * including hourly and daily forecasts. Caches data for 10 minutes.
 *
 * - summarizeWeather - A function that handles the weather summarization process.
 * - WeatherSummaryInput - The input type for the summarizeWeather function.
 * - WeatherSummaryOutput - The return type for the summarizeWeather function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WeatherSummaryInputSchema = z.object({
  location: z.string().describe('The location for which to summarize weather, e.g. Domaniç.'),
});
export type WeatherSummaryInput = z.infer<typeof WeatherSummaryInputSchema>;

const HourlyForecastItemSchema = z.object({
  time: z.string().describe("Formatted time for the forecast (e.g., '14:00')"),
  temperature: z.string().describe("Formatted temperature (e.g., '15°C')"),
  precipitationProbability: z.string().describe("Formatted precipitation probability (e.g., '30%')"),
  conditions: z.string().describe("Human-readable weather conditions in Turkish (e.g., 'Parçalı Bulutlu')"),
  windSpeed: z.string().describe("Formatted wind speed (e.g., '10 km/h')"),
  weatherCode: z.number().describe("Original WMO weather code for icon mapping"),
});

const DailyForecastItemSchema = z.object({
  date: z.string().describe("Formatted date for the forecast (e.g., 'Sal, 25 Tem')"),
  maxTemperature: z.string().describe("Formatted maximum temperature (e.g., '22°C')"),
  minTemperature: z.string().describe("Formatted minimum temperature (e.g., '12°C')"),
  precipitationSum: z.string().describe("Formatted precipitation sum (e.g., '5 mm')"),
  conditions: z.string().describe("Human-readable weather conditions in Turkish (e.g., 'Sağanak Yağmur')"),
  weatherCode: z.number().describe("Original WMO weather code for icon mapping"),
});

const WeatherSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the current weather conditions in Turkish.'),
  temperature: z.string().describe('The current temperature in Celsius, formatted with °C (e.g., "22.5°C").'),
  humidity: z.string().describe('The current humidity percentage, formatted with % (e.g., "60%").'),
  windSpeed: z.string().describe('The current wind speed in km/h, formatted with km/h (e.g., "15.3 km/h").'),
  conditions: z.string().describe('Overall current weather conditions in Turkish (e.g., "Güneşli", "Parçalı Bulutlu", "Yağmurlu").'),
  currentWeatherCode: z.number().describe("Original WMO weather code for current conditions for icon mapping"),
  hourlyForecast: z.array(HourlyForecastItemSchema).optional().describe("Array of hourly forecast items for the first 12 available hours."),
  dailyForecast: z.array(DailyForecastItemSchema).optional().describe("Array of daily forecast items for the next 7 days."),
  dataTimestamp: z.string().describe('ISO string timestamp of when the data was fetched/generated.'),
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

// Simplified AI schema. It only generates the summary.
const AIWeatherProcessingSchema = z.object({
  summary: z.string().describe('A concise, one-sentence summary in TURKISH about the current weather, incorporating the current conditions and temperature.'),
});

// WMO code translation is now done in code, not by the AI.
const wmoCodeMap: Record<number, string> = {
    0: 'Açık', 1: 'Genellikle Açık', 2: 'Parçalı Bulutlu', 3: 'Çok Bulutlu/Kapalı',
    45: 'Sisli', 48: 'Kırağı Sisi',
    51: 'Hafif Çiseleme', 53: 'Orta Yoğunlukta Çiseleme', 55: 'Yoğun Çiseleme',
    56: 'Hafif Donan Çiseleme', 57: 'Yoğun Donan Çiseleme',
    61: 'Hafif Yağmur', 63: 'Orta Yağmur', 65: 'Şiddetli Yağmur',
    66: 'Hafif Donan Yağmur', 67: 'Şiddetli Donan Yağmur',
    71: 'Hafif Kar Yağışı', 73: 'Orta Yoğunlukta Kar Yağışı', 75: 'Yoğun Kar Yağışı',
    77: 'Kar Taneleri',
    80: 'Hafif Sağanak Yağmur', 81: 'Orta Sağanak Yağmur', 82: 'Şiddetli Sağanak Yağmur',
    85: 'Hafif Kar Sağanağı', 86: 'Yoğun Kar Sağanağı',
    95: 'Gök Gürültülü Fırtına', 96: 'Hafif Dolu ile Gök Gürültülü Fırtına', 99: 'Şiddetli Dolu ile Gök Gürültülü Fırtına'
};
const getWmoCondition = (code: number): string => wmoCodeMap[code] || 'Bilinmiyor';

let lastSuccessfulWeather: WeatherSummaryOutput | null = null;
let lastSuccessfulFetchTime: Date | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

// Simplified prompt for the AI.
const formatOpenMeteoDataPrompt = ai.definePrompt({
  name: 'formatOpenMeteoDataPrompt',
  input: {schema: z.object({
    location: z.string(),
    currentConditions: z.string(),
    currentTemperature: z.number(),
  })},
  output: {schema: AIWeatherProcessingSchema},
  prompt: `You are a weather report assistant. Your job is to generate a concise, one-sentence weather summary in TURKISH.

Based on the following real-time data for {{{location}}}:
Current Conditions: "{{{currentConditions}}}"
Current Temperature: {{currentTemperature}}°C

Generate a natural-sounding, one-sentence 'summary'.
Example: "Bugün Domaniç'te hava parçalı bulutlu ve sıcaklık 22.5°C."
Another example: "Domaniç için güncel hava durumu: hafif yağmurlu ve sıcaklık 15°C civarında."
`,
});

const summarizeWeatherFlow = ai.defineFlow(
  {
    name: 'summarizeWeatherFlow',
    inputSchema: WeatherSummaryInputSchema,
    outputSchema: WeatherSummaryOutputSchema,
  },
  async (flowInput) => {
    const now = new Date();

    if (lastSuccessfulWeather && lastSuccessfulFetchTime && (now.getTime() - lastSuccessfulFetchTime.getTime() < CACHE_DURATION_MS)) {
      console.log(`[WeatherSummarization] Returning cached weather data from ${lastSuccessfulFetchTime.toISOString()}`);
      return { ...lastSuccessfulWeather, dataTimestamp: lastSuccessfulFetchTime.toISOString() };
    }
    console.log(`[WeatherSummarization] Cache expired or no cache (last fetch: ${lastSuccessfulFetchTime?.toISOString() || 'N/A'}). Attempting to fetch new weather data.`);

    if (flowInput.location.toLowerCase() !== 'domaniç') {
      throw new Error('Weather data is only available for the Domanic location.');
    }

    const lat = 39.80; // Domaniç, Kütahya
    const lon = 29.60;
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe/Istanbul&forecast_days=7&forecast_hours=48&windspeed_unit=kmh&precipitation_unit=mm`;

    let apiResponseData;
    try {
      const response = await fetch(apiUrl, { cache: 'no-store' });
      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[WeatherSummarization] Open-Meteo API Error:", response.status, errorBody);
        throw new Error(`Failed to get weather data from Open-Meteo API: ${response.status} ${response.statusText}`);
      }
      apiResponseData = await response.json();
    } catch (error: any) {
      console.error("[WeatherSummarization] Open-Meteo fetch/parse error:", error);
      if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
        console.warn("[WeatherSummarization] API fetch failed, serving stale data due to error:", error.message);
        return { 
          ...lastSuccessfulWeather, 
          summary: `(Veriler güncellenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
          dataTimestamp: lastSuccessfulFetchTime.toISOString() 
        };
      }
      throw new Error("Could not retrieve weather data and no cached data is available. Please try again later.");
    }
    
    if (!apiResponseData.current || 
        typeof apiResponseData.current.temperature_2m !== 'number' ||
        typeof apiResponseData.current.relativehumidity_2m !== 'number' ||
        typeof apiResponseData.current.windspeed_10m !== 'number' ||
        typeof apiResponseData.current.weathercode !== 'number') {
      console.error("[WeatherSummarization] Open-Meteo response missing expected current weather data:", apiResponseData);
       if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
        console.warn("[WeatherSummarization] Invalid API response, serving stale data.");
        return { 
          ...lastSuccessfulWeather, 
          summary: `(Veriler işlenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
          dataTimestamp: lastSuccessfulFetchTime.toISOString() 
        };
      }
      throw new Error("Incomplete current weather data received from Open-Meteo and no data in cache.");
    }
    
    const currentConditionsText = getWmoCondition(apiResponseData.current.weathercode);

    const hasHourly = apiResponseData.hourly && apiResponseData.hourly.time && Array.isArray(apiResponseData.hourly.time);
    const hasDaily = apiResponseData.daily && apiResponseData.daily.time && Array.isArray(apiResponseData.daily.time);
    
    const hourlyForecastConditions = hasHourly ? apiResponseData.hourly.weathercode.slice(0, 12).map(getWmoCondition) : [];
    const dailyForecastConditions = hasDaily ? apiResponseData.daily.time.map((_: any, i: number) => getWmoCondition(apiResponseData.daily.weathercode[i])) : [];
    
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let attempts = 0;
    let aiOutput: z.infer<typeof AIWeatherProcessingSchema> | undefined;

    while (attempts < MAX_RETRIES) {
      try {
        const {output} = await formatOpenMeteoDataPrompt({
            location: flowInput.location,
            currentConditions: currentConditionsText,
            currentTemperature: apiResponseData.current.temperature_2m,
        });
        aiOutput = output;
        if (!aiOutput?.summary) {
            throw new Error("The weather summarization prompt did not return a valid summary.");
        }
        break; // AI call was successful
      } catch (e: any) {
        attempts++;
        const rawErrorMessage = e.message || "Unknown AI error";
        console.warn(`[WeatherSummarization] AI Model error (Attempt ${attempts}/${MAX_RETRIES}): ${rawErrorMessage}.`);
        if (attempts < MAX_RETRIES) {
           await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    let finalSummary: string;
    if (aiOutput?.summary) {
        finalSummary = aiOutput.summary;
        console.log("[WeatherSummarization] Successfully generated summary with AI.");
    } else {
        finalSummary = `${currentConditionsText}, sıcaklık ${apiResponseData.current.temperature_2m}°C.`;
        console.warn("[WeatherSummarization] AI summary generation failed after all retries. Using default summary string.");
    }
    
    const currentTimestamp = new Date();
    const formattedOutput: WeatherSummaryOutput = {
        summary: finalSummary,
        temperature: `${apiResponseData.current.temperature_2m}°C`,
        humidity: `${apiResponseData.current.relativehumidity_2m}%`,
        windSpeed: `${apiResponseData.current.windspeed_10m} km/h`,
        conditions: currentConditionsText,
        currentWeatherCode: apiResponseData.current.weathercode,
        hourlyForecast: hasHourly ? apiResponseData.hourly.time.slice(0,12).map((t: string, i: number) => ({
            time: new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            temperature: `${apiResponseData.hourly.temperature_2m[i]}°C`,
            precipitationProbability: `${apiResponseData.hourly.precipitation_probability[i]}%`,
            conditions: hourlyForecastConditions[i] || 'Bilinmiyor',
            windSpeed: `${apiResponseData.hourly.windspeed_10m[i]} km/h`,
            weatherCode: apiResponseData.hourly.weathercode[i],
        })) : [],
        dailyForecast: hasDaily ? apiResponseData.daily.time.map((d: string, i: number) => ({
            date: new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }),
            maxTemperature: `${apiResponseData.daily.temperature_2m_max[i]}°C`,
            minTemperature: `${apiResponseData.daily.temperature_2m_min[i]}°C`,
            precipitationSum: apiResponseData.daily.precipitation_sum[i] > 0 ? `${apiResponseData.daily.precipitation_sum[i]} mm` : "Yağış yok",
            conditions: dailyForecastConditions[i] || 'Bilinmiyor',
            weatherCode: apiResponseData.daily.weathercode[i],
        })) : [],
        dataTimestamp: currentTimestamp.toISOString(),
    };

    lastSuccessfulWeather = formattedOutput;
    lastSuccessfulFetchTime = currentTimestamp;
    console.log(`[WeatherSummarization] Successfully fetched and processed new weather data at ${lastSuccessfulFetchTime.toISOString()}.`);
    
    return formattedOutput;
  }
);

    