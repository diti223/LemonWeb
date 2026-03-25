// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://recipes.lemonnutrition.eu",
  adapter: vercel(),
  vite: {
    // @ts-expect-error Astro and Tailwind currently resolve different Vite types here.
    plugins: [tailwindcss()],
  },
});
