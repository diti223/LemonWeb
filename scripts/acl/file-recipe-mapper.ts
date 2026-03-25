import { buildRecipeCanonicalUrl } from "../../src/domain/publishing-policy.ts";
import { slugify } from "../lib/slug.js";

// ---------------------------------------------------------------------------
// Input type – mirrors FileRecipe_v2_0 from the iOS export
// ---------------------------------------------------------------------------

export interface FileRecipeInput {
  id: string;
  name: string;
  description?: string;
  url?: string;
  servings: number;
  imageSource?: Record<string, any>;
  ingredients: Array<{
    quantity?: { value: number; unit: string } | null;
    foodItem: {
      name: string;
      macroNutrientsPer100g?: {
        proteins: number;
        fats: number;
        carbohydrates: number;
      };
    };
  }>;
  instructions: string[];
}

// ---------------------------------------------------------------------------
// Output type – the public recipe content for Astro
// ---------------------------------------------------------------------------

export interface PublicRecipeContent {
  title: string;
  description?: string;
  servings: number;
  imageUrl?: string;
  ingredients: { text: string }[];
  instructions: string[];
  notes: string[];
  nutrition?: {
    calories: number;
    proteins: number;
    fats: number;
    carbohydrates: number;
  };
  canonicalUrl: string;
  originalSourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------

const UNIT_ABBREVIATIONS: Record<string, string> = {
  gram: "g",
  kilogram: "kg",
  milligram: "mg",
  liter: "L",
  milliliter: "mL",
  tablespoon: "tbsp",
  teaspoon: "tsp",
};

/** Units that are expressible in grams for nutrition calculation. */
const GRAMS_FACTOR: Record<string, number> = {
  gram: 1,
  kilogram: 1000,
  milligram: 0.001,
};

function formatIngredient(ingredient: FileRecipeInput["ingredients"][number]): string {
  const name = ingredient.foodItem.name;
  const qty = ingredient.quantity;

  if (!qty) {
    return name;
  }

  const { value, unit } = qty;

  // "unit" means a dimensionless count – just show the number
  if (unit === "unit") {
    return `${formatNumber(value)} ${name}`;
  }

  // Size descriptors: "1 small chicken breast"
  if (unit === "small" || unit === "medium" || unit === "large") {
    return `${formatNumber(value)} ${unit} ${name}`;
  }

  // Known abbreviation (no space between number and abbr for compact units)
  const abbr = UNIT_ABBREVIATIONS[unit];
  if (abbr) {
    return `${formatNumber(value)}${abbr} ${name}`;
  }

  // Remaining named units (cup, pinch, bottle, can, or custom)
  return `${formatNumber(value)} ${unit} ${name}`;
}

/** Show integers without decimals, floats with up to 2 decimals. */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

// ---------------------------------------------------------------------------
// Nutrition aggregation
// ---------------------------------------------------------------------------

function computeNutrition(
  ingredients: FileRecipeInput["ingredients"],
): PublicRecipeContent["nutrition"] | undefined {
  let totalP = 0;
  let totalF = 0;
  let totalC = 0;
  let contributed = false;

  for (const ing of ingredients) {
    const macros = ing.foodItem.macroNutrientsPer100g;
    const qty = ing.quantity;
    if (!macros || !qty) continue;

    const factor = GRAMS_FACTOR[qty.unit];
    if (factor === undefined) continue; // non-gram unit – skip

    const grams = qty.value * factor;
    totalP += (macros.proteins * grams) / 100;
    totalF += (macros.fats * grams) / 100;
    totalC += (macros.carbohydrates * grams) / 100;
    contributed = true;
  }

  if (!contributed) return undefined;

  const calories = totalP * 4.1 + totalF * 8.84 + totalC * 4.1;

  return {
    calories: Math.round(calories),
    proteins: Math.round(totalP),
    fats: Math.round(totalF),
    carbohydrates: Math.round(totalC),
  };
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function mapFileRecipeToContent(
  recipe: FileRecipeInput,
  imageUrl?: string,
): PublicRecipeContent {
  const slug = slugify(recipe.name, recipe.id);

  // Resolve image: explicit parameter > imageSource.remote.url
  const resolvedImage =
    imageUrl ?? (recipe.imageSource?.remote?.url as string | undefined);

  const content: PublicRecipeContent = {
    title: recipe.name,
    servings: recipe.servings,
    ingredients: recipe.ingredients.map((ing) => ({
      text: formatIngredient(ing),
    })),
    instructions: recipe.instructions,
    notes: [],
    canonicalUrl: buildRecipeCanonicalUrl("https://recipes.lemonnutrition.eu", slug),
  };

  if (recipe.description) {
    content.description = recipe.description;
  }

  if (resolvedImage) {
    content.imageUrl = resolvedImage;
  }

  if (recipe.url) {
    content.originalSourceUrl = recipe.url;
  }

  const nutrition = computeNutrition(recipe.ingredients);
  if (nutrition) {
    content.nutrition = nutrition;
  }

  return content;
}
