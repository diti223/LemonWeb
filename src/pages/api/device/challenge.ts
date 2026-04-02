import { randomUUID } from "node:crypto";
import type { APIRoute } from "astro";
import { createSignedTokenService } from "../../../infrastructure/signed-token.ts";
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
    try {
      const installId = new URL(request.url).searchParams.get("installId");
      if (!installId) {
        throw new HttpJsonError(400, "Missing query parameter: installId");
      }

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

      const secret =
        options.secret ??
        readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") ??
        process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
      if (!secret || secret.trim().length === 0) {
        throw new Error("Missing LEMON_WEB_CAPABILITY_TOKEN_SECRET");
      }

      const signer = createSignedTokenService<{
        kind: "device-challenge";
        installId: string;
        challengeId: string;
        iat: number;
        exp: number;
      }>({
        secret: secret.trim(),
      });

      const current = Date.now();
      const ttlSeconds = options.ttlSeconds ?? 5 * 60;
      const challenge = signer.sign({
        kind: "device-challenge",
        installId,
        challengeId: randomUUID(),
        iat: Math.floor(current / 1000),
        exp: Math.floor((current + ttlSeconds * 1000) / 1000),
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
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebDeviceChallengeRoute] Unhandled failure", { error });
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
