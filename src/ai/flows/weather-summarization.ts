
'use server';

/**
 * @fileOverview Fetches and summarizes current weather conditions for Domaniç using Open-Meteo API.
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

const WeatherSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the current weather conditions.'),
  temperature: z.string().describe('The current temperature in Celsius, formatted with °C.'),
  humidity: z.string().describe('The current humidity percentage, formatted with %.'),
  windSpeed: z.string().describe('The current wind speed in km/h, formatted with km/h.'),
  conditions: z.string().describe('Overall weather conditions (e.g., Sunny, Partly Cloudy, Rainy).'),
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

// Schema for the data fetched from Open-Meteo, to be passed to the prompt
const OpenMeteoDataSchema = z.object({
  api_temperature: z.number().describe('Temperature in Celsius from Open-Meteo'),
  api_humidity: z.number().describe('Relative humidity in percent from Open-Meteo'),
  api_windspeed: z.number().describe('Wind speed in km/h from Open-Meteo'),
  api_weathercode: z.number().describe('WMO weather interpretation code from Open-Meteo'),
  location: z.string().describe('The target location, e.g., Domaniç'),
});

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

const formatOpenMeteoDataPrompt = ai.definePrompt({
  name: 'formatOpenMeteoDataPrompt',
  input: {schema: OpenMeteoDataSchema},
  output: {schema: WeatherSummaryOutputSchema},
  prompt: `You are a weather report formatter. Based on the following real-time data for {{{location}}}:
Raw Temperature: {{api_temperature}}°C
Raw Humidity: {{api_humidity}}%
Raw Wind Speed: {{api_windspeed}} km/h
Raw Weather Code: {{api_weathercode}}

Use the WMO Weather Interpretation Codes to determine the 'conditions' string:
0: Clear sky
1: Mainly clear
2: Partly cloudy
3: Overcast
45: Fog
48: Depositing rime fog
51: Light drizzle
53: Moderate drizzle
55: Dense drizzle
56: Light freezing drizzle
57: Dense freezing drizzle
61: Slight rain
63: Moderate rain
65: Heavy rain
66: Light freezing rain
67: Heavy freezing rain
71: Slight snow fall
73: Moderate snow fall
75: Heavy snow fall
77: Snow grains
80: Slight rain showers
81: Moderate rain showers
82: Violent rain showers
85: Slight snow showers
86: Heavy snow showers
95: Thunderstorm (slight or moderate)
96: Thunderstorm with slight hail
99: Thunderstorm with heavy hail

Generate a weather report strictly conforming to the output schema.
- The 'temperature' field in the output must be the raw temperature value formatted as a string with '°C' appended (e.g., "22.5°C").
- The 'humidity' field in the output must be the raw humidity value formatted as a string with '%' appended (e.g., "60%").
- The 'windSpeed' field in the output must be the raw wind speed value formatted as a string with 'km/h' appended (e.g., "15.3 km/h").
- The 'conditions' field must be a human-readable string derived from the weather code (e.g., "Partly cloudy", "Moderate rain").
- The 'summary' field must be a concise, human-readable sentence describing the overall weather, incorporating the conditions and temperature. Example: "Partly cloudy with a temperature of 22.5°C."
`,
});

const summarizeWeatherFlow = ai.defineFlow(
  {
    name: 'summarizeWeatherFlow',
    inputSchema: WeatherSummaryInputSchema,
    outputSchema: WeatherSummaryOutputSchema,
  },
  async (flowInput) => {
    if (flowInput.location.toLowerCase() !== 'domaniç') {
      // Or handle other locations if geocoding is implemented in the future
      throw new Error('Weather data is currently only available for Domaniç.');
    }

    const lat = 39.80; // Domaniç, Kütahya
    const lon = 29.60;
    // Request current temperature, humidity, weather code, and wind speed
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relativehumidity_2m,weathercode,windspeed_10m&timezone=Europe/Istanbul`;

    let weatherData;
    try {
      const response = await fetch(apiUrl, { cache: 'no-store' }); // Disable caching for fresh data
      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Open-Meteo API Error:", response.status, errorBody);
        throw new Error(`Failed to fetch weather data from Open-Meteo: ${response.status} ${response.statusText}`);
      }
      weatherData = await response.json();
    } catch (error) {
      console.error("Error fetching or parsing Open-Meteo data:", error);
      throw new Error("Could not retrieve weather data. Please try again later.");
    }
    

    if (!weatherData.current || 
        typeof weatherData.current.temperature_2m !== 'number' ||
        typeof weatherData.current.relativehumidity_2m !== 'number' ||
        typeof weatherData.current.windspeed_10m !== 'number' ||
        typeof weatherData.current.weathercode !== 'number') {
      console.error("Open-Meteo response missing expected current weather data:", weatherData);
      throw new Error("Received incomplete weather data from Open-Meteo.");
    }

    const promptInputData: z.infer<typeof OpenMeteoDataSchema> = {
      api_temperature: weatherData.current.temperature_2m,
      api_humidity: weatherData.current.relativehumidity_2m,
      api_windspeed: weatherData.current.windspeed_10m,
      api_weathercode: weatherData.current.weathercode,
      location: flowInput.location,
    };

    const {output} = await formatOpenMeteoDataPrompt(promptInputData);
    if (!output) {
        throw new Error("Weather summarization prompt did not return an output.");
    }
    return output;
  }
);
