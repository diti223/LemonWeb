import type { APIRoute } from "astro";
import { authorizeCapabilityRequest } from "../../infrastructure/capability-auth.ts";
import { createLemonWebApplication } from "../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse, parseImageUploadRequest } from "../../infrastructure/http.ts";

export const prerender = false;

export function createUploadImageRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request, url }) => {
    const application = resolveApplication();

    try {
      const claims = await authorizeCapabilityRequest(request, {
        requiredScope: "images:write",
        rateLimitScope: "images:write",
        rateLimitLimit: 30,
        rateLimitWindowSeconds: 60 * 60,
        rateLimitIpLimit: 120,
        rateLimitIpWindowSeconds: 60 * 60,
      });
      const input = await parseImageUploadRequest(request, url);
      if (input.authorId !== claims.installId) {
        return jsonErrorResponse(new HttpJsonError(403, "Recipe belongs to a different author"));
      }
      const result = await application.uploadRecipeImage.execute(input);
      if (result.status === "forbidden") {
        return jsonErrorResponse(new HttpJsonError(403, "Recipe belongs to a different author"));
      }

      return jsonResponse({ url: result.url }, 201);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      throw error;
    }
  };
}

export const POST = createUploadImageRoute();
