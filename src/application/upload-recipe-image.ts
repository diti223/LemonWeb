import type { ImageStore, PublishedRecipeRepository } from "../domain/ports.ts";

export interface UploadRecipeImageInput {
  readonly data: Buffer;
  readonly contentType: string;
  readonly recipeId: string;
  readonly authorId: string;
}

export interface UploadRecipeImageUseCase {
  execute(input: UploadRecipeImageInput): Promise<UploadRecipeImageResult>;
}

export type UploadRecipeImageResult =
  | { readonly status: "uploaded"; readonly url: string }
  | { readonly status: "forbidden" };

export function createUploadRecipeImageUseCase(
  imageStore: ImageStore,
  repository: PublishedRecipeRepository,
): UploadRecipeImageUseCase {
  return {
    async execute(input) {
      const existingRecipe = await repository.getById(input.recipeId);
      if (existingRecipe && existingRecipe.authorId !== input.authorId) {
        return { status: "forbidden" };
      }

      const url = await imageStore.upload(input.data, input.contentType, input.recipeId);
      return { status: "uploaded", url };
    },
  };
}
