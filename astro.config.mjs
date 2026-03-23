// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://recipes.lemonnutrition.eu',
  output: 'static',
  vite: {
    plugins: [tailwindcss()]
  }
});
