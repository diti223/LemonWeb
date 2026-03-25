import { describe, expect, it } from "vitest";
import { createUnpublishRecipeUseCase } from "../../src/application/unpublish-recipe.ts";
import { InMemoryPublishedRecipeRepository, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("UnpublishRecipeUseCase", () => {
  it("deletes a recipe when the author matches", async () => {
    const repository = new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]);
    const useCase = createUnpublishRecipeUseCase(repository);

    const result = await useCase.execute({
      id: "a3f8b2c1-1234-5678-9abc-def012345678",
      authorId: "abc123xyz789",
    });

    expect(result).toBe("deleted");
    await expect(repository.getById("a3f8b2c1-1234-5678-9abc-def012345678")).resolves.toBeUndefined();
  });

  it("rejects a non-author even when the recipe exists", async () => {
    const repository = new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]);
    const useCase = createUnpublishRecipeUseCase(repository);

    const result = await useCase.execute({
      id: "a3f8b2c1-1234-5678-9abc-def012345678",
      authorId: "different999",
    });

    expect(result).toBe("forbidden");
  });
});
