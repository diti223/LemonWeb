import type { PublishedRecipeRepository } from "../domain/ports.ts";

export interface UnpublishRecipeUseCase {
  execute(input: UnpublishRecipeInput): Promise<UnpublishRecipeResult>;
}

export interface UnpublishRecipeInput {
  readonly id: string;
  readonly authorId: string;
}

export type UnpublishRecipeResult = "deleted" | "not_found" | "forbidden";

export function createUnpublishRecipeUseCase(
  repository: PublishedRecipeRepository,
): UnpublishRecipeUseCase {
  return {
    async execute(input) {
      const recipe = await repository.getById(input.id);
      if (!recipe) {
        return "not_found";
      }

      if (recipe.authorId !== input.authorId) {
        return "forbidden";
      }

      const deleted = await repository.delete(input.id);
      return deleted ? "deleted" : "not_found";
    },
  };
}
