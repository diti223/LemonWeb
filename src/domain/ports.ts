import type { PublicRecipe } from "./public-recipe.ts";

export interface RecipeRepository {
  getBySlug(slug: string): Promise<PublicRecipe | undefined>;
  getById(id: string): Promise<PublicRecipe | undefined>;
  listAll(): Promise<PublicRecipe[]>;
  save(recipe: PublicRecipe): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface ImageStore {
  upload(data: Buffer, contentType: string, slug: string): Promise<string>;
}
