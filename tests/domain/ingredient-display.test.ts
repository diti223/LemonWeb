import { describe, it, expect } from "vitest";
import {
  formatIngredientDisplay,
  formatAllIngredients,
} from "../../src/domain/ingredient-display.ts";
import type { PublicFoodItem, PublicIngredient, UnitEncoding } from "../../src/domain/public-recipe.ts";

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

function makeFoodItem(name: string): PublicFoodItem {
  return {
    id: "test-id",
    name,
    referenceMacroNutrients: {},
    unitWeightInGrams: {},
    creator: "system",
    cookingFactor: 1,
    isCooked: true,
  };
}

function makeIngredient(name: string, value?: number, unit?: UnitEncoding): PublicIngredient {
  return {
    quantity: value !== undefined && unit !== undefined ? { value, unit } : undefined,
    foodItem: makeFoodItem(name),
  };
}

// ---------------------------------------------------------------------------
// formatIngredientDisplay
// ---------------------------------------------------------------------------

describe("formatIngredientDisplay", () => {
  it("formats grams compactly", () => {
    expect(formatIngredientDisplay(makeIngredient("chicken breast", 200, "gram"))).toBe(
      "200g chicken breast",
    );
  });

  it("formats milligrams compactly", () => {
    expect(formatIngredientDisplay(makeIngredient("salt", 500, { gram: "mili" }))).toBe(
      "500mg salt",
    );
  });

  it("formats kilograms compactly", () => {
    expect(formatIngredientDisplay(makeIngredient("flour", 1, { gram: "kilo" }))).toBe(
      "1kg flour",
    );
  });

  it("formats milliliters compactly", () => {
    expect(formatIngredientDisplay(makeIngredient("water", 250, { liter: "mili" }))).toBe(
      "250mL water",
    );
  });

  it("formats tablespoon with space before abbreviation", () => {
    expect(formatIngredientDisplay(makeIngredient("olive oil", 2, "tablespoon"))).toBe(
      "2 tbsp olive oil",
    );
  });

  it("formats teaspoon with space before abbreviation", () => {
    expect(formatIngredientDisplay(makeIngredient("salt", 0.5, "teaspoon"))).toBe(
      "0.5 tsp salt",
    );
  });

  it("formats dimensionless unit as count + name", () => {
    expect(formatIngredientDisplay(makeIngredient("egg", 3, "unit"))).toBe("3 egg");
  });

  it("formats size descriptor between value and name", () => {
    expect(formatIngredientDisplay(makeIngredient("onion", 1, "medium"))).toBe("1 medium onion");
  });

  it("formats custom unit as label", () => {
    expect(formatIngredientDisplay(makeIngredient("thyme", 2, { custom: "sprig" }))).toBe(
      "2 sprig thyme",
    );
  });

  it("returns just the name when no quantity", () => {
    expect(formatIngredientDisplay(makeIngredient("salt"))).toBe("salt");
  });

  it("formats cup with space", () => {
    expect(formatIngredientDisplay(makeIngredient("rice", 1, "cup"))).toBe("1 cup rice");
  });

  it("formats float values without trailing zeros", () => {
    expect(formatIngredientDisplay(makeIngredient("butter", 1.5, "tablespoon"))).toBe(
      "1.5 tbsp butter",
    );
  });
});

// ---------------------------------------------------------------------------
// formatAllIngredients
// ---------------------------------------------------------------------------

describe("formatAllIngredients", () => {
  it("maps an array of ingredients to an array of display strings", () => {
    const ingredients = [
      makeIngredient("chicken breast", 200, "gram"),
      makeIngredient("salt", 0.5, "teaspoon"),
      makeIngredient("pepper"),
    ];

    const result = formatAllIngredients(ingredients);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("200g chicken breast");
    expect(result[1]).toBe("0.5 tsp salt");
    expect(result[2]).toBe("pepper");
  });
});
