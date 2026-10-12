import { createCapabilityTokenService } from "./auth.ts";
import { createNodeAppAttestVerifier, type AppAttestProofVerifier } from "./app-attest.ts";
import { createDeviceSessionService, createKeyValueDeviceSessionStore, type DeviceSessionService } from "./device-session.ts";
import { createMemoryKvStore, createRedisStore, createVercelKvStore } from "./kv-store.ts";
import { createVercelKvRateLimiter, type RateLimiter } from "./rate-limit.ts";
import type { KeyValueStore } from "./kv-store.ts";

export interface DeviceSessionBackend {
  readonly deviceSessions: DeviceSessionService;
  readonly rateLimiter?: RateLimiter;
}

export interface DeviceSessionBackendOptions {
  readonly tokenSecret?: string;
  readonly sessionTokenSecret?: string;
  readonly challengeSecret?: string;
  readonly ttlSeconds?: number;
  readonly capabilityTokenTtlSeconds?: number;
  readonly allowlistedInstallIds?: ReadonlySet<string>;
  readonly appAttestVerifier?: AppAttestProofVerifier;
  readonly bundleIdentifier?: string;
  readonly teamIdentifier?: string;
  readonly allowDevelopmentEnvironment?: boolean;
}

let defaultDeviceSessionBackend: DeviceSessionBackend | undefined;

export function createDefaultDeviceSessionBackend(): DeviceSessionBackend {
  if (defaultDeviceSessionBackend) {
    return defaultDeviceSessionBackend;
  }
  const kvStore = createConfiguredDeviceSessionStore();
  defaultDeviceSessionBackend = {
    deviceSessions: createDefaultDeviceSessionService({}, kvStore),
    rateLimiter: createVercelKvRateLimiter(kvStore),
  };
  return defaultDeviceSessionBackend;
}

export function createDefaultDeviceSessionService(
  options: DeviceSessionBackendOptions,
  kvStore = createConfiguredDeviceSessionStore(),
): DeviceSessionService {
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
  return createDeviceSessionService({
    tokenService: createCapabilityTokenService({ secret: challengeSecret }),
    sessionTokenSecret: sessionSecret,
    enrollmentStore: createKeyValueDeviceSessionStore(kvStore),
    appAttest: appAttestVerifier,
    bundleIdentifier,
    teamIdentifier,
    allowDevelopmentEnvironment,
    installIdAllowlist: allowlistedInstallIds,
    capabilityTokenTtlSeconds: options.capabilityTokenTtlSeconds,
    challengeTtlSeconds: options.ttlSeconds,
  });
}

function createConfiguredDeviceSessionStore(): KeyValueStore {
  if (readEnv("REDIS_URL")) {
    return createRedisStore();
  }
  if (hasVercelKvConfiguration()) {
    return createVercelKvStore();
  }
  if (readEnv("VERCEL_ENV") === "production") {
    throw new Error("Device sessions require REDIS_URL or Vercel KV in production");
  }
  return createMemoryKvStore();
}

function hasVercelKvConfiguration(): boolean {
  return Boolean(readEnv("KV_REST_API_URL") && readEnv("KV_REST_API_TOKEN"));
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
