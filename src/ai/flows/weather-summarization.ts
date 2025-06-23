
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

const OpenMeteoApiDataSchema = z.object({
  location: z.string().describe('The target location, e.g., Domaniç'),
  current: z.object({
    temperature: z.number().describe('Current temperature in Celsius'),
    humidity: z.number().describe('Current relative humidity in percent'),
    windspeed: z.number().describe('Current wind speed in km/h'),
    weathercode: z.number().describe('Current WMO weather interpretation code'),
  }),
  hourly: z.object({
    time: z.array(z.string()).describe('Array of ISO8601 timestamps for hourly forecast'),
    temperature_2m: z.array(z.number()).describe('Array of hourly temperatures at 2m in Celsius'),
    precipitation_probability: z.array(z.number()).describe('Array of hourly precipitation probabilities in percent'),
    weathercode: z.array(z.number()).describe('Array of hourly WMO weather codes'),
    windspeed_10m: z.array(z.number()).describe('Array of hourly wind speeds at 10m in km/h'),
  }).optional().describe("Hourly forecast data from Open-Meteo for the next 48 hours."),
  daily: z.object({
    time: z.array(z.string()).describe('Array of ISO8601 dates for daily forecast'),
    weathercode: z.array(z.number()).describe('Array of daily WMO weather codes'),
    temperature_2m_max: z.array(z.number()).describe('Array of daily maximum temperatures at 2m in Celsius'),
    temperature_2m_min: z.array(z.number()).describe('Array of daily minimum temperatures at 2m in Celsius'),
    precipitation_sum: z.array(z.number()).describe('Array of daily precipitation sum in mm'),
  }).optional().describe("Daily forecast data from Open-Meteo for the next 7 days."),
});
export type OpenMeteoApiData = z.infer<typeof OpenMeteoApiDataSchema>;


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

// Intermediate schema for what the AI will actually generate.
const AIWeatherProcessingSchema = z.object({
  summary: z.string().describe('A concise summary of the current weather conditions in Turkish.'),
  currentConditions: z.string().describe('The current weather conditions in Turkish, translated from the provided WMO code.'),
  hourlyForecastConditions: z.array(z.string()).describe("An array of Turkish weather conditions for the hourly forecast, translated from the WMO codes. The array length must match the input array length."),
  dailyForecastConditions: z.array(z.string()).describe("An array of Turkish weather conditions for the daily forecast, translated from the WMO codes. The array length must match the input array length."),
});

let lastSuccessfulWeather: WeatherSummaryOutput | null = null;
let lastSuccessfulFetchTime: Date | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

const formatOpenMeteoDataPrompt = ai.definePrompt({
  name: 'formatOpenMeteoDataPrompt',
  input: {schema: OpenMeteoApiDataSchema},
  output: {schema: AIWeatherProcessingSchema}, // AI outputs the intermediate schema
  prompt: `You are a weather report assistant. Your job is to summarize and translate weather data into TURKISH.

Based on the following real-time data for {{{location}}}:
Current Weather Code: {{current.weathercode}}
Current Temperature: {{current.temperature}}°C

{{#if hourly}}
Hourly Forecast Weather Codes: {{#each hourly.weathercode as |wc|}}{{wc}}, {{/each}}
{{/if}}

{{#if daily}}
Daily Forecast Weather Codes: {{#each daily.weathercode as |dwc|}}{{dwc}}, {{/each}}
{{/if}}

Use this WMO Weather Code to Turkish translation map:
0: Açık
1: Genellikle Açık
2: Parçalı Bulutlu
3: Çok Bulutlu/Kapalı
45: Sisli
48: Kırağı Sisi
51: Hafif Çiseleme
53: Orta Yoğunlukta Çiseleme
55: Yoğun Çiseleme
56: Hafif Donan Çiseleme
57: Yoğun Donan Çiseleme
61: Hafif Yağmur
63: Orta Yağmur
65: Şiddetli Yağmur
66: Hafif Donan Yağmur
67: Şiddetli Donan Yağmur
71: Hafif Kar Yağışı
73: Orta Yoğunlukta Kar Yağışı
75: Yoğun Kar Yağışı
77: Kar Taneleri
80: Hafif Sağanak Yağmur
81: Orta Sağanak Yağmur
82: Şiddetli Sağanak Yağmur
85: Hafif Kar Sağanağı
86: Yoğun Kar Sağanağı
95: Gök Gürültülü Fırtına
96: Hafif Dolu ile Gök Gürültülü Fırtına
99: Şiddetli Dolu ile Gök Gürültülü Fırtına

Your tasks:
1.  Generate a concise, one-sentence 'summary' in TURKISH about the current weather, incorporating the current conditions and temperature. Example: "Parçalı bulutlu ve sıcaklık 22.5°C."
2.  Provide the Turkish translation for the 'currentConditions' based on the 'current.weathercode'.
3.  For each code in 'hourly.weathercode', provide a corresponding array of Turkish translations in 'hourlyForecastConditions'. The output array length must match the input array length. If hourly data is not present, return an empty array.
4.  For each code in 'daily.weathercode', provide a corresponding array of Turkish translations in 'dailyForecastConditions'. The output array length must match the input array length. If daily data is not present, return an empty array.
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

    const hasHourly = apiResponseData.hourly && apiResponseData.hourly.time && Array.isArray(apiResponseData.hourly.time);
    const hasDaily = apiResponseData.daily && apiResponseData.daily.time && Array.isArray(apiResponseData.daily.time);

    const promptInputData: OpenMeteoApiData = {
      location: flowInput.location,
      current: {
        temperature: apiResponseData.current.temperature_2m,
        humidity: apiResponseData.current.relativehumidity_2m,
        windspeed: apiResponseData.current.windspeed_10m,
        weathercode: apiResponseData.current.weathercode,
      },
      hourly: hasHourly ? {
        time: apiResponseData.hourly.time.slice(0, 12),
        temperature_2m: apiResponseData.hourly.temperature_2m.slice(0, 12),
        precipitation_probability: apiResponseData.hourly.precipitation_probability.slice(0, 12),
        weathercode: apiResponseData.hourly.weathercode.slice(0, 12),
        windspeed_10m: apiResponseData.hourly.windspeed_10m.slice(0, 12),
      } : undefined,
      daily: hasDaily ? {
        time: apiResponseData.daily.time,
        weathercode: apiResponseData.daily.weathercode,
        temperature_2m_max: apiResponseData.daily.temperature_2m_max,
        temperature_2m_min: apiResponseData.daily.temperature_2m_min,
        precipitation_sum: apiResponseData.daily.precipitation_sum,
      } : undefined,
    };

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let attempts = 0;
    let aiOutput: z.infer<typeof AIWeatherProcessingSchema> | undefined;

    while (attempts < MAX_RETRIES) {
      try {
        const {output} = await formatOpenMeteoDataPrompt(promptInputData);
        aiOutput = output;
        if (!aiOutput) {
            throw new Error("The weather summarization prompt did not return an output.");
        }
        
        // AI call was successful, break the loop
        break;

      } catch (e: any) {
        attempts++;
        const rawErrorMessage = e.message || "Unknown error";
        
        const isServiceUnavailable = rawErrorMessage.includes("503") || rawErrorMessage.includes("Service Unavailable");
        const isEmptyOutput = rawErrorMessage.includes("The weather summarization prompt did not return an output.");

        if ((isServiceUnavailable || isEmptyOutput) && attempts < MAX_RETRIES) {
          console.warn(`[WeatherSummarization] AI Model error (Attempt ${attempts}/${MAX_RETRIES}): ${rawErrorMessage}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          console.error(`[WeatherSummarization] AI processing error after ${attempts} attempts:`, rawErrorMessage);
          
          if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
            console.warn("[WeatherSummarization] AI processing failed, serving stale data.");
            return { 
              ...lastSuccessfulWeather, 
              summary: `(Veriler güncellenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
              dataTimestamp: lastSuccessfulFetchTime.toISOString() 
            };
          }
          
          if (isServiceUnavailable) {
            throw new Error("AI weather service is unavailable and no cached data exists.");
          }
          throw new Error("Failed to generate weather summary and no cached data exists.");
        }
      }
    }

    if (!aiOutput) {
        if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
            console.warn("[WeatherSummarization] Reached end of AI retry loop, serving stale data.");
            return { 
              ...lastSuccessfulWeather, 
              summary: `(Veriler alınamadı/işlenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
              dataTimestamp: lastSuccessfulFetchTime.toISOString()
            };
        }
        throw new Error("Could not generate weather summary after maximum retries and no cache is available.");
    }
    
    // AI call was successful, now format the data in TypeScript
    const currentTimestamp = new Date();
    const formattedOutput: WeatherSummaryOutput = {
        summary: aiOutput.summary,
        temperature: `${promptInputData.current.temperature}°C`,
        humidity: `${promptInputData.current.humidity}%`,
        windSpeed: `${promptInputData.current.windSpeed} km/h`,
        conditions: aiOutput.currentConditions,
        currentWeatherCode: promptInputData.current.weathercode,
        hourlyForecast: promptInputData.hourly?.time.map((t, i) => ({
            time: new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            temperature: `${promptInputData.hourly!.temperature_2m[i]}°C`,
            precipitationProbability: `${promptInputData.hourly!.precipitation_probability[i]}%`,
            conditions: aiOutput.hourlyForecastConditions[i] || 'Bilinmiyor',
            windSpeed: `${promptInputData.hourly!.windspeed_10m[i]} km/h`,
            weatherCode: promptInputData.hourly!.weathercode[i],
        })) || [],
        dailyForecast: promptInputData.daily?.time.map((d, i) => ({
            date: new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }),
            maxTemperature: `${promptInputData.daily!.temperature_2m_max[i]}°C`,
            minTemperature: `${promptInputData.daily!.temperature_2m_min[i]}°C`,
            precipitationSum: promptInputData.daily!.precipitation_sum[i] > 0 ? `${promptInputData.daily!.precipitation_sum[i]} mm` : "Yağış yok",
            conditions: aiOutput.dailyForecastConditions[i] || 'Bilinmiyor',
            weatherCode: promptInputData.daily!.weathercode[i],
        })) || [],
        dataTimestamp: currentTimestamp.toISOString(),
    };

    lastSuccessfulWeather = formattedOutput;
    lastSuccessfulFetchTime = currentTimestamp;
    console.log(`[WeatherSummarization] Successfully fetched and processed new weather data at ${lastSuccessfulFetchTime.toISOString()}.`);
    
    return formattedOutput;
  }
);
