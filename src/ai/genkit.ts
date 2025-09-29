import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// process.env.GOOGLE_API_KEY will be automatically available in the hosting environment

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
