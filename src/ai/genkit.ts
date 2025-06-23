import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { config } from 'dotenv';

config(); // Load environment variables from .env file

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
