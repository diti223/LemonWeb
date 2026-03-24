import type { APIRoute } from "astro";
import { validateAuth, unauthorizedResponse } from "../../infrastructure/auth.ts";
import { recipeRepository } from "../../infrastructure/composition-root.ts";
import { slugify } from "../../domain/slug.ts";
import { formatAllIngredients } from "../../domain/ingredient-display.ts";
import type { PublicRecipe } from "../../domain/public-recipe.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  // Size check (1MB limit)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 1_048_576) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate required fields
  if (!body.id || typeof body.id !== "string") {
    return new Response(JSON.stringify({ error: "Missing or invalid field: id" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!body.title || typeof body.title !== "string") {
    return new Response(JSON.stringify({ error: "Missing or invalid field: title" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return new Response(JSON.stringify({ error: "Missing or empty field: ingredients" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!Array.isArray(body.instructions)) {
    return new Response(JSON.stringify({ error: "Missing field: instructions" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Generate slug and build recipe
  const slug = slugify(body.title, body.id);
  const canonicalUrl = `https://recipes.lemonnutrition.eu/recipes/${slug}`;

  // Generate display texts from structured ingredients
  const ingredientDisplayTexts = formatAllIngredients(body.ingredients);

  const recipe: PublicRecipe = {
    version: "2.0",
    id: body.id,
    slug,
    title: body.title,
    description: body.description,
    servings: body.servings ?? 1,
    imageUrl: body.imageUrl,
    ingredients: body.ingredients,
    ingredientDisplayTexts,
    instructions: body.instructions,
    notes: body.notes ?? [],
    nutrition: body.nutrition,
    canonicalUrl,
    originalSourceUrl: body.originalSourceUrl,
    publishedAt: new Date().toISOString(),
  };

  // Save to blob storage
  await recipeRepository.save(recipe);

  return new Response(
    JSON.stringify({ slug, url: canonicalUrl }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
};
