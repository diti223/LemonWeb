import type { StoredPublishedRecipe } from "./public-recipe.ts";

export interface PublishedRecipeRepository {
  getBySlug(slug: string): Promise<StoredPublishedRecipe | undefined>;
  getById(id: string): Promise<StoredPublishedRecipe | undefined>;
  listAll(): Promise<StoredPublishedRecipe[]>;
  save(recipe: StoredPublishedRecipe): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface ImageStore {
  upload(data: Buffer, contentType: string, recipeId: string): Promise<string>;
}

export interface Clock {
  now(): Date;
}

export interface RecipePublishingPolicy {
  createSlug(title: string, id: string): string;
  buildCanonicalUrl(slug: string): string;
}
