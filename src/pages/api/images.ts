import type { APIRoute } from "astro";
import { unauthorizedResponse } from "../../infrastructure/auth.ts";
import { createLemonWebApplication } from "../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse, parseImageUploadRequest } from "../../infrastructure/http.ts";

export const prerender = false;

export function createUploadImageRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request, url }) => {
    const application = resolveApplication();
    if (!application.requestAuthenticator.isAuthorized(request)) {
      return unauthorizedResponse();
    }

    try {
      const input = await parseImageUploadRequest(request, url);
      const imageUrl = await application.uploadRecipeImage.execute(input);
      return jsonResponse({ url: imageUrl }, 201);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      throw error;
    }
  };
}

export const POST = createUploadImageRoute();
