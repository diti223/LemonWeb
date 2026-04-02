import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type CapabilityScope = "ai:text" | "ai:image" | "extract" | "publish" | "images:write" | "recipes:delete" | "system-catalog:write";

export interface CapabilityTokenClaims {
  installId: string;
  scopes: CapabilityScope[];
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
}

export interface CapabilityTokenIssueInput {
  installId: string;
  scopes: CapabilityScope[];
  ttlSeconds?: number;
  issuedAt?: number;
  tokenId?: string;
  secret?: string;
}

export interface CapabilityTokenVerifyOptions {
  secret?: string;
  now?: number;
}

export const DEFAULT_CAPABILITY_TOKEN_TTL_SECONDS = 60 * 60 * 24;

export function capabilityTokenSecret(): string | undefined {
  const value =
    readImportMetaEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") ||
    process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function issueCapabilityToken(input: CapabilityTokenIssueInput): string {
  const secret = input.secret ?? capabilityTokenSecret();
  if (!secret) {
    throw new Error("Missing LEMON_WEB_CAPABILITY_TOKEN_SECRET");
  }

  const issuedAt = input.issuedAt ?? Date.now();
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_CAPABILITY_TOKEN_TTL_SECONDS;
  const claims: CapabilityTokenClaims = {
    installId: normalizeInstallId(input.installId),
    scopes: uniqueScopes(input.scopes),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds * 1000,
    tokenId: input.tokenId ?? cryptoRandomId(),
  };

  const payload = encodeBase64Url(JSON.stringify(claims));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function verifyCapabilityToken(
  token: string,
  options: CapabilityTokenVerifyOptions = {},
): CapabilityTokenClaims | null {
  const secret = options.secret ?? capabilityTokenSecret();
  if (!secret) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload, secret);
  if (!isEqual(signature, expectedSignature)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const body = parsed as Record<string, unknown>;
  const installId = readString(body.installId);
  const scopes = readScopes(body.scopes);
  const issuedAt = readNumber(body.issuedAt);
  const expiresAt = readNumber(body.expiresAt);
  const tokenId = readString(body.tokenId);

  if (!installId || !scopes || !issuedAt || !expiresAt || !tokenId) {
    return null;
  }

  if (expiresAt <= (options.now ?? Date.now())) {
    return null;
  }

  return {
    installId,
    scopes,
    issuedAt,
    expiresAt,
    tokenId,
  };
}

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) {
    return null;
  }

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || rest.length > 0) {
    return null;
  }

  return token;
}

export function hasCapabilityScope(
  scopes: CapabilityScope[],
  requiredScope: CapabilityScope,
): boolean {
  return scopes.includes(requiredScope);
}

export function normalizeInstallId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Missing installId");
  }
  return trimmed;
}

function uniqueScopes(scopes: CapabilityScope[]): CapabilityScope[] {
  return Array.from(new Set(scopes));
}

function readString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function readScopes(value: unknown): CapabilityScope[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const allowedScopes: CapabilityScope[] = [
    "ai:text",
    "ai:image",
    "extract",
    "publish",
    "images:write",
    "recipes:delete",
    "system-catalog:write",
  ];
  const scopes = value.filter((scope): scope is CapabilityScope => {
    return typeof scope === "string" && allowedScopes.includes(scope as CapabilityScope);
  });

  return scopes.length > 0 ? uniqueScopes(scopes) : null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function cryptoRandomId(): string {
  return randomUUID().replace(/-/g, "");
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
