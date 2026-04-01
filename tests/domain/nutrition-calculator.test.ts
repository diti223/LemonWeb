import { describe, expect, it } from "vitest";
import { calculateNutritionFromIngredients } from "../../src/domain/nutrition-calculator.ts";
import type { RecipeIngredient, RecipeFoodItem } from "../../src/domain/public-recipe.ts";

function makeFoodItem(
  name: string,
  unitWeightInGrams: Record<string, number> = {},
  referenceMacroNutrients: Record<string, { calories: number; proteins: number; fats: number; carbohydrates: number }> = {},
): RecipeFoodItem {
  return {
    id: `food-${name.toLowerCase()}`,
    name,
    referenceMacroNutrients,
    unitWeightInGrams,
    creator: "system",
    cookingFactor: 1,
    isCooked: false,
  };
}

function makeIngredient(
  foodItem: RecipeFoodItem,
  value: number = 1,
  unit: string = "gram",
): RecipeIngredient {
  return {
    foodItem,
    quantity: { value, unit: unit as any },
  };
}

describe("calculateNutritionFromIngredients", () => {
  it("calculates nutrition from single ingredient with grams", () => {
    // Tomato: 18 calories, 0.9g protein, 0.2g fat, 3.9g carbs per 100g
    // unitWeightInGrams["gram"] = 1 means "1 gram unit = 1 gram"
    const tomato = makeFoodItem("Tomato", { gram: 1 }, {
      gram: { calories: 18, proteins: 0.9, fats: 0.2, carbohydrates: 3.9 },
    });

    const ingredient = makeIngredient(tomato, 200, "gram"); // 200 grams
    const nutrition = calculateNutritionFromIngredients([ingredient]);

    // 200g total, reference is per 100g
    // scaleFactor = 200 / 1 = 200 → 200 * (18 / 100) = 36 cal
    expect(nutrition.calories).toBe(36);
    expect(nutrition.proteins).toBeCloseTo(1.8, 1);
    expect(nutrition.fats).toBeCloseTo(0.4, 1);
    expect(nutrition.carbohydrates).toBeCloseTo(7.8, 1);
  });

  it("calculates nutrition from multiple ingredients", () => {
    const tomato = makeFoodItem("Tomato", { gram: 1 }, {
      gram: { calories: 18, proteins: 0.9, fats: 0.2, carbohydrates: 3.9 },
    });

    const olive = makeFoodItem("Olive Oil", { gram: 1 }, {
      gram: { calories: 884, proteins: 0, fats: 100, carbohydrates: 0 },
    });

    const ingredients = [
      makeIngredient(tomato, 200, "gram"), // 200 * (18/100) = 36 cal
      makeIngredient(olive, 10, "gram"), // 10 * (884/100) = 88.4 cal
    ];

    const nutrition = calculateNutritionFromIngredients(ingredients);

    expect(nutrition.calories).toBeCloseTo(124.4, 0); // 36 + 88.4
    expect(nutrition.proteins).toBeCloseTo(1.8, 1);
    expect(nutrition.fats).toBeCloseTo(10.4, 1);
    expect(nutrition.carbohydrates).toBeCloseTo(7.8, 1);
  });

  it("handles ingredients with no quantity gracefully", () => {
    const tomato = makeFoodItem("Tomato", { gram: 100 }, {
      gram: { calories: 18, proteins: 0.9, fats: 0.2, carbohydrates: 3.9 },
    });

    const ingredients: RecipeIngredient[] = [
      { foodItem: tomato, quantity: undefined }, // No quantity
    ];

    const nutrition = calculateNutritionFromIngredients(ingredients);

    expect(nutrition.calories).toBe(0);
    expect(nutrition.proteins).toBe(0);
    expect(nutrition.fats).toBe(0);
    expect(nutrition.carbohydrates).toBe(0);
  });

  it("handles unknown units gracefully", () => {
    const tomato = makeFoodItem("Tomato", { gram: 100 }, {
      gram: { calories: 18, proteins: 0.9, fats: 0.2, carbohydrates: 3.9 },
    });

    const ingredients = [makeIngredient(tomato, 1, "unknown-unit")];
    const nutrition = calculateNutritionFromIngredients(ingredients);

    // No unitWeightInGrams for "unknown-unit", so returns 0
    expect(nutrition.calories).toBe(0);
  });

  it("calculates nutrition from compound units (milliliters)", () => {
    // Milk: 61 cal, 3.2g protein, 3.3g fat, 4.8g carbs per 100mL
    // unitWeightInGrams["milliliter"] = 1 means "1 mL = 1 gram"
    const milk = makeFoodItem(
      "Milk",
      { milliliter: 1 },
      { milliliter: { calories: 61, proteins: 3.2, fats: 3.3, carbohydrates: 4.8 } },
    );

    const ingredients = [makeIngredient(milk, 250, { liter: "mili" })]; // 250 mL
    const nutrition = calculateNutritionFromIngredients(ingredients);

    // 250 mL, reference is per 100 mL
    // scaleFactor = 250 / 100 = 2.5 → 61 * 2.5 = 152.5 cal
    expect(nutrition.calories).toBeCloseTo(153, 0); // Rounded
    expect(nutrition.proteins).toBeCloseTo(8, 0);
    expect(nutrition.fats).toBeCloseTo(8.3, 0);
    expect(nutrition.carbohydrates).toBeCloseTo(12, 0);
  });

  it("returns empty nutrition for empty ingredients list", () => {
    const nutrition = calculateNutritionFromIngredients([]);

    expect(nutrition.calories).toBe(0);
    expect(nutrition.proteins).toBe(0);
    expect(nutrition.fats).toBe(0);
    expect(nutrition.carbohydrates).toBe(0);
  });
});
