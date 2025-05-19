'use server';

/**
 * @fileOverview Summarizes the current weather conditions for Domaniç.
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
  temperature: z.string().describe('The current temperature in Celsius.'),
  humidity: z.string().describe('The current humidity percentage.'),
  windSpeed: z.string().describe('The current wind speed in km/h.'),
  conditions: z.string().describe('Overall weather conditions (e.g., sunny, rainy).'),
});
export type WeatherSummaryOutput = z.infer<typeof WeatherSummaryOutputSchema>;

export async function summarizeWeather(input: WeatherSummaryInput): Promise<WeatherSummaryOutput> {
  return summarizeWeatherFlow(input);
}

const prompt = ai.definePrompt({
  name: 'weatherSummaryPrompt',
  input: {schema: WeatherSummaryInputSchema},
  output: {schema: WeatherSummaryOutputSchema},
  prompt: `You are a helpful AI assistant providing weather summaries for specific locations.

  Provide a concise summary of the current weather conditions for {{{location}}}, including the temperature, humidity, wind speed, and overall conditions (sunny, rainy, etc.).

  Format your response as follows:
  Summary: [Concise weather summary]
  Temperature: [Temperature in Celsius]
  Humidity: [Humidity percentage]
  Wind Speed: [Wind speed in km/h]
  Conditions: [Overall weather conditions]
  `,
});

const summarizeWeatherFlow = ai.defineFlow(
  {
    name: 'summarizeWeatherFlow',
    inputSchema: WeatherSummaryInputSchema,
    outputSchema: WeatherSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
