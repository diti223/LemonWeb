export interface PublicIngredient {
  readonly text: string;
}

export interface PublicNutrition {
  readonly calories: number;
  readonly proteins: number;
  readonly fats: number;
  readonly carbohydrates: number;
}

export interface PublicRecipe {
  readonly version: "1.0";
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly servings: number;
  readonly imageUrl?: string;
  readonly ingredients: readonly PublicIngredient[];
  readonly instructions: readonly string[];
  readonly notes: readonly string[];
  readonly nutrition?: PublicNutrition;
  readonly canonicalUrl: string;
  readonly originalSourceUrl?: string;
}
