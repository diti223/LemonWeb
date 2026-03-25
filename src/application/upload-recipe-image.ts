import type { ImageStore } from "../domain/ports.ts";

export interface UploadRecipeImageInput {
  readonly data: Buffer;
  readonly contentType: string;
  readonly recipeId: string;
}

export interface UploadRecipeImageUseCase {
  execute(input: UploadRecipeImageInput): Promise<string>;
}

export function createUploadRecipeImageUseCase(
  imageStore: ImageStore,
): UploadRecipeImageUseCase {
  return {
    async execute(input) {
      return imageStore.upload(input.data, input.contentType, input.recipeId);
    },
  };
}
