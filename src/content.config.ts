import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const recipes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/recipes" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    servings: z.number(),
    imageUrl: z.string().url().optional(),
    ingredients: z.array(z.object({ text: z.string() })),
    optionalIngredients: z.array(z.object({ text: z.string() })).default([]),
    instructions: z.array(z.string()),
    notes: z.array(z.string()).default([]),
    nutrition: z
      .object({
        calories: z.number(),
        proteins: z.number(),
        fats: z.number(),
        carbohydrates: z.number(),
      })
      .optional(),
    canonicalUrl: z.string().url(),
    originalSourceUrl: z.string().url().optional(),
  }),
});

export const collections = { recipes };
