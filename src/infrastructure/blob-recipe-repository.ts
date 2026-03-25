import { del, head, put } from "@vercel/blob";
import type { PublishedRecipeRepository } from "../domain/ports.ts";
import type { StoredPublishedRecipe } from "../domain/public-recipe.ts";

interface RecipeIndex {
  [slug: string]: string;
}

const INDEX_KEY = "recipes/_index.json";
const recipeKey = (id: string) => `recipes/${id}.json`;

export class BlobRecipeRepository implements PublishedRecipeRepository {
  private async readIndex(): Promise<RecipeIndex> {
    try {
      const blob = await head(INDEX_KEY);
      if (!blob) {
        return {};
      }

      const response = await fetch(blob.url);
      return (await response.json()) as RecipeIndex;
    } catch {
      return {};
    }
  }

  private async writeIndex(index: RecipeIndex): Promise<void> {
    await put(INDEX_KEY, JSON.stringify(index), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async getBySlug(slug: string): Promise<StoredPublishedRecipe | undefined> {
    const index = await this.readIndex();
    const id = index[slug];
    return id ? this.getById(id) : undefined;
  }

  async getById(id: string): Promise<StoredPublishedRecipe | undefined> {
    try {
      const blob = await head(recipeKey(id));
      if (!blob) {
        return undefined;
      }

      const response = await fetch(blob.url);
      return (await response.json()) as StoredPublishedRecipe;
    } catch {
      return undefined;
    }
  }

  async listAll(): Promise<StoredPublishedRecipe[]> {
    const index = await this.readIndex();
    const recipes = await Promise.all(Object.values(index).map((id) => this.getById(id)));
    return recipes.filter((recipe): recipe is StoredPublishedRecipe => recipe !== undefined);
  }

  async save(recipe: StoredPublishedRecipe): Promise<void> {
    await put(recipeKey(recipe.id), JSON.stringify(recipe), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

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
      const index = await this.readIndex();
      let found = false;
      for (const [slug, indexedId] of Object.entries(index)) {
        if (indexedId === id) {
          delete index[slug];
          found = true;
        }
      }

      if (!found) {
        return false;
      }

      await this.writeIndex(index);
      await del(recipeKey(id));
      return true;
    } catch {
      return false;
    }
  }
}
