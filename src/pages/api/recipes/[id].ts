import type { APIRoute } from "astro";
import { authorizeCapabilityRequest } from "../../../infrastructure/capability-auth.ts";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse, parseUnpublishRecipeRequest } from "../../../infrastructure/http.ts";

export const prerender = false;

export function createDeleteRecipeRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ params, request }) => {
    const application = resolveApplication();

    try {
      const claims = await authorizeCapabilityRequest(request, {
        requiredScope: "recipes:delete",
        rateLimitScope: "recipes:delete",
        rateLimitLimit: 30,
        rateLimitWindowSeconds: 60 * 60,
        rateLimitIpLimit: 120,
        rateLimitIpWindowSeconds: 60 * 60,
      });
      const input = await parseUnpublishRecipeRequest(request, params.id);
      if (input.authorId !== claims.installId) {
        return jsonResponse({ error: "Recipe belongs to a different author" }, 403);
      }
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
