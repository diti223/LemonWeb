import { getCollection, getEntry } from "astro:content";
import type { PublishedRecipeRepository } from "../domain/ports.ts";
import type { StoredPublishedRecipe } from "../domain/public-recipe.ts";

/**
 * Legacy read-only adapter for content-backed recipes.
 * Blob storage is the canonical publish store for LemonWeb v2.
 */
export class ContentRecipeRepository implements PublishedRecipeRepository {
  async getBySlug(slug: string): Promise<StoredPublishedRecipe | undefined> {
    const entry = await getEntry("recipes", slug);
    return entry ? this.toStoredRecipe(entry.id, entry.data) : undefined;
  }

  async getById(id: string): Promise<StoredPublishedRecipe | undefined> {
    return this.getBySlug(id);
  }

  async listAll(): Promise<StoredPublishedRecipe[]> {
    const entries = await getCollection("recipes");
    return entries.map((entry) => this.toStoredRecipe(entry.id, entry.data));
  }

  async save(): Promise<void> {
    throw new Error("ContentRecipeRepository is read-only.");
  }

  async delete(): Promise<boolean> {
    throw new Error("ContentRecipeRepository is read-only.");
  }

  private toStoredRecipe(
    slug: string,
    data: Record<string, unknown>,
  ): StoredPublishedRecipe {
    return {
      version: "2.0",
      id: slug,
      authorId: "legacy-content",
      slug,
      title: data.title as string,
      description: data.description as string | undefined,
      servings: (data.servings as number | undefined) ?? 1,
      imageUrl: data.imageUrl as string | undefined,
      ingredients: [] as const,
      optionalIngredients: [] as const,
      instructions: (data.instructions as string[] | undefined) ?? [],
      notes: (data.notes as string[] | undefined) ?? [],
      nutrition: data.nutrition as StoredPublishedRecipe["nutrition"],
      canonicalUrl: data.canonicalUrl as string,
      originalSourceUrl: data.originalSourceUrl as string | undefined,
      publishedAt: new Date(0).toISOString(),
    };
  }
}
