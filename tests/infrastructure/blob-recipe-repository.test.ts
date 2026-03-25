import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

const { putMock, headMock, delMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  headMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: putMock,
  head: headMock,
  del: delMock,
}));

describe("BlobRecipeRepository", () => {
  beforeEach(() => {
    putMock.mockReset();
    headMock.mockReset();
    delMock.mockReset();
  });

  it("overwrites deterministic blob keys when saving recipes and the slug index", async () => {
    const recipe = makeStoredPublishedRecipe();
    const { BlobRecipeRepository } = await import("../../src/infrastructure/blob-recipe-repository.ts");
    const repository = new BlobRecipeRepository();

    putMock.mockResolvedValue({ url: "https://blob.example/recipes/a3f8b2c1.json" });
    headMock.mockRejectedValue(new Error("missing index"));

    await repository.save(recipe);

    expect(putMock).toHaveBeenNthCalledWith(
      1,
      `recipes/${recipe.id}.json`,
      JSON.stringify(recipe),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    );
    expect(putMock).toHaveBeenNthCalledWith(
      2,
      "recipes/_index.json",
      JSON.stringify({ [recipe.slug]: recipe.id }),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    );
  });
});
