import type { APIRoute } from "astro";
import { parseBearerToken, verifyCapabilityToken, type CapabilityScope, type CapabilityTokenClaims, type CapabilityTokenService } from "../../../../infrastructure/capability-token.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "../../../../infrastructure/http.ts";
import { buildRateLimitKey, createVercelKvRateLimiter, type RateLimitDecision, type RateLimiter } from "../../../../infrastructure/rate-limit.ts";

export const prerender = false;

export interface AIGatewayRouteOptions {
  readonly tokenSecret?: string;
  readonly rateLimiter?: RateLimiter;
  readonly textLimit?: number;
  readonly textWindowSeconds?: number;
  readonly imageLimit?: number;
  readonly imageWindowSeconds?: number;
}

export interface AIGatewayBackend {
  readonly capabilityTokens: CapabilityTokenService;
  readonly rateLimiter?: RateLimiter;
}

type AiProvider = "openai" | "anthropic" | "google";
type AiGatewayRouteInput = AIGatewayRouteOptions | (() => AIGatewayBackend);

export function createAIGatewayRoute(input: AiGatewayRouteInput = {}): APIRoute {
  return async ({ params, request }) => {
    try {
      const provider = normalizeProvider(params.provider);
      const path = normalizePath(params.path);
      const routeType = isImageRoute(provider, path) ? "ai:image" : "ai:text";
      const now = Date.now();
      const { claims, rateLimiter } = resolveClaimsAndLimiter(input, request);

      if (!claims.scopes.includes(routeType as CapabilityScope)) {
        throw new HttpJsonError(403, "Forbidden");
      }

      const limiter = rateLimiter ?? createVercelKvRateLimiter();
      const windowSeconds = routeType === "ai:image" ? 24 * 60 * 60 : 60 * 60;

      const installDecision = await limiter.consume(
        buildRateLimitKey(`ai:${routeType}`, claims.installId, windowSeconds, now),
        routeType === "ai:image" ? 5 : 60,
        windowSeconds,
        now,
      );
      if (isRateLimitExceeded(installDecision)) {
        return jsonResponse({ error: "Rate limit exceeded" }, 429);
      }

      const ip = clientIp(request);
      if (ip) {
        const ipDecision = await limiter.consume(
          buildRateLimitKey(`ai:${routeType}:ip`, ip, windowSeconds, now),
          routeType === "ai:image" ? 10 : 120,
          windowSeconds,
          now,
        );
        if (isRateLimitExceeded(ipDecision)) {
          return jsonResponse({ error: "Rate limit exceeded" }, 429);
        }
      }

      const upstream = upstreamUrl(provider, path, request.url);
      const response = await fetch(upstream, {
        method: request.method,
        headers: providerHeaders(provider),
        body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      });

      return new Response(response.body, {
        status: response.status,
        headers: filterResponseHeaders(response.headers),
      });
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebAIGatewayRoute] Unhandled failure", { error });
      return jsonResponse({ error: "Internal AI proxy error" }, 500);
    }
  };
}

export const createAiProxyRoute = createAIGatewayRoute;

const route = createAIGatewayRoute();

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
export const OPTIONS = route;
export const HEAD = route;

function resolveClaimsAndLimiter(input: AiGatewayRouteInput, request: Request): {
  claims: CapabilityTokenClaims;
  rateLimiter?: RateLimiter;
} {
  if (typeof input === "function") {
    const backend = input();
    const token = parseBearerToken(request);
    if (!token) {
      throw new HttpJsonError(401, "Unauthorized");
    }
    try {
      const claims = backend.capabilityTokens.verifyCapabilityToken(token);
      return { claims, rateLimiter: backend.rateLimiter };
    } catch {
      throw new HttpJsonError(401, "Unauthorized");
    }
  }

  const token = parseBearerToken(request);
  if (!token) {
    throw new HttpJsonError(401, "Unauthorized");
  }
  const claims = verifyCapabilityToken(token, {
    secret: input.tokenSecret,
    now: Date.now(),
  });
  if (!claims) {
    throw new HttpJsonError(401, "Unauthorized");
  }
  return { claims, rateLimiter: input.rateLimiter };
}

function normalizeProvider(value: string | undefined): AiProvider {
  if (value === "openai" || value === "anthropic" || value === "google") {
    return value;
  }
  throw new HttpJsonError(404, "Not found");
}

function normalizePath(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value.split("/").filter(Boolean);
}

function isImageRoute(provider: AiProvider, path: string[]): boolean {
  if (provider !== "google") {
    return false;
  }
  return path.some((segment) => segment.includes(":generateContent")) || path.includes("generateContent");
}

function upstreamUrl(provider: AiProvider, path: string[], currentUrl: string): string {
  const base = provider === "openai"
    ? "https://api.openai.com/"
    : provider === "anthropic"
      ? "https://api.anthropic.com/"
      : "https://generativelanguage.googleapis.com/";
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${path.join("/")}`;
  url.search = new URL(currentUrl).search;
  return url.toString();
}

function providerHeaders(provider: AiProvider): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  switch (provider) {
    case "openai":
      headers.set("authorization", `Bearer ${requireEnv("OPENAI_API_KEY")}`);
      break;
    case "anthropic":
      headers.set("x-api-key", requireEnv("ANTHROPIC_API_KEY"));
      headers.set("anthropic-version", "2023-06-01");
      break;
    case "google":
      headers.set("x-goog-api-key", requireEnv("GEMINI_API_KEY"));
      break;
  }
  return headers;
}

function requireEnv(name: string): string {
  const value = process.env[name] ?? readImportMetaEnv(name);
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",").map((value) => value.trim()).filter(Boolean);
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip") ?? undefined;
}

function filterResponseHeaders(headers: Headers): Headers {
  const responseHeaders = new Headers();
  for (const [name, value] of headers.entries()) {
    if (["content-type", "cache-control", "etag"].includes(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  }
  return responseHeaders;
}

function isRateLimitExceeded(decision: RateLimitDecision | undefined): boolean {
  return Boolean(decision && decision.allowed === false);
}

function readImportMetaEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
