import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { createCapabilityTokenService } from "../../../infrastructure/auth.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "../../../infrastructure/http.ts";
import { buildRateLimitKey, createVercelKvRateLimiter, type RateLimiter } from "../../../infrastructure/rate-limit.ts";

export const prerender = false;

export interface DeviceChallengeRouteOptions {
  readonly secret?: string;
  readonly ttlSeconds?: number;
  readonly rateLimiter?: RateLimiter;
}

export function createDeviceChallengeRoute(options: DeviceChallengeRouteOptions = {}): APIRoute {
  return async ({ request }) => {
    let installId: string | undefined;
    let stage = "parse";
    try {
      installId = new URL(request.url).searchParams.get("installId")?.trim() || undefined;
      if (!installId) {
        throw new HttpJsonError(400, "Missing query parameter: installId");
      }

      stage = "rate-limit";
      const rateLimiter = options.rateLimiter ?? createVercelKvRateLimiter();
      const now = Date.now();
      const installDecision = await rateLimiter.consume(
        buildRateLimitKey("device:challenge", installId, 60 * 60, now),
        30,
        60 * 60,
        now,
      );
      if (installDecision && !installDecision.allowed) {
        return jsonResponse({ error: "Rate limit exceeded" }, 429);
      }

      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
      if (ip) {
        const ipDecision = await rateLimiter.consume(
          buildRateLimitKey("device:challenge:ip", ip, 60 * 60, now),
          120,
          60 * 60,
          now,
        );
        if (ipDecision && !ipDecision.allowed) {
          return jsonResponse({ error: "Rate limit exceeded" }, 429);
        }
      }

      stage = "challenge-signing";
      const secret =
        options.secret ??
        readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") ??
        process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
      if (!secret || secret.trim().length === 0) {
        throw new HttpJsonError(500, "Missing LEMON_WEB_CAPABILITY_TOKEN_SECRET");
      }

      // Keep the challenge token format aligned with the verifier in /api/device/session.
      const tokenService = createCapabilityTokenService({
        secret: secret.trim(),
        challengeTokenTtlSeconds: options.ttlSeconds ?? 5 * 60,
      });

      const current = Date.now();
      const ttlSeconds = options.ttlSeconds ?? 5 * 60;
      const challenge = tokenService.signChallengeToken({
        installId,
        challengeId: randomUUID(),
      });

      return jsonResponse(
        {
          challenge,
          installId,
          expiresAt: new Date(current + ttlSeconds * 1000).toISOString(),
        },
        200,
      );
    } catch (error) {
      if (error instanceof HttpJsonError) {
        console.error("[LemonWebDeviceChallengeRoute] Request failed", {
          stage,
          status: error.status,
          message: error.message,
          installId,
        });
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebDeviceChallengeRoute] Unhandled failure", {
        stage,
        error,
        installId,
      });
      return jsonResponse({ error: "Internal challenge error" }, 500);
    }
  };
}

export const GET = createDeviceChallengeRoute();

function readEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
