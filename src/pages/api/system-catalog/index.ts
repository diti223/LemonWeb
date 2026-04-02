import type { APIRoute } from "astro";
import { unauthorizedResponse } from "../../../infrastructure/auth.ts";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "../../../infrastructure/http.ts";
import type { SystemCatalogName } from "../../../domain/system-catalog.ts";

export const prerender = false;

interface PublishSystemCatalogRequest {
  catalog: SystemCatalogName;
  version: string;
  payload: unknown;
}

function isSystemCatalogName(value: unknown): value is SystemCatalogName {
  return value === "food-items" || value === "starter-recipes";
}

async function parsePublishSystemCatalogRequest(request: Request): Promise<PublishSystemCatalogRequest> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new HttpJsonError(400, "Invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpJsonError(400, "Invalid JSON");
  }

  const body = parsed as Record<string, unknown>;
  if (!isSystemCatalogName(body.catalog)) {
    throw new HttpJsonError(400, "Missing or invalid field: catalog");
  }
  if (typeof body.version !== "string" || body.version.trim().length === 0) {
    throw new HttpJsonError(400, "Missing or invalid field: version");
  }
  if (!("payload" in body)) {
    throw new HttpJsonError(400, "Missing field: payload");
  }

  return {
    catalog: body.catalog,
    version: body.version,
    payload: body.payload,
  };
}

export function createPublishSystemCatalogRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();
    if (!application.requestAuthenticator.isAuthorized(request)) {
      return unauthorizedResponse();
    }

    try {
      const command = await parsePublishSystemCatalogRequest(request);
      const manifest = await application.publishSystemCatalog.execute(command);
      return jsonResponse({ manifest }, 201);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      console.error("[LemonWebSystemCatalogPublishRoute] Unhandled publish failure", { error });
      return jsonResponse({ error: "Internal publish error" }, 500);
    }
  };
}

export const POST = createPublishSystemCatalogRoute();
