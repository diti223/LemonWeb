import type { StoredPublishedRecipe } from "./public-recipe.ts";
import type { ExtractedRecipe } from "./extracted-recipe.ts";
import type { PublishSystemCatalogCommand, StoredSystemCatalog, SystemCatalogManifest, SystemCatalogName } from "./system-catalog.ts";

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

export interface RecipeHtmlExtractor {
  extract(html: string, sourceURL: string): ExtractedRecipe;
}

export interface SystemCatalogRepository {
  getManifest(): Promise<SystemCatalogManifest | undefined>;
  getCatalog(catalog: SystemCatalogName): Promise<StoredSystemCatalog | undefined>;
  saveCatalog(command: PublishSystemCatalogCommand): Promise<SystemCatalogManifest>;
}
