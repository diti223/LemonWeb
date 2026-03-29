import type { APIRoute } from "astro";
import { unauthorizedResponse } from "../../infrastructure/auth.ts";
import { createLemonWebApplication } from "../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse, parsePublishRecipeRequest } from "../../infrastructure/http.ts";

export const prerender = false;

export function createPublishRecipeRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();
    if (!application.requestAuthenticator.isAuthorized(request)) {
      return unauthorizedResponse();
    }

    let publishContext: Record<string, unknown> | undefined;
    try {
      const command = await parsePublishRecipeRequest(request);
      publishContext = {
        id: command.id,
        authorId: command.authorId,
        title: command.title,
        servings: command.servings,
        ingredientCount: command.ingredients.length,
        optionalIngredientCount: command.optionalIngredients?.length ?? 0,
        instructionCount: command.instructions.length,
        hasImageUrl: command.imageUrl !== undefined,
        hasNutrition: command.nutrition !== undefined,
        hasOriginalSourceUrl: command.originalSourceUrl !== undefined,
      };
      const result = await application.publishRecipe.execute(command);

      if (result.status === "forbidden") {
        return jsonResponse({ error: "Recipe belongs to a different author" }, 403);
      }

      return jsonResponse(
        {
          slug: result.recipe.slug,
          url: result.recipe.canonicalUrl,
        },
        201,
      );
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      console.error("[LemonWebPublishRoute] Unhandled publish failure", {
        error,
        publishContext,
      });
      return jsonResponse({ error: "Internal publish error" }, 500);
    }
  };
}

export const POST = createPublishRecipeRoute();
