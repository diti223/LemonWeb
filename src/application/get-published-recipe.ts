import { formatAllIngredients } from "../domain/ingredient-display.ts";
import type { PublishedRecipeRepository } from "../domain/ports.ts";
import type { RecipePageViewModel } from "../domain/public-recipe.ts";
import { toRecipePageViewModel } from "../domain/public-recipe.ts";

export interface GetPublishedRecipeUseCase {
  execute(slug: string): Promise<RecipePageViewModel | undefined>;
}

export function createGetPublishedRecipeUseCase(
  repository: PublishedRecipeRepository,
): GetPublishedRecipeUseCase {
  return {
    async execute(slug) {
      const recipe = await repository.getBySlug(slug);
      if (!recipe) {
        return undefined;
      }

      return toRecipePageViewModel(recipe, formatAllIngredients(recipe.ingredients));
    },
  };
}
