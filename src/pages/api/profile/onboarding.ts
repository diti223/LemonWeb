import type { APIRoute } from "astro";
import { authorizeCapabilityRequest } from "../../../infrastructure/capability-auth.ts";
import { createLemonWebApplication } from "../../../infrastructure/composition-root.ts";
import {
  HttpJsonError,
  jsonErrorResponse,
  jsonResponse,
  parseSaveOnboardingProfileRequest,
} from "../../../infrastructure/http.ts";

export const prerender = false;

const AUTHORIZATION_OPTIONS = {
  requiredScope: "profile:write",
  rateLimitScope: "profile",
  rateLimitLimit: 30,
  rateLimitWindowSeconds: 60 * 60,
  rateLimitIpLimit: 60,
  rateLimitIpWindowSeconds: 60 * 60,
} as const;

export function createSaveOnboardingProfileRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();

    try {
      const claims = await authorizeCapabilityRequest(request, AUTHORIZATION_OPTIONS);
      const { snapshot } = await parseSaveOnboardingProfileRequest(request);
      const result = await application.saveOnboardingProfile.execute({
        installId: claims.installId,
        snapshot,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebOnboardingProfileRoute] Unhandled save failure", { error });
      return jsonResponse({ error: "Internal onboarding profile error" }, 500);
    }
  };
}

export function createGetOnboardingProfileRoute(
  resolveApplication: typeof createLemonWebApplication = createLemonWebApplication,
): APIRoute {
  return async ({ request }) => {
    const application = resolveApplication();

    try {
      const claims = await authorizeCapabilityRequest(request, AUTHORIZATION_OPTIONS);
      const record = await application.getOnboardingProfile.execute(claims.installId);
      if (!record) {
        throw new HttpJsonError(404, "Not found");
      }
      return jsonResponse({ snapshot: record.snapshot, updatedAt: record.updatedAt }, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebOnboardingProfileRoute] Unhandled get failure", { error });
      return jsonResponse({ error: "Internal onboarding profile error" }, 500);
    }
  };
}

export const PUT = createSaveOnboardingProfileRoute();
export const GET = createGetOnboardingProfileRoute();
