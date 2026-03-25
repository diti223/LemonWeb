import { describe, expect, it, vi } from "vitest";
import { createUploadRecipeImageUseCase } from "../../src/application/upload-recipe-image.ts";

describe("UploadRecipeImageUseCase", () => {
  it("forwards the recipe id to the image store", async () => {
    const imageStore = {
      upload: vi.fn(async (_data: Buffer, _contentType: string, recipeId: string) => {
        expect(recipeId).toBe("a3f8b2c1-1234-5678-9abc-def012345678");
        return "https://blob.example/recipes/a3f8b2c1/hero.jpg";
      }),
    };
    const repository = {
      getById: vi.fn(async () => undefined),
    };

    const useCase = createUploadRecipeImageUseCase(imageStore as any, repository as any);
    const result = await useCase.execute({
      data: Buffer.from([1, 2, 3]),
      contentType: "image/jpeg",
      recipeId: "a3f8b2c1-1234-5678-9abc-def012345678",
      authorId: "author-1",
    });

    expect(result).toEqual({
      status: "uploaded",
      url: "https://blob.example/recipes/a3f8b2c1/hero.jpg",
    });
    expect(imageStore.upload).toHaveBeenCalledTimes(1);
  });

  it("rejects overwrite when the recipe belongs to another author", async () => {
    const imageStore = {
      upload: vi.fn(),
    };
    const repository = {
      getById: vi.fn(async () => ({ id: "recipe-1", authorId: "author-2" })),
    };

    const useCase = createUploadRecipeImageUseCase(imageStore as any, repository as any);
    const result = await useCase.execute({
      data: Buffer.from([1, 2, 3]),
      contentType: "image/jpeg",
      recipeId: "recipe-1",
      authorId: "author-1",
    });

    expect(result).toEqual({ status: "forbidden" });
    expect(imageStore.upload).not.toHaveBeenCalled();
  });
});
