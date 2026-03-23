import { getCollection, getEntry } from "astro:content";
import type { RecipeRepository } from "../domain/ports.ts";
import type { PublicRecipe } from "../domain/public-recipe.ts";

export class ContentRecipeRepository implements RecipeRepository {
  async getBySlug(slug: string): Promise<PublicRecipe | undefined> {
    const entry = await getEntry("recipes", slug);
    if (!entry) return undefined;
    return {
      ...entry.data,
      slug: entry.id,
      version: "1.0",
    };
  }

  async listAll(): Promise<PublicRecipe[]> {
    const entries = await getCollection("recipes");
    return entries.map((entry) => ({
      ...entry.data,
      slug: entry.id,
      version: "1.0",
    }));
  }
}
