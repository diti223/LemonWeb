import type { APIRoute } from "astro";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import { jsonResponse } from "../../../infrastructure/http.ts";
import { makeHeaders } from "./shared.ts";

export const prerender = false;

export function createGetSystemCatalogManifestRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async () => {
    const application = resolveApplication();
    const manifest = await application.getCatalogManifest.execute();
    if (!manifest) {
      return jsonResponse({ error: "System catalog manifest not found" }, 404);
    }

    const body = JSON.stringify(manifest);
    return new Response(body, {
      status: 200,
      headers: makeHeaders(body, 60),
    });
  };
}

export const GET = createGetSystemCatalogManifestRoute();
