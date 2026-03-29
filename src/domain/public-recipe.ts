export type UnitEncoding =
  | "gram" | { gram: "mili" | "kilo" }
  | "liter" | { liter: "mili" | "kilo" }
  | "tablespoon" | "teaspoon" | "unit" | "pound" | "ounce" | "cup"
  | "bottle" | "pinch" | "can" | "small" | "medium" | "large"
  | { custom: string };

export interface RecipeFoodItem {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly alternativeNames?: string[];
  readonly referenceMacroNutrients: Record<string, RecipeNutrition>;
  readonly unitWeightInGrams: Record<string, number>;
  readonly creator: "system" | "user" | "ai";
  readonly cookingFactor: number;
  readonly isCooked: boolean;
}

export interface RecipeIngredient {
  readonly quantity?: { readonly value: number; readonly unit: UnitEncoding };
  readonly foodItem: RecipeFoodItem;
}

export interface RecipeNutrition {
  readonly calories: number;
  readonly proteins: number;
  readonly fats: number;
  readonly carbohydrates: number;
}

interface PublishedRecipeFields {
  readonly version: "2.0";
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly servings: number;
  readonly imageUrl?: string;
  readonly ingredients: readonly RecipeIngredient[];
  readonly optionalIngredients: readonly RecipeIngredient[];
  readonly instructions: readonly string[];
  readonly notes: readonly string[];
  readonly nutrition?: RecipeNutrition;
  readonly canonicalUrl: string;
  readonly originalSourceUrl?: string;
  readonly publishedAt: string;
}

export interface PublishRecipeCommand {
  readonly id: string;
  readonly authorId: string;
  readonly title: string;
  readonly description?: string;
  readonly servings?: number;
  readonly imageUrl?: string;
  readonly ingredients: readonly RecipeIngredient[];
  readonly optionalIngredients?: readonly RecipeIngredient[];
  readonly instructions: readonly string[];
  readonly notes?: readonly string[];
  readonly nutrition?: RecipeNutrition;
  readonly originalSourceUrl?: string;
}

export interface StoredPublishedRecipe extends PublishedRecipeFields {
  readonly authorId: string;
}

export interface PublicRecipeDocument extends PublishedRecipeFields {}

export interface RecipePageViewModel extends PublicRecipeDocument {
  readonly ingredientDisplayTexts: readonly string[];
  readonly optionalIngredientDisplayTexts: readonly string[];
  readonly jsonUrl: string;
}

export interface PublishRecipeMetadata {
  readonly slug: string;
  readonly canonicalUrl: string;
  readonly publishedAt: string;
}

export function toStoredPublishedRecipe(
  command: PublishRecipeCommand,
  metadata: PublishRecipeMetadata,
): StoredPublishedRecipe {
  return {
    version: "2.0",
    id: command.id,
    authorId: command.authorId,
    slug: metadata.slug,
    title: command.title,
    description: command.description,
    servings: command.servings ?? 1,
    imageUrl: command.imageUrl,
    ingredients: command.ingredients,
    optionalIngredients: command.optionalIngredients ?? [],
    instructions: command.instructions,
    notes: command.notes ?? [],
    nutrition: command.nutrition,
    canonicalUrl: metadata.canonicalUrl,
    originalSourceUrl: command.originalSourceUrl,
    publishedAt: metadata.publishedAt,
  };
}

export function toPublicRecipeDocument(recipe: StoredPublishedRecipe): PublicRecipeDocument {
  return {
    version: recipe.version,
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients,
    optionalIngredients: recipe.optionalIngredients,
    instructions: recipe.instructions,
    notes: recipe.notes,
    nutrition: recipe.nutrition,
    canonicalUrl: recipe.canonicalUrl,
    originalSourceUrl: recipe.originalSourceUrl,
    publishedAt: recipe.publishedAt,
  };
}

export function toRecipePageViewModel(
  recipe: StoredPublishedRecipe,
  ingredientDisplayTexts: readonly string[],
  optionalIngredientDisplayTexts: readonly string[],
): RecipePageViewModel {
  return {
    ...toPublicRecipeDocument(recipe),
    ingredientDisplayTexts,
    optionalIngredientDisplayTexts,
    jsonUrl: `${recipe.canonicalUrl}.json`,
  };
}

// Backwards-compatible aliases for existing helpers/tests that use the old names.
export type PublicFoodItem = RecipeFoodItem;
export type PublicIngredient = RecipeIngredient;
export type PublicNutrition = RecipeNutrition;
