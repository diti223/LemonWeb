import { createRecipePublishingPolicy } from "../../src/domain/publishing-policy.ts";
import type { PublishedRecipeRepository } from "../../src/domain/ports.ts";
import type {
  PublishRecipeCommand,
  RecipeFoodItem,
  RecipeIngredient,
  StoredPublishedRecipe,
} from "../../src/domain/public-recipe.ts";
import { toStoredPublishedRecipe } from "../../src/domain/public-recipe.ts";

export const FIXED_NOW = "2026-03-24T10:00:00.000Z";

export const fixedClock = {
  now() {
    return new Date(FIXED_NOW);
  },
};

export const fixedPublishingPolicy = createRecipePublishingPolicy("https://recipes.lemonnutrition.eu");

export function makeFoodItem(name = "Tomatoes"): RecipeFoodItem {
  return {
    id: `food-${name.toLowerCase()}`,
    name,
    plural: `${name}s`,
    alternativeNames: [],
    referenceMacroNutrients: {},
    unitWeightInGrams: {},
    creator: "system",
    cookingFactor: 1,
    isCooked: false,
  };
}

export function makeIngredient(name = "Tomatoes"): RecipeIngredient {
  return {
    quantity: {
      value: 2,
      unit: "cup",
    },
    foodItem: makeFoodItem(name),
  };
}

export function makePublishRecipeCommand(
  overrides: Partial<PublishRecipeCommand> = {},
): PublishRecipeCommand {
  return {
    id: "a3f8b2c1-1234-5678-9abc-def012345678",
    authorId: "abc123xyz789",
    title: "Chili Con Carne",
    description: "A public recipe",
    servings: 4,
    imageUrl: "https://cdn.example.com/chili.jpg",
    ingredients: [makeIngredient()],
    optionalIngredients: [],
    instructions: ["Cook slowly."],
    notes: ["Serve warm."],
    nutrition: {
      calories: 420,
      proteins: 24,
      fats: 16,
      carbohydrates: 33,
    },
    originalSourceUrl: "https://example.com/chili",
    ...overrides,
  };
}

export function makeStoredPublishedRecipe(
  overrides: Partial<StoredPublishedRecipe> = {},
): StoredPublishedRecipe {
  const commandOverrides = {
    ...(overrides.id !== undefined ? { id: overrides.id } : {}),
    ...(overrides.authorId !== undefined ? { authorId: overrides.authorId } : {}),
    ...(overrides.title !== undefined ? { title: overrides.title } : {}),
    ...(overrides.description !== undefined ? { description: overrides.description } : {}),
    ...(overrides.servings !== undefined ? { servings: overrides.servings } : {}),
    ...(overrides.imageUrl !== undefined ? { imageUrl: overrides.imageUrl } : {}),
    ...(overrides.ingredients !== undefined ? { ingredients: overrides.ingredients } : {}),
    ...(overrides.optionalIngredients !== undefined
      ? { optionalIngredients: overrides.optionalIngredients }
      : {}),
    ...(overrides.instructions !== undefined ? { instructions: overrides.instructions } : {}),
    ...(overrides.notes !== undefined ? { notes: overrides.notes } : {}),
    ...(overrides.nutrition !== undefined ? { nutrition: overrides.nutrition } : {}),
    ...(overrides.originalSourceUrl !== undefined
      ? { originalSourceUrl: overrides.originalSourceUrl }
      : {}),
  } satisfies Partial<PublishRecipeCommand>;

  const command = makePublishRecipeCommand(commandOverrides);
  const slug = overrides.slug ?? fixedPublishingPolicy.createSlug(command.title, command.id);

  return {
    ...toStoredPublishedRecipe(command, {
      slug,
      canonicalUrl: overrides.canonicalUrl ?? fixedPublishingPolicy.buildCanonicalUrl(slug),
      publishedAt: overrides.publishedAt ?? FIXED_NOW,
    }),
    ...overrides,
  };
}

export class InMemoryPublishedRecipeRepository implements PublishedRecipeRepository {
  private readonly recipes = new Map<string, StoredPublishedRecipe>();

  constructor(initialRecipes: readonly StoredPublishedRecipe[] = []) {
    for (const recipe of initialRecipes) {
      this.recipes.set(recipe.id, recipe);
    }
  }

  async getBySlug(slug: string): Promise<StoredPublishedRecipe | undefined> {
    return [...this.recipes.values()].find((recipe) => recipe.slug === slug);
  }

  async getById(id: string): Promise<StoredPublishedRecipe | undefined> {
    return this.recipes.get(id);
  }

  async listAll(): Promise<StoredPublishedRecipe[]> {
    return [...this.recipes.values()];
  }

  async save(recipe: StoredPublishedRecipe): Promise<void> {
    this.recipes.set(recipe.id, recipe);
  }

  async delete(id: string): Promise<boolean> {
    return this.recipes.delete(id);
  }
}
