import type { RecipeRepository } from "../domain/ports.ts";
import type { ImageStore } from "../domain/ports.ts";
import { BlobRecipeRepository } from "./blob-recipe-repository.ts";
import { BlobImageStore } from "./blob-image-store.ts";

export const recipeRepository: RecipeRepository = new BlobRecipeRepository();
export const imageStore: ImageStore = new BlobImageStore();
