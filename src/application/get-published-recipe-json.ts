import type { PublishedRecipeRepository } from "../domain/ports.ts";
import type { PublicRecipeDocument } from "../domain/public-recipe.ts";
import { toPublicRecipeDocument } from "../domain/public-recipe.ts";

export interface GetPublishedRecipeJsonUseCase {
  execute(slug: string): Promise<PublicRecipeDocument | undefined>;
}

export function createGetPublishedRecipeJsonUseCase(
  repository: PublishedRecipeRepository,
): GetPublishedRecipeJsonUseCase {
  return {
    async execute(slug) {
      const recipe = await repository.getBySlug(slug);
      return recipe ? toPublicRecipeDocument(recipe) : undefined;
    },
  };
}
