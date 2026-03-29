import { describe, expect, it } from "vitest";
import { createPublishRecipeUseCase } from "../../src/application/publish-recipe.ts";
import {
  FIXED_NOW,
  fixedClock,
  fixedPublishingPolicy,
  InMemoryPublishedRecipeRepository,
  makeIngredient,
  makePublishRecipeCommand,
  makeStoredPublishedRecipe,
} from "../support/published-recipe-fixtures.ts";

describe("PublishRecipeUseCase", () => {
  it("publishes a stored recipe with author ownership", async () => {
    const repository = new InMemoryPublishedRecipeRepository();
    const useCase = createPublishRecipeUseCase({
      repository,
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    });

    const result = await useCase.execute(makePublishRecipeCommand({
      optionalIngredients: [makeIngredient("Basil")],
    }));

    expect(result.status).toBe("published");
    if (result.status !== "published") {
      return;
    }

    expect(result.created).toBe(true);
    expect(result.recipe.authorId).toBe("abc123xyz789");
    expect(result.recipe.slug).toBe("chili-con-carne-a3f8b2c1");
    expect(result.recipe.canonicalUrl).toBe("https://recipes.lemonnutrition.eu/recipes/chili-con-carne-a3f8b2c1");
    expect(result.recipe.publishedAt).toBe(FIXED_NOW);
    expect(result.recipe.optionalIngredients.map((ingredient) => ingredient.foodItem.name)).toEqual([
      "Basil",
    ]);
  });

  it("allows the same author to republish an existing recipe id", async () => {
    const existingRecipe = makeStoredPublishedRecipe({
      title: "Old Chili",
    });
    const repository = new InMemoryPublishedRecipeRepository([existingRecipe]);
    const useCase = createPublishRecipeUseCase({
      repository,
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    });

    const result = await useCase.execute(makePublishRecipeCommand({
      title: "Updated Chili",
    }));

    expect(result.status).toBe("published");
    if (result.status !== "published") {
      return;
    }

    expect(result.created).toBe(false);
    expect(result.recipe.title).toBe("Updated Chili");
    expect(result.recipe.slug).toBe("updated-chili-a3f8b2c1");
  });

  it("rejects a different author from overwriting an existing recipe id", async () => {
    const repository = new InMemoryPublishedRecipeRepository([
      makeStoredPublishedRecipe(),
    ]);
    const useCase = createPublishRecipeUseCase({
      repository,
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    });

    const result = await useCase.execute(makePublishRecipeCommand({
      authorId: "different999",
    }));

    expect(result.status).toBe("forbidden");
    if (result.status !== "forbidden") {
      return;
    }

    expect(result.existingRecipe.authorId).toBe("abc123xyz789");
  });
});
