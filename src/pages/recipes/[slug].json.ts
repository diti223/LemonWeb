import type { APIRoute } from "astro";
import { createLemonWebApplication } from "../../infrastructure/composition-root.ts";
import { jsonResponse } from "../../infrastructure/http.ts";

export const prerender = false;

export function createPublishedRecipeJsonRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ params }) => {
    const application = resolveApplication();
    const recipe = await application.getPublishedRecipeJson.execute(params.slug!);

    if (!recipe) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    return jsonResponse(recipe);
  };
}

export const GET = createPublishedRecipeJsonRoute();
