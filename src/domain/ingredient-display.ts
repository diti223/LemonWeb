import type { PublicIngredient, UnitEncoding } from "./public-recipe.ts";

// ---------------------------------------------------------------------------
// Unit abbreviation map
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

// Compact units: no space between number and abbreviation (e.g. "200g")
const COMPACT_UNITS = new Set(["g", "kg", "mg", "mL", "kL", "L"]);

// ---------------------------------------------------------------------------
// Resolve compound units: {gram: "mili"} -> "mg", {gram: "kilo"} -> "kg"
// ---------------------------------------------------------------------------

function resolveUnit(unit: UnitEncoding): { abbreviation?: string; label: string } {
  if (typeof unit === "string") {
    const abbr = UNIT_ABBREVIATIONS[unit];
    return abbr ? { abbreviation: abbr, label: unit } : { label: unit };
  }
  // Object form
  if ("gram" in unit) {
    if (unit.gram === "mili") return { abbreviation: "mg", label: "milligram" };
    if (unit.gram === "kilo") return { abbreviation: "kg", label: "kilogram" };
  }
  if ("liter" in unit) {
    if (unit.liter === "mili") return { abbreviation: "mL", label: "milliliter" };
    if (unit.liter === "kilo") return { abbreviation: "kL", label: "kiloliter" };
  }
  if ("custom" in unit) {
    return { label: unit.custom };
  }
  return { label: JSON.stringify(unit) };
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Show integers without decimals, floats with up to 2 decimals. */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function formatIngredientDisplay(ingredient: PublicIngredient): string {
  const name = ingredient.foodItem.name;
  const qty = ingredient.quantity;

  if (!qty) {
    return name;
  }

  const { value, unit } = qty;

  // "unit" means a dimensionless count - just show the number
  if (unit === "unit") {
    return `${formatNumber(value)} ${name}`;
  }

  // Size descriptors: "1 small chicken breast"
  if (unit === "small" || unit === "medium" || unit === "large") {
    return `${formatNumber(value)} ${unit} ${name}`;
  }

  const resolved = resolveUnit(unit);
  const display = resolved.abbreviation ?? resolved.label;

  // Compact units (g, kg, mg, mL, etc.) have no space between number and abbreviation
  if (resolved.abbreviation && COMPACT_UNITS.has(resolved.abbreviation)) {
    return `${formatNumber(value)}${display} ${name}`;
  }

  // Named units (tablespoon, cup, custom, etc.) have a space
  return `${formatNumber(value)} ${display} ${name}`;
}

export function formatAllIngredients(ingredients: readonly PublicIngredient[]): string[] {
  return ingredients.map(formatIngredientDisplay);
}
