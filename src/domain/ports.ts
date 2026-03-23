import type { PublicRecipe } from "./public-recipe.ts";

export interface RecipeRepository {
  getBySlug(slug: string): Promise<PublicRecipe | undefined>;
  listAll(): Promise<PublicRecipe[]>;
}
