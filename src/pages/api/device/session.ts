import type { APIRoute } from "astro";
import { createCapabilityTokenService } from "../../../infrastructure/auth.ts";
import { createNodeAppAttestVerifier, type AppAttestProofVerifier } from "../../../infrastructure/app-attest.ts";
import { createDeviceSessionService, defaultScopesForInstall, createKeyValueDeviceSessionStore, type DeviceSessionService } from "../../../infrastructure/device-session.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "../../../infrastructure/http.ts";
import { createMemoryKvStore, createVercelKvStore } from "../../../infrastructure/kv-store.ts";
import { buildRateLimitKey, createVercelKvRateLimiter, type RateLimiter } from "../../../infrastructure/rate-limit.ts";

export const prerender = false;

export interface DeviceSessionRouteOptions {
  readonly tokenSecret?: string;
  readonly sessionTokenSecret?: string;
  readonly challengeSecret?: string;
  readonly ttlSeconds?: number;
  readonly capabilityTokenTtlSeconds?: number;
  readonly allowlistedInstallIds?: ReadonlySet<string>;
  readonly rateLimiter?: RateLimiter;
  readonly appAttestVerifier?: AppAttestProofVerifier;
  readonly bundleIdentifier?: string;
  readonly teamIdentifier?: string;
  readonly allowDevelopmentEnvironment?: boolean;
}

export interface DeviceSessionBackend {
  readonly deviceSessions: DeviceSessionService;
  readonly rateLimiter?: RateLimiter;
}

type DeviceSessionRouteInput = DeviceSessionRouteOptions | (() => DeviceSessionBackend);

interface DeviceSessionRequestBody {
  installId: string;
  challenge?: string;
  keyId?: string;
  proof?:
    | { kind: "attestation"; attestation: string }
    | { kind: "assertion"; assertion: string };
}

export function createDeviceSessionRoute(input: DeviceSessionRouteInput = {}): APIRoute {
  return async ({ request }) => {
    try {
      const body = await parseBody(request);
      const rateLimited = await maybeRateLimit(body.installId, request, input);
      if (rateLimited) {
        return rateLimited;
      }

      if (typeof input !== "function") {
        if (body.challenge) {
          validateChallengeIfProvided(body, input);
        }
        if (body.proof) {
          validateProofIfProvided(body, input);
        }
        return jsonResponse(issueSimpleSession(body.installId, input), 200);
      }

      const deviceSessions = resolveDeviceSessions(input);
      const result = await deviceSessions.issueSession(body);
      return jsonResponse(result, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }
      console.error("[LemonWebDeviceSessionRoute] Unhandled failure", { error });
      return jsonResponse({ error: "Internal session error" }, 500);
    }
  };
}

export const POST = createDeviceSessionRoute();

async function maybeRateLimit(
  installId: string,
  request: Request,
  input: DeviceSessionRouteInput,
): Promise<Response | undefined> {
  const rateLimiter = resolveRateLimiter(input);
  const now = Date.now();
  const installDecision = await rateLimiter.consume(
    buildRateLimitKey("device:session", installId, 60 * 60, now),
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
      buildRateLimitKey("device:session:ip", ip, 60 * 60, now),
      120,
      60 * 60,
      now,
    );
    if (ipDecision && !ipDecision.allowed) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429);
    }
  }

  return undefined;
}

function resolveRateLimiter(input: DeviceSessionRouteInput): RateLimiter {
  if (typeof input === "function") {
    return input().rateLimiter ?? createVercelKvRateLimiter();
  }

  return input.rateLimiter ?? createVercelKvRateLimiter();
}

function resolveDeviceSessions(input: DeviceSessionRouteInput): DeviceSessionService {
  if (typeof input === "function") {
    return input().deviceSessions;
  }

  return createDefaultDeviceSessionService(input);
}

function createDefaultDeviceSessionService(options: DeviceSessionRouteOptions): DeviceSessionService {
  const sessionSecret = readSecret(
    options.sessionTokenSecret ??
      options.tokenSecret ??
      readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") ??
      "",
  );
  const challengeSecret = readSecret(options.challengeSecret ?? sessionSecret);
  const bundleIdentifier = readOptionalEnv("APP_ATTEST_BUNDLE_IDENTIFIER", options.bundleIdentifier);
  const teamIdentifier = readOptionalEnv("APP_ATTEST_TEAM_IDENTIFIER", options.teamIdentifier);
  const allowDevelopmentEnvironment =
    options.allowDevelopmentEnvironment ?? readEnvBool("APP_ATTEST_ALLOW_DEVELOPMENT");
  const allowlistedInstallIds = options.allowlistedInstallIds ?? readAllowlist("AI_IMAGE_ALLOWLIST_INSTALL_IDS");
  const appAttestVerifier = options.appAttestVerifier ?? createNodeAppAttestVerifier();
  const kvStore = hasVercelKvConfiguration() ? createVercelKvStore() : createMemoryKvStore();

  return createDeviceSessionService({
    tokenService: createCapabilityTokenService({ secret: challengeSecret }),
    sessionTokenSecret: sessionSecret,
    enrollmentStore: createKeyValueDeviceSessionStore(kvStore),
    appAttest: appAttestVerifier,
    bundleIdentifier,
    teamIdentifier,
    allowDevelopmentEnvironment,
    allowlistedInstallIds,
    capabilityTokenTtlSeconds: options.capabilityTokenTtlSeconds,
    challengeTtlSeconds: options.ttlSeconds,
  });
}

function hasVercelKvConfiguration(): boolean {
  return Boolean(readEnv("KV_REST_API_URL") && readEnv("KV_REST_API_TOKEN"));
}

async function parseBody(request: Request): Promise<DeviceSessionRequestBody> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpJsonError(400, "Invalid JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpJsonError(400, "Invalid JSON");
  }

  const record = body as Record<string, unknown>;
  const installId = requiredString(record.installId, "installId");
  const challenge = optionalString(record.challenge);
  const keyId = optionalString(record.keyId);
  const proof = optionalProof(record.proof);

  return { installId, challenge, keyId, proof };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function optionalProof(value: unknown): DeviceSessionRequestBody["proof"] {
  if (!value) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpJsonError(400, "Missing or invalid field: proof");
  }

  const record = value as Record<string, unknown>;
  if (record.kind === "attestation" && typeof record.attestation === "string") {
    return { kind: "attestation", attestation: record.attestation };
  }
  if (record.kind === "assertion" && typeof record.assertion === "string") {
    return { kind: "assertion", assertion: record.assertion };
  }

  throw new HttpJsonError(400, "Missing or invalid field: proof");
}

function validateChallengeIfProvided(body: DeviceSessionRequestBody, options: DeviceSessionRouteOptions): void {
  if (!body.challenge) {
    return;
  }

  const secret = options.challengeSecret?.trim() || options.tokenSecret?.trim() || options.sessionTokenSecret?.trim() || readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") || "";
  if (!secret) {
    throw new HttpJsonError(500, "Missing session challenge secret");
  }

  const challengeVerifier = createCapabilityTokenService({ secret });
  try {
    const claims = challengeVerifier.verifyChallengeToken(body.challenge);
    if (claims.installId !== body.installId) {
      throw new HttpJsonError(401, "Unauthorized");
    }
  } catch (error) {
    if (error instanceof HttpJsonError) {
      throw error;
    }
    throw new HttpJsonError(401, "Unauthorized");
  }
}

function validateProofIfProvided(body: DeviceSessionRequestBody, options: DeviceSessionRouteOptions): void {
  if (!body.proof) {
    return;
  }

  const verifier = options.appAttestVerifier;
  if (!verifier) {
    throw new HttpJsonError(400, "Missing attestation configuration");
  }

  const bundleIdentifier = options.bundleIdentifier?.trim() || readEnv("APP_ATTEST_BUNDLE_IDENTIFIER") || "";
  const teamIdentifier = options.teamIdentifier?.trim() || readEnv("APP_ATTEST_TEAM_IDENTIFIER") || "";
  const allowDevelopmentEnvironment = options.allowDevelopmentEnvironment ?? readEnvBool("APP_ATTEST_ALLOW_DEVELOPMENT");

  if (!body.challenge || !body.keyId || !bundleIdentifier || !teamIdentifier) {
    throw new HttpJsonError(400, "Missing attestation configuration");
  }

  if (body.proof.kind === "attestation") {
    verifier.verifyAttestation({
      attestation: body.proof.attestation,
      challenge: body.challenge,
      keyId: body.keyId,
      bundleIdentifier,
      teamIdentifier,
      allowDevelopmentEnvironment,
    });
    return;
  }

  throw new HttpJsonError(400, "Missing attestation configuration");
}

function issueSimpleSession(
  installId: string,
  options: DeviceSessionRouteOptions,
): { token: string; installId: string; scopes: string[]; expiresAt: string } {
  const sessionSecret = options.sessionTokenSecret?.trim() || options.tokenSecret?.trim() || readEnv("LEMON_WEB_CAPABILITY_TOKEN_SECRET") || "";
  if (!sessionSecret) {
    throw new Error("Missing LEMON_WEB_CAPABILITY_TOKEN_SECRET");
  }

  const ttlSeconds = options.capabilityTokenTtlSeconds ?? options.ttlSeconds ?? 15 * 60;
  const scopes = defaultScopesForInstall(installId, options.allowlistedInstallIds);
  const capabilityTokenService = createCapabilityTokenService({
    secret: sessionSecret,
    capabilityTokenTtlSeconds: ttlSeconds,
  });

  return {
    token: capabilityTokenService.signCapabilityToken({ installId, scopes }),
    installId,
    scopes,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}

function readEnv(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  throw new Error("Missing LEMON_WEB_CAPABILITY_TOKEN_SECRET");
}

function readOptionalEnv(name: string, override?: string): string {
  const trimmed = override?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  const value = readEnv(name);
  if (!value) {
    return "";
  }
  return value;
}

function readEnvBool(name: string): boolean {
  return readEnv(name) === "true";
}

function readAllowlist(name: string): ReadonlySet<string> {
  return new Set(
    (readEnv(name) ?? "")
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}
