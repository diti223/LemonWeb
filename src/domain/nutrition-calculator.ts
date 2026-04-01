import type { RecipeIngredient, RecipeFoodItem, RecipeNutrition } from "./public-recipe.ts";

/**
 * Calculate total nutrition from ingredients by summing their individual macro contributions.
 * Each ingredient's nutrition = quantity × unit weight × reference macros for that unit.
 */
export function calculateNutritionFromIngredients(
  ingredients: readonly RecipeIngredient[],
): RecipeNutrition {
  let totalCalories = 0;
  let totalProteins = 0;
  let totalFats = 0;
  let totalCarbohydrates = 0;

  for (const ingredient of ingredients) {
    const macro = getIngredientMacros(ingredient);
    totalCalories += macro.calories;
    totalProteins += macro.proteins;
    totalFats += macro.fats;
    totalCarbohydrates += macro.carbohydrates;
  }

  return {
    calories: Math.round(totalCalories),
    proteins: Math.round(totalProteins * 100) / 100,
    fats: Math.round(totalFats * 100) / 100,
    carbohydrates: Math.round(totalCarbohydrates * 100) / 100,
  };
}

/**
 * Get nutrition for a single ingredient by looking up unit weight and reference macros.
 *
 * Example: 200g tomato
 * - unitWeightInGrams["gram"] = 100 (1 unit of gram = 100g)
 * - referenceMacroNutrients["gram"] = { calories: 18, ... } (per 100g)
 * - Calculation: (200 / 100) * { 18, ... } = 2 * nutrition per unit
 */
function getIngredientMacros(ingredient: RecipeIngredient): RecipeNutrition {
  const { foodItem, quantity } = ingredient;

  if (!quantity) {
    return { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 };
  }

  const unitKey = unitKeyFromQuantityUnit(quantity.unit);

  // Get how many grams are in one unit of this ingredient
  const unitWeightInGrams = foodItem.unitWeightInGrams[unitKey];
  if (unitWeightInGrams === undefined) {
    // Unknown unit or no weight defined, can't calculate
    return { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 };
  }

  // Get reference macros for this unit
  const referenceMacro = foodItem.referenceMacroNutrients[unitKey];
  if (!referenceMacro) {
    // No reference macro for this unit
    return { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 };
  }

  // Total grams = quantity × grams per unit
  const totalGrams = quantity.value * unitWeightInGrams;

  // referenceMacro is per 100g, so scale by (totalGrams / 100)
  const scaleFactor = totalGrams / 100;

  return {
    calories: Math.round(referenceMacro.calories * scaleFactor * 100) / 100,
    proteins: Math.round(referenceMacro.proteins * scaleFactor * 100) / 100,
    fats: Math.round(referenceMacro.fats * scaleFactor * 100) / 100,
    carbohydrates: Math.round(referenceMacro.carbohydrates * scaleFactor * 100) / 100,
  };
}

/**
 * Map a quantity unit to the unitWeightInGrams key for the food item.
 */
function getUnitWeightInGrams(
  foodItem: RecipeFoodItem,
  unit: unknown,
): number | undefined {
  const key = unitKeyFromQuantityUnit(unit);
  return foodItem.unitWeightInGrams[key];
}

/**
 * Convert a quantity unit to the string key used in food item lookup tables.
 */
function unitKeyFromQuantityUnit(unit: unknown): string {
  if (typeof unit === "string") {
    return unit;
  }

  if (typeof unit === "object" && unit !== null) {
    // Compound units like { gram: "mili" } → "milligram"
    const obj = unit as Record<string, unknown>;
    if ("gram" in obj) {
      const factor = obj.gram;
      if (factor === "mili") return "milligram";
      if (factor === "kilo") return "kilogram";
      return "gram";
    }
    if ("liter" in obj) {
      const factor = obj.liter;
      if (factor === "mili") return "milliliter";
      if (factor === "kilo") return "kiloliter";
      return "liter";
    }
    if ("custom" in obj) {
      return String(obj.custom);
    }
  }

  return "unit";
}
