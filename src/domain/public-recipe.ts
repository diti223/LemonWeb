// === Mirrors iOS Swift Codable encoding exactly ===

export type UnitEncoding =
  | "gram" | { gram: "mili" | "kilo" }
  | "liter" | { liter: "mili" | "kilo" }
  | "tablespoon" | "teaspoon" | "unit" | "pound" | "ounce" | "cup"
  | "bottle" | "pinch" | "can" | "small" | "medium" | "large"
  | { custom: string };

export interface MacroNutrients {
  readonly proteins: number;
  readonly fats: number;
  readonly carbohydrates: number;
  readonly alcohol?: number;
  readonly alcoholSugars?: number;
}

export interface PublicFoodItem {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly alternativeNames?: string[];
  readonly referenceMacroNutrients: Record<string, MacroNutrients>;
  readonly unitWeightInGrams: Record<string, number>;
  readonly creator: "system" | "user" | "ai";
  readonly cookingFactor: number;
  readonly isCooked: boolean;
}

export interface PublicIngredient {
  readonly quantity?: { readonly value: number; readonly unit: UnitEncoding };
  readonly foodItem: PublicFoodItem;
}

export interface PublicNutrition {
  readonly calories: number;
  readonly proteins: number;
  readonly fats: number;
  readonly carbohydrates: number;
}

export interface PublicRecipe {
  readonly version: "2.0";
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly servings: number;
  readonly imageUrl?: string;
  readonly ingredients: readonly PublicIngredient[];
  readonly ingredientDisplayTexts: readonly string[];
  readonly instructions: readonly string[];
  readonly notes: readonly string[];
  readonly nutrition?: PublicNutrition;
  readonly canonicalUrl: string;
  readonly originalSourceUrl?: string;
  readonly publishedAt: string;
}
