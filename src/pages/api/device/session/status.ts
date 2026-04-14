import type { APIRoute } from "astro";
import { createCapabilityTokenService, requireCapabilityToken } from "../../../../infrastructure/auth.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "../../../../infrastructure/http.ts";

export const prerender = false;

export interface DeviceSessionStatusRouteOptions {
  readonly tokenSecret?: string;
  readonly allowDevelopmentEnvironment?: boolean;
}

type DeviceSessionStatusRouteInput = DeviceSessionStatusRouteOptions | (() => DeviceSessionStatusRouteOptions);

export function createDeviceSessionStatusRoute(input: DeviceSessionStatusRouteInput = {}): APIRoute {
  return async ({ request }) => {
    try {
      const options = typeof input === "function" ? input() : input;
      const secret = readSecret(options.tokenSecret ?? readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") ?? "");
      const capabilityTokenService = createCapabilityTokenService({ secret });
      const claims = requireCapabilityToken(request, capabilityTokenService, []);
      const allowDevelopmentEnvironment =
        options.allowDevelopmentEnvironment ?? readEnvBool("APP_ATTEST_ALLOW_DEVELOPMENT");

      return jsonResponse(
        {
          valid: true,
          installId: claims.installId,
          scopes: claims.scopes,
          expiresAt: new Date(claims.exp).toISOString(),
          environment: allowDevelopmentEnvironment ? "development" : "production",
          acceptedProofKind: allowDevelopmentEnvironment ? "debug-attestation" : "attestation",
        },
        200,
      );
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      console.error("[LemonWebDeviceSessionStatusRoute] Unhandled failure", { error });
      return jsonResponse({ error: "Internal session status error" }, 500);
    }
  };
}

export const GET = createDeviceSessionStatusRoute();

function readEnv(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvBool(name: string): boolean {
  return readEnv(name) === "true";
}

function readSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  throw new HttpJsonError(500, "Missing capability token secret");
}
