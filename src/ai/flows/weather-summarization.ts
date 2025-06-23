
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
  hourlyForecast: z.array(HourlyForecastItemSchema).optional().describe("Array of hourly forecast items for the first 12 available hours. Format time in 'HH:mm'. Temperature with °C. Precipitation probability with '%'. Wind speed with 'km/h'. Translate conditions to Turkish."),
  dailyForecast: z.array(DailyForecastItemSchema).optional().describe("Array of daily forecast items for the next 7 days. Format date as 'KısaGünAdı, Gün AyAdıKısaltılmış' (e.g., 'Sal, 25 Tem') in Turkish. Temperatures with °C. Precipitation sum with 'mm'. Translate conditions to Turkish."),
  dataTimestamp: z.string().describe('ISO string timestamp of when the data was fetched/generated.'),
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

let lastSuccessfulWeather: WeatherSummaryOutput | null = null;
let lastSuccessfulFetchTime: Date | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

const formatOpenMeteoDataPrompt = ai.definePrompt({
  name: 'formatOpenMeteoDataPrompt',
  input: {schema: OpenMeteoApiDataSchema},
  output: {schema: WeatherSummaryOutputSchema.omit({ dataTimestamp: true })}, // AI doesn't need to generate dataTimestamp
  prompt: `You are a weather report formatter. Based on the following real-time data for {{{location}}}:
Current Weather Data:
  Raw Temperature: {{current.temperature}}°C
  Raw Humidity: {{current.humidity}}%
  Raw Wind Speed: {{current.windspeed}} km/h
  Raw Weather Code: {{current.weathercode}}

{{#if hourly}}
Hourly Forecast Data (process first 12 entries if available):
  Times: {{#each hourly.time as |t|}}{{t}}, {{/each}}
  Temperatures: {{#each hourly.temperature_2m as |t|}}{{t}}°C, {{/each}}
  Precipitation Probabilities: {{#each hourly.precipitation_probability as |p|}}{{p}}%, {{/each}}
  Weather Codes: {{#each hourly.weathercode as |wc|}}{{wc}}, {{/each}}
  Wind Speeds: {{#each hourly.windspeed_10m as |ws|}}{{ws}} km/h, {{/each}}
{{/if}}

{{#if daily}}
Daily Forecast Data (for all available days, up to 7):
  Dates: {{#each daily.time as |d|}}{{d}}, {{/each}}
  Max Temperatures: {{#each daily.temperature_2m_max as |tmax|}}{{tmax}}°C, {{/each}}
  Min Temperatures: {{#each daily.temperature_2m_min as |tmin|}}{{tmin}}°C, {{/each}}
  Precipitation Sums: {{#each daily.precipitation_sum as |psum|}}{{psum}}mm, {{/each}}
  Weather Codes: {{#each daily.weathercode as |dwc|}}{{dwc}}, {{/each}}
{{/if}}

Use the WMO Weather Interpretation Codes (Turkish translations provided) to determine the 'conditions' string:
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
95: Gök Gürültülü Fırtına (hafif veya orta)
96: Hafif Dolu ile Gök Gürültülü Fırtına
99: Şiddetli Dolu ile Gök Gürültülü Fırtına

Generate a weather report in TURKISH, strictly conforming to the output schema.

For CURRENT weather:
- 'temperature': Raw temperature value formatted as a string with '°C' (e.g., "22.5°C").
- 'humidity': Raw humidity value formatted as a string with '%' (e.g., "60%").
- 'windSpeed': Raw wind speed value formatted as a string with 'km/h' (e.g., "15.3 km/h").
- 'conditions': Human-readable Turkish string derived from the current weather code.
- 'currentWeatherCode': The raw WMO weather code for current conditions.
- 'summary': Concise, human-readable Turkish sentence describing the overall current weather, incorporating conditions and temperature. Example: "Parçalı bulutlu ve sıcaklık 22.5°C."

For 'hourlyForecast' array (process the first 12 entries from the provided hourly data arrays, if available):
  For each item:
  - 'time': Format the ISO time string from 'hourly.time[i]' to 'HH:mm' (e.g., '14:00').
  - 'temperature': Format 'hourly.temperature_2m[i]' as a string with '°C'.
  - 'precipitationProbability': Format 'hourly.precipitation_probability[i]' as a string with '%'.
  - 'conditions': Convert 'hourly.weathercode[i]' to a concise Turkish weather description using the WMO code list.
  - 'windSpeed': Format 'hourly.windspeed_10m[i]' as a string with ' km/h'.
  - 'weatherCode': The raw WMO code 'hourly.weathercode[i]'.

For 'dailyForecast' array (for the next 7 days from the provided daily data arrays, if available):
  For each item:
  - 'date': Format the ISO date string from 'daily.time[i]' to 'KısaGünAdı, Gün AyAdıKısaltılmış' (e.g., 'Sal, 25 Tem') in Turkish. For example, 2024-07-25 should be 'Per, 25 Tem'.
  - 'maxTemperature': Format 'daily.temperature_2m_max[i]' as a string with '°C'.
  - 'minTemperature': Format 'daily.temperature_2m_min[i]' as a string with '°C'.
  - 'precipitationSum': Format 'daily.precipitation_sum[i]' as a string with ' mm'. If 0, use "Yağış yok".
  - 'conditions': Convert 'daily.weathercode[i]' to a concise Turkish weather description using the WMO code list.
  - 'weatherCode': The raw WMO code 'daily.weathercode[i]'.

If hourly or daily forecast data is not available in the input, return empty or undefined arrays for 'hourlyForecast' and 'dailyForecast' respectively in the output.
Provide all text in Turkish.
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
      throw new Error('Weather data is currently only available for Domaniç.');
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
        time: apiResponseData.hourly.time,
        temperature_2m: apiResponseData.hourly.temperature_2m,
        precipitation_probability: apiResponseData.hourly.precipitation_probability,
        weathercode: apiResponseData.hourly.weathercode,
        windspeed_10m: apiResponseData.hourly.windspeed_10m,
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
    let aiOutput: WeatherSummaryOutput | undefined;

    while (attempts < MAX_RETRIES) {
      try {
        const {output} = await formatOpenMeteoDataPrompt(promptInputData);
        aiOutput = output; // Assign to aiOutput
        if (!aiOutput) { // Check aiOutput
            throw new Error("The weather summarization prompt did not return an output.");
        }
        
        const currentTimestamp = new Date().toISOString();
        lastSuccessfulWeather = { 
            ...aiOutput, 
            currentWeatherCode: apiResponseData.current.weathercode, 
            dataTimestamp: currentTimestamp 
        };
        lastSuccessfulFetchTime = new Date(currentTimestamp); // This is the actual fetch time of this successful operation
        console.log(`[WeatherSummarization] Successfully fetched and processed new weather data at ${lastSuccessfulFetchTime.toISOString()}.`);
        return { ...lastSuccessfulWeather }; // Return a copy

      } catch (e: any) {
        attempts++;
        const errorMessage = e.message || "";
        const isServiceUnavailable = errorMessage.includes("503") && errorMessage.includes("Service Unavailable");
        const isEmptyOutput = errorMessage.includes("The weather summarization prompt did not return an output.");

        if ((isServiceUnavailable || isEmptyOutput) && attempts < MAX_RETRIES) {
          console.warn(`[WeatherSummarization] AI Model error (Attempt ${attempts}/${MAX_RETRIES}): ${errorMessage}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          console.error("[WeatherSummarization] Error calling formatOpenMeteoDataPrompt after all retries or for non-retryable error:", e);
          if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
            console.warn("[WeatherSummarization] AI processing failed, serving stale data due to error:", e.message);
            return { 
              ...lastSuccessfulWeather, 
              summary: `(Veriler işlenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
              dataTimestamp: lastSuccessfulFetchTime.toISOString() 
            };
          }
          if (isServiceUnavailable) throw new Error("The weather model is currently overloaded and no cache is available. Please try again later.");
          throw new Error(errorMessage || "An unknown error occurred while generating weather summary and no cache is available.");
        }
      }
    }
    // Fallback if loop finishes - should be caught by error throwing inside, but for safety:
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
);

    
