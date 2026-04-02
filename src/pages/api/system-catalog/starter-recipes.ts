import type { APIRoute } from "astro";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import { jsonResponse } from "../../../infrastructure/http.ts";
import { etagMatches, makeHeaders } from "./shared.ts";

export const prerender = false;

export function createGetStarterRecipesSystemCatalogRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();
    const catalog = await application.getSystemCatalog.execute("starter-recipes");
    if (!catalog) {
      return jsonResponse({ error: "System catalog not found" }, 404);
    }

    const body = JSON.stringify(catalog.payload);
    const headers = makeHeaders(body, 3600);
    const etag = headers.ETag;
    if (etagMatches(request, etag)) {
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    return new Response(body, {
      status: 200,
      headers,
    });
  };
}

export const GET = createGetStarterRecipesSystemCatalogRoute();
