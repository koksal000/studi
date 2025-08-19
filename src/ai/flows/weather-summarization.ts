
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
  apparentTemperature: z.string().describe("Formatted apparent temperature (e.g., '14°C')"),
  uvIndex: z.string().describe("UV Index value (e.g., '3.4')"),
  windDirection: z.string().describe("Wind direction in degrees (e.g., '180°')"),
});

const DailyForecastItemSchema = z.object({
  date: z.string().describe("Formatted date for the forecast (e.g., 'Sal, 25 Tem')"),
  maxTemperature: z.string().describe("Formatted maximum temperature (e.g., '22°C')"),
  minTemperature: z.string().describe("Formatted minimum temperature (e.g., '12°C')"),
  precipitationSum: z.string().describe("Formatted precipitation sum (e.g., '5 mm')"),
  conditions: z.string().describe("Human-readable weather conditions in Turkish (e.g., 'Sağanak Yağmur')"),
  weatherCode: z.number().describe("Original WMO weather code for icon mapping"),
  uvIndexMax: z.string().describe("Maximum daily UV Index (e.g., '5.5')"),
  windSpeedMax: z.string().describe("Maximum daily wind speed (e.g., '25 km/h')"),
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
  aiCommentary: z.string().describe('AI-generated commentary about the weather, including warnings and future outlook in Turkish.').optional(),
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

// AI schema for generating summary and commentary
const AIWeatherProcessingSchema = z.object({
  summary: z.string().describe('A concise, one-sentence summary in TURKISH about the current weather.'),
  commentary: z.string().describe('A detailed commentary in TURKISH. Include warnings for high/low temps, high wind, and precipitation. Also, provide a brief outlook for the coming week based on temperature trends in the daily forecast data.').optional(),
});

// WMO code translation
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
const getWindDirectionArrow = (degrees: number) => {
    const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return directions[Math.round(degrees / 45) % 8];
};

let lastSuccessfulWeather: WeatherSummaryOutput | null = null;
let lastSuccessfulFetchTime: Date | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

const formatOpenMeteoDataPrompt = ai.definePrompt({
  name: 'formatOpenMeteoDataPrompt',
  input: {schema: z.object({
    location: z.string(),
    current_weather: z.any(),
    daily_forecast: z.any(),
  })},
  output: {schema: AIWeatherProcessingSchema},
  prompt: `You are a weather report assistant for the village of {{{location}}} in Turkey. Your job is to generate a concise summary and a helpful commentary based on the provided weather data. Your response MUST be in Turkish.

Current Weather Data:
{{{json current_weather}}}

7-Day Forecast Data:
{{{json daily_forecast}}}

Tasks:
1.  **Summary:** Create a one-sentence summary of the current weather conditions.
    Example: "Bugün Domaniç'te hava parçalı bulutlu ve sıcaklık 22.5°C."

2.  **Commentary:** Based on ALL the data provided, generate a helpful commentary including:
    *   **Warnings:**
        *   If any day's max temperature is > 30°C, include a heat warning.
        *   If any day's min temperature is < 10°C, include a cold warning.
        *   If any day's max wind speed is > 20 km/h, include a wind warning.
        *   If there is significant precipitation (rain/snow) today or in the forecast, mention it.
    *   **Outlook:** Briefly describe the temperature trend for the coming week. Is it getting warmer, colder, or staying the same?
    *   Combine these points into a natural, paragraph-style commentary.

Example Commentary: "Sıcak hava uyarısı: Hafta boyunca sıcaklıklar 30°C'nin üzerinde seyredecek, bol su tüketmeyi unutmayın. Rüzgar zaman zaman 20 km/s'yi aşabilir. Genel olarak önümüzdeki hafta sıcak ve kuru geçecek gibi görünüyor."
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
    console.log(`[WeatherSummarization] Cache expired or no cache. Fetching new data.`);

    if (flowInput.location.toLowerCase() !== 'domaniç') {
      throw new Error('Weather data is only available for the Domanic location.');
    }

    const lat = 39.80;
    const lon = 29.60;
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m,apparent_temperature,uv_index,winddirection_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,windspeed_10m_max&timezone=Europe/Istanbul&forecast_days=7&forecast_hours=48&windspeed_unit=kmh&precipitation_unit=mm`;
    
    let apiResponseData;
    try {
      const response = await fetch(apiUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to get weather data from Open-Meteo API: ${response.status} ${response.statusText}`);
      apiResponseData = await response.json();
    } catch (error: any) {
      console.error("[WeatherSummarization] API fetch/parse error:", error);
      if (lastSuccessfulWeather && lastSuccessfulFetchTime) {
        console.warn("[WeatherSummarization] API fetch failed, serving stale data.");
        return { 
          ...lastSuccessfulWeather, 
          summary: `(Veriler güncellenemedi, en son ${lastSuccessfulFetchTime.toLocaleTimeString('tr-TR')} itibarıyla) ${lastSuccessfulWeather.summary}`,
          dataTimestamp: lastSuccessfulFetchTime.toISOString() 
        };
      }
      throw new Error("Could not retrieve weather data and no cached data is available.");
    }
    
    const { current, hourly, daily } = apiResponseData;
    if (!current || typeof current.temperature_2m !== 'number') {
        throw new Error("Incomplete current weather data received from Open-Meteo.");
    }
    
    let aiOutput: z.infer<typeof AIWeatherProcessingSchema> | undefined;

    try {
        const {output} = await formatOpenMeteoDataPrompt({
            location: flowInput.location,
            current_weather: {
                temperature: current.temperature_2m,
                condition: getWmoCondition(current.weathercode),
                wind_speed: current.windspeed_10m
            },
            daily_forecast: {
                dates: daily.time,
                max_temperatures: daily.temperature_2m_max,
                min_temperatures: daily.temperature_2m_min,
                precipitation_sums: daily.precipitation_sum,
                max_wind_speeds: daily.windspeed_10m_max,
                conditions: daily.weathercode.map(getWmoCondition),
            }
        });
        aiOutput = output;
        if (!aiOutput?.summary) {
            throw new Error("AI did not return a valid summary.");
        }
    } catch (e: any) {
        console.warn(`[WeatherSummarization] AI Model error: ${e.message}.`);
        // We can still proceed without AI commentary.
    }
    
    const currentTimestamp = new Date();
    const formattedOutput: WeatherSummaryOutput = {
        summary: aiOutput?.summary || `${getWmoCondition(current.weathercode)}, sıcaklık ${current.temperature_2m}°C.`,
        temperature: `${current.temperature_2m}°C`,
        humidity: `${current.relativehumidity_2m}%`,
        windSpeed: `${current.windspeed_10m} km/h`,
        conditions: getWmoCondition(current.weathercode),
        currentWeatherCode: current.weathercode,
        aiCommentary: aiOutput?.commentary,
        hourlyForecast: hourly?.time?.slice(0,24).map((t: string, i: number) => ({
            time: new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            temperature: `${hourly.temperature_2m[i]}°C`,
            precipitationProbability: `${hourly.precipitation_probability[i]}%`,
            conditions: getWmoCondition(hourly.weathercode[i]),
            windSpeed: `${hourly.windspeed_10m[i]} km/h`,
            weatherCode: hourly.weathercode[i],
            apparentTemperature: `${hourly.apparent_temperature[i]}°C`,
            uvIndex: `${hourly.uv_index[i]}`,
            windDirection: `${getWindDirectionArrow(hourly.winddirection_10m[i])} ${hourly.winddirection_10m[i]}°`
        })) || [],
        dailyForecast: daily?.time?.map((d: string, i: number) => ({
            date: new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }),
            maxTemperature: `${daily.temperature_2m_max[i]}°C`,
            minTemperature: `${daily.temperature_2m_min[i]}°C`,
            precipitationSum: daily.precipitation_sum[i] > 0 ? `${daily.precipitation_sum[i]} mm` : "Yağış yok",
            conditions: getWmoCondition(daily.weathercode[i]),
            weatherCode: daily.weathercode[i],
            uvIndexMax: `${daily.uv_index_max[i]}`,
            windSpeedMax: `${daily.windspeed_10m_max[i]} km/h`,
        })) || [],
        dataTimestamp: currentTimestamp.toISOString(),
    };

    lastSuccessfulWeather = formattedOutput;
    lastSuccessfulFetchTime = currentTimestamp;
    console.log(`[WeatherSummarization] Successfully processed new weather data at ${lastSuccessfulFetchTime.toISOString()}.`);
    
    return formattedOutput;
  }
);
