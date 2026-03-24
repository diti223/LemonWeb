import { put, del, head } from "@vercel/blob";
import type { RecipeRepository } from "../domain/ports.ts";
import type { PublicRecipe } from "../domain/public-recipe.ts";

interface RecipeIndex {
  [slug: string]: string; // slug -> id
}

const INDEX_KEY = "recipes/_index.json";
const recipeKey = (id: string) => `recipes/${id}.json`;

export class BlobRecipeRepository implements RecipeRepository {
  private async readIndex(): Promise<RecipeIndex> {
    try {
      const blob = await head(INDEX_KEY);
      if (!blob) return {};
      const res = await fetch(blob.url);
      return (await res.json()) as RecipeIndex;
    } catch {
      return {};
    }
  }

  private async writeIndex(index: RecipeIndex): Promise<void> {
    await put(INDEX_KEY, JSON.stringify(index), {
      access: "public",
      addRandomSuffix: false,
    });
  }

  async getBySlug(slug: string): Promise<PublicRecipe | undefined> {
    const index = await this.readIndex();
    const id = index[slug];
    if (!id) return undefined;
    return this.getById(id);
  }

  async getById(id: string): Promise<PublicRecipe | undefined> {
    try {
      const blob = await head(recipeKey(id));
      if (!blob) return undefined;
      const res = await fetch(blob.url);
      return (await res.json()) as PublicRecipe;
    } catch {
      return undefined;
    }
  }

  async listAll(): Promise<PublicRecipe[]> {
    const index = await this.readIndex();
    const recipes = await Promise.all(
      Object.values(index).map((id) => this.getById(id)),
    );
    return recipes.filter((r): r is PublicRecipe => r !== undefined);
  }

  async save(recipe: PublicRecipe): Promise<void> {
    // Save recipe JSON blob
    await put(recipeKey(recipe.id), JSON.stringify(recipe), {
      access: "public",
      addRandomSuffix: false,
    });

    // Update index: remove any old slug for this id, add new slug
    const index = await this.readIndex();
    for (const [existingSlug, existingId] of Object.entries(index)) {
      if (existingId === recipe.id) {
        delete index[existingSlug];
      }
    }
    index[recipe.slug] = recipe.id;
    await this.writeIndex(index);
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Remove from index first
      const index = await this.readIndex();
      let found = false;
      for (const [slug, indexId] of Object.entries(index)) {
        if (indexId === id) {
          delete index[slug];
          found = true;
        }
      }
      if (!found) return false;
      await this.writeIndex(index);

      // Delete the blob
      await del(recipeKey(id));
      return true;
    } catch {
      return false;
    }
  }
}
