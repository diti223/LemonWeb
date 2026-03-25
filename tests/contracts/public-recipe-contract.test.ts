import { describe, expect, it } from "vitest";
import { formatAllIngredients } from "../../src/domain/ingredient-display.ts";
import { toPublicRecipeDocument, toRecipePageViewModel } from "../../src/domain/public-recipe.ts";
import { makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("public recipe contract", () => {
  it("strips private author data from the public JSON document", () => {
    const storedRecipe = makeStoredPublishedRecipe();
    const publicDocument = toPublicRecipeDocument(storedRecipe);

    expect(publicDocument).not.toHaveProperty("authorId");
    expect(publicDocument).not.toHaveProperty("ingredientDisplayTexts");
    expect(publicDocument.slug).toBe(storedRecipe.slug);
    expect(publicDocument.canonicalUrl).toBe(storedRecipe.canonicalUrl);
  });

  it("adds page-only ingredient display texts only in the page view model", () => {
    const storedRecipe = makeStoredPublishedRecipe();
    const ingredientDisplayTexts = formatAllIngredients(storedRecipe.ingredients);
    const pageViewModel = toRecipePageViewModel(storedRecipe, ingredientDisplayTexts);

    expect(pageViewModel.ingredientDisplayTexts).toEqual(ingredientDisplayTexts);
    expect(pageViewModel).not.toHaveProperty("authorId");
  });
});
