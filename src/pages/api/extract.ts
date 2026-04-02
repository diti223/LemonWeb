import type { APIRoute } from "astro";
import { authorizeCapabilityRequest } from "../../infrastructure/capability-auth.ts";
import { createLemonWebApplication } from "../../infrastructure/composition-root.ts";
import {
  HttpJsonError,
  jsonErrorResponse,
  jsonResponse,
  parseExtractRecipeRequest,
} from "../../infrastructure/http.ts";

export const prerender = false;

export function createExtractRecipeRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();

    try {
      await authorizeCapabilityRequest(request, {
        requiredScope: "extract",
        rateLimitScope: "extract",
        rateLimitLimit: 60,
        rateLimitWindowSeconds: 60 * 60,
        rateLimitIpLimit: 120,
        rateLimitIpWindowSeconds: 60 * 60,
      });
      const command = await parseExtractRecipeRequest(request);
      const result = await application.extractRecipe.execute(command);
      return jsonResponse(result, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebExtractRoute] Unhandled extract failure", { error });
      return jsonResponse({ error: "Internal extract error" }, 500);
    }
  };
}

export const POST = createExtractRecipeRoute();
