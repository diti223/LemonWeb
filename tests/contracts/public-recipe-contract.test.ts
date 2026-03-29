import { describe, expect, it } from "vitest";
import { formatAllIngredients } from "../../src/domain/ingredient-display.ts";
import { toPublicRecipeDocument, toRecipePageViewModel } from "../../src/domain/public-recipe.ts";
import { makeIngredient, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("public recipe contract", () => {
  it("strips private author data from the public JSON document", () => {
    const storedRecipe = makeStoredPublishedRecipe();
    const publicDocument = toPublicRecipeDocument(storedRecipe);

    expect(publicDocument).not.toHaveProperty("authorId");
    expect(publicDocument).not.toHaveProperty("ingredientDisplayTexts");
    expect(publicDocument).toHaveProperty("optionalIngredients");
    expect(publicDocument.slug).toBe(storedRecipe.slug);
    expect(publicDocument.canonicalUrl).toBe(storedRecipe.canonicalUrl);
  });

  it("adds page-only ingredient display texts only in the page view model", () => {
    const storedRecipe = makeStoredPublishedRecipe({
      optionalIngredients: [makeIngredient("Basil")],
    });
    const ingredientDisplayTexts = formatAllIngredients(storedRecipe.ingredients);
    const optionalIngredientDisplayTexts = formatAllIngredients(storedRecipe.optionalIngredients);
    const pageViewModel = toRecipePageViewModel(
      storedRecipe,
      ingredientDisplayTexts,
      optionalIngredientDisplayTexts,
    );

    expect(pageViewModel.ingredientDisplayTexts).toEqual(ingredientDisplayTexts);
    expect(pageViewModel.optionalIngredientDisplayTexts).toEqual(optionalIngredientDisplayTexts);
    expect(pageViewModel).not.toHaveProperty("authorId");
  });
});
