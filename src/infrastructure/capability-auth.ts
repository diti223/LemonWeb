import { HttpJsonError } from "./http.ts";
import {
  capabilityTokenSecret,
  hasCapabilityScope,
  parseBearerToken,
  verifyCapabilityToken,
  type CapabilityScope,
  type CapabilityTokenClaims,
} from "./capability-token.ts";
import {
  buildRateLimitKey,
  createVercelKvRateLimiter,
  type RateLimiter,
} from "./rate-limit.ts";

export interface CapabilityAuthorizationOptions {
  requiredScope: CapabilityScope;
  rateLimitScope?: string;
  rateLimitLimit?: number;
  rateLimitWindowSeconds?: number;
  rateLimitIpLimit?: number;
  rateLimitIpWindowSeconds?: number;
  rateLimiter?: RateLimiter;
  tokenSecret?: string;
  now?: () => number;
}

export async function authorizeCapabilityRequest(
  request: Request,
  options: CapabilityAuthorizationOptions,
): Promise<CapabilityTokenClaims> {
  const bearerToken = parseBearerToken(request);
  if (!bearerToken) {
    throw new HttpJsonError(401, "Unauthorized");
  }

  const claims = verifyCapabilityToken(bearerToken, {
    secret: options.tokenSecret ?? capabilityTokenSecret(),
    now: options.now?.() ?? Date.now(),
  });
  if (!claims || !hasCapabilityScope(claims.scopes, options.requiredScope)) {
    throw new HttpJsonError(403, "Forbidden");
  }

  const rateLimitLimit = options.rateLimitLimit ?? 60;
  const rateLimitWindowSeconds = options.rateLimitWindowSeconds ?? 60 * 60;
  const limiter = options.rateLimiter ?? createVercelKvRateLimiter();
  const decision = await limiter.consume(
    buildRateLimitKey(
      options.rateLimitScope ?? options.requiredScope,
      claims.installId,
      rateLimitWindowSeconds,
      options.now?.() ?? Date.now(),
    ),
    rateLimitLimit,
    rateLimitWindowSeconds,
  );
  if (decision && !decision.allowed) {
    throw new HttpJsonError(429, "Rate limit exceeded");
  }

  const rateLimitIpLimit = options.rateLimitIpLimit;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  if (rateLimitIpLimit && ip) {
    const ipWindowSeconds = options.rateLimitIpWindowSeconds ?? rateLimitWindowSeconds;
    const ipDecision = await limiter.consume(
      buildRateLimitKey(
        `${options.rateLimitScope ?? options.requiredScope}:ip`,
        ip,
        ipWindowSeconds,
        options.now?.() ?? Date.now(),
      ),
      rateLimitIpLimit,
      ipWindowSeconds,
    );
    if (ipDecision && !ipDecision.allowed) {
      throw new HttpJsonError(429, "Rate limit exceeded");
    }
  }

  return claims;
}
