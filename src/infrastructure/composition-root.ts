import type { RecipeRepository } from "../domain/ports.ts";
import { ContentRecipeRepository } from "./content-recipe-repository.ts";

export const recipeRepository: RecipeRepository =
  new ContentRecipeRepository();
