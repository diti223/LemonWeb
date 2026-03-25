import type { APIRoute } from "astro";
import { unauthorizedResponse } from "../../../infrastructure/auth.ts";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse, parseUnpublishRecipeRequest } from "../../../infrastructure/http.ts";

export const prerender = false;

export function createDeleteRecipeRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ params, request }) => {
    const application = resolveApplication();
    if (!application.requestAuthenticator.isAuthorized(request)) {
      return unauthorizedResponse();
    }

    try {
      const input = await parseUnpublishRecipeRequest(request, params.id);
      const result = await application.unpublishRecipe.execute(input);

      if (result === "deleted") {
        return new Response(null, { status: 204 });
      }

      if (result === "forbidden") {
        return jsonResponse({ error: "Recipe belongs to a different author" }, 403);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      throw error;
    }
  };
}

export const DELETE = createDeleteRecipeRoute();
