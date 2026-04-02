import { HttpJsonError } from "./http.ts";
import type { SignedTokenService } from "./signed-token.ts";
import { SignedTokenError, createSignedTokenService, fromUnixSeconds, newTokenId, toUnixSeconds } from "./signed-token.ts";
import {
  issueCapabilityToken,
  verifyCapabilityToken as verifyScopedCapabilityToken,
  type CapabilityScope,
} from "./capability-token.ts";

export interface RequestAuthenticator {
  readonly isAuthorized: (request: Request) => boolean;
}

export interface CapabilityTokenClaims {
  readonly kind: "capability";
  readonly installId: string;
  readonly scopes: string[];
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export interface ChallengeTokenClaims {
  readonly kind: "challenge";
  readonly installId: string;
  readonly challengeId: string;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export interface CapabilityTokenService {
  readonly signCapabilityToken: (claims: Omit<CapabilityTokenClaims, "kind" | "jti" | "iat" | "exp"> & Partial<Pick<CapabilityTokenClaims, "jti">>) => string;
  readonly verifyCapabilityToken: (token: string) => CapabilityTokenClaims;
  readonly signChallengeToken: (claims: Omit<ChallengeTokenClaims, "kind" | "jti" | "iat" | "exp"> & Partial<Pick<ChallengeTokenClaims, "jti">>) => string;
  readonly verifyChallengeToken: (token: string) => ChallengeTokenClaims;
}

export interface CapabilityTokenServiceOptions {
  readonly secret: string;
  readonly capabilityTokenTtlSeconds?: number;
  readonly challengeTokenTtlSeconds?: number;
  readonly now?: () => Date;
}

export function createCapabilityTokenService(options: CapabilityTokenServiceOptions): CapabilityTokenService {
  const now = options.now ?? (() => new Date());
  const capabilityTokenTtlSeconds = options.capabilityTokenTtlSeconds ?? 15 * 60;
  const challengeTokenTtlSeconds = options.challengeTokenTtlSeconds ?? 5 * 60;
  const challengeSigner = createSignedTokenService<ChallengeTokenClaims>({
    secret: options.secret,
  });

  return {
    signCapabilityToken(claims) {
      const current = now();
      return issueCapabilityToken({
        installId: claims.installId,
        scopes: [...new Set(claims.scopes)] as CapabilityScope[],
        ttlSeconds: capabilityTokenTtlSeconds,
        issuedAt: current.getTime(),
        tokenId: claims.jti ?? newTokenId(),
        secret: options.secret,
      });
    },
    verifyCapabilityToken(token) {
      const claims = verifyScopedCapabilityToken(token, {
        secret: options.secret,
        now: now().getTime(),
      });
      if (!claims) {
        throw new SignedTokenError("Invalid token");
      }

      return {
        kind: "capability",
        installId: claims.installId,
        scopes: claims.scopes,
        jti: claims.tokenId,
        iat: claims.issuedAt,
        exp: claims.expiresAt,
      };
    },
    signChallengeToken(claims) {
      const current = now();
      return challengeSigner.sign({
        kind: "challenge",
        installId: claims.installId,
        challengeId: claims.challengeId ?? newTokenId(),
        jti: claims.jti ?? newTokenId(),
        iat: toUnixSeconds(current),
        exp: toUnixSeconds(new Date(current.getTime() + challengeTokenTtlSeconds * 1000)),
      });
    },
    verifyChallengeToken(token) {
      const claims = challengeSigner.verify(token);
      validateClaimEnvelope(claims, "challenge");
      validateExpiration(claims.exp, now());
      return claims as ChallengeTokenClaims;
    },
  };
}

export function createBearerRequestAuthenticator(expectedToken?: string): RequestAuthenticator {
  const configuredToken =
    expectedToken?.trim() ||
    readImportMetaEnv("PUBLISH_API_KEY") ||
    process.env.PUBLISH_API_KEY ||
    "";

  return {
    isAuthorized(request: Request): boolean {
      if (configuredToken.trim().length === 0) {
        return false;
      }

      const token = extractBearerToken(request);
      return token === configuredToken;
    },
  };
}

export function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.get("Authorization");
  if (!header) {
    return undefined;
  }

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (rest.length > 0 || scheme !== "Bearer" || !token) {
    return undefined;
  }

  return token;
}

export function validateAuth(request: Request): boolean {
  return createBearerRequestAuthenticator().isAuthorized(request);
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function requireCapabilityToken(
  request: Request,
  service: CapabilityTokenService,
  requiredScopes: readonly string[],
): CapabilityTokenClaims {
  const token = extractBearerToken(request);
  if (!token) {
    throw new HttpJsonError(401, "Unauthorized");
  }

  let claims: CapabilityTokenClaims;
  try {
    claims = service.verifyCapabilityToken(token);
  } catch (error) {
    if (error instanceof SignedTokenError) {
      throw new HttpJsonError(error.statusCode, "Unauthorized");
    }
    throw error;
  }

  const missingScopes = requiredScopes.filter((scope) => !claims.scopes.includes(scope));
  if (missingScopes.length > 0) {
    throw new HttpJsonError(403, "Forbidden");
  }

  return claims;
}

export function isCapabilityTokenClaims(value: unknown): value is CapabilityTokenClaims {
  return isTokenClaims(value, "capability");
}

export function isChallengeTokenClaims(value: unknown): value is ChallengeTokenClaims {
  return isTokenClaims(value, "challenge");
}

function validateClaimEnvelope(claims: unknown, kind: "capability" | "challenge"): asserts claims is CapabilityTokenClaims | ChallengeTokenClaims {
  if (!isTokenClaims(claims, kind)) {
    throw new SignedTokenError("Invalid token");
  }
}

function validateExpiration(exp: number, now: Date): void {
  if (fromUnixSeconds(exp).getTime() < now.getTime()) {
    throw new SignedTokenError("Token expired");
  }
}

function isTokenClaims(value: unknown, kind: "capability" | "challenge"): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.kind === kind
    && typeof record.installId === "string"
    && typeof record.jti === "string"
    && typeof record.iat === "number"
    && typeof record.exp === "number"
    && (kind !== "capability" || Array.isArray(record.scopes));
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
