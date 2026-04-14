import { describe, expect, it, vi } from "vitest";
import { createCapabilityTokenService } from "../../src/infrastructure/auth.ts";
import { TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";
import { createDeviceSessionRoute } from "../../src/pages/api/device/session.ts";

vi.mock("../../src/infrastructure/kv-store.ts", () => ({
  createKeyValueDeviceSessionStore: vi.fn(),
  createMemoryKvStore: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => undefined),
  }),
  createVercelKvStore: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => undefined),
  }),
}));

const allowAllRateLimiter = {
  consume: vi.fn(async () => ({
    allowed: true,
    count: 1,
    limit: 30,
    remaining: 29,
    resetAt: new Date("2026-04-02T01:00:00.000Z"),
    key: "device:session:install-123",
  })),
};

const challengeService = createCapabilityTokenService({
  secret: TEST_CAPABILITY_SECRET,
  challengeTokenTtlSeconds: 24 * 60 * 60,
});

function makeChallenge(installId: string): string {
  return challengeService.signChallengeToken({
    installId,
    challengeId: "challenge-123",
    jti: "challenge-jti",
  });
}

describe("POST /api/device/session", () => {
  it("accepts debug attestation in development and issues a session", async () => {
    const handler = createDeviceSessionRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      challengeSecret: TEST_CAPABILITY_SECRET,
      ttlSeconds: 3600,
      allowlistedInstallIds: new Set(["install-123"]),
      rateLimiter: allowAllRateLimiter as any,
      allowDevelopmentEnvironment: true,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installId: "install-123",
          challenge: makeChallenge("install-123"),
          proof: {
            kind: "debug-attestation",
            attestation: "debug-attestation-token",
          },
        }),
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.installId).toBe("install-123");
    expect(body.token).toBeTruthy();
    expect(body.scopes).toEqual(expect.arrayContaining(["ai:text", "extract", "publish", "recipes:delete", "images:write", "ai:image"]));
  });

  it("rejects debug attestation in production mode", async () => {
    const handler = createDeviceSessionRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      challengeSecret: TEST_CAPABILITY_SECRET,
      ttlSeconds: 3600,
      rateLimiter: allowAllRateLimiter as any,
      allowDevelopmentEnvironment: false,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installId: "install-123",
          challenge: makeChallenge("install-123"),
          proof: {
            kind: "debug-attestation",
            attestation: "debug-attestation-token",
          },
        }),
      }),
    } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Debug attestation not allowed in production" });
  });

  it("returns a signed capability token and adds ai:image for allowlisted install ids", async () => {
    const handler = createDeviceSessionRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      challengeSecret: TEST_CAPABILITY_SECRET,
      ttlSeconds: 3600,
      allowlistedInstallIds: new Set(["allowed-install"]),
      rateLimiter: allowAllRateLimiter as any,
      appAttestVerifier: {
        verifyAttestation: vi.fn(() => ({
          keyId: "key-1",
          publicKey: "public-key",
        })),
        verifyAssertion: vi.fn(() => ({ signCount: 1 })),
      } as any,
      bundleIdentifier: "com.example.lemon",
      teamIdentifier: "TEAM123",
      allowDevelopmentEnvironment: true,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installId: "allowed-install",
          challenge: makeChallenge("allowed-install"),
          keyId: "key-1",
          proof: {
            kind: "attestation",
            attestation: "attestation-token",
          },
        }),
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.installId).toBe("allowed-install");
    expect(body.token).toBeTruthy();
    expect(body.scopes).toEqual(expect.arrayContaining(["ai:text", "extract", "publish", "recipes:delete", "images:write", "ai:image"]));
  });

  it("returns 401 when the challenge does not verify", async () => {
    const handler = createDeviceSessionRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      challengeSecret: TEST_CAPABILITY_SECRET,
      rateLimiter: allowAllRateLimiter as any,
      appAttestVerifier: {
        verifyAttestation: vi.fn(() => ({
          keyId: "key-1",
          publicKey: "public-key",
        })),
        verifyAssertion: vi.fn(() => ({ signCount: 1 })),
      } as any,
      bundleIdentifier: "com.example.lemon",
      teamIdentifier: "TEAM123",
      allowDevelopmentEnvironment: true,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installId: "install-123",
          challenge: "not-a-valid-challenge",
          keyId: "key-1",
          proof: {
            kind: "attestation",
            attestation: "attestation-token",
          },
        }),
      }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 429 when the challenge route is rate limited", async () => {
    const rateLimiter = {
      consume: vi.fn(async () => ({
        allowed: false,
        count: 31,
        limit: 30,
        remaining: 0,
        resetAt: new Date("2026-04-02T01:00:00.000Z"),
        key: "device:session:install-123",
      })),
    };

    const handler = createDeviceSessionRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      challengeSecret: TEST_CAPABILITY_SECRET,
      rateLimiter: rateLimiter as any,
      appAttestVerifier: {
        verifyAttestation: vi.fn(() => ({
          keyId: "key-1",
          publicKey: "public-key",
        })),
        verifyAssertion: vi.fn(() => ({ signCount: 1 })),
      } as any,
      bundleIdentifier: "com.example.lemon",
      teamIdentifier: "TEAM123",
      allowDevelopmentEnvironment: true,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          installId: "install-123",
          challenge: makeChallenge("install-123"),
          keyId: "key-1",
          proof: {
            kind: "assertion",
            assertion: "assertion-data",
          },
        }),
      }),
    } as any);

    expect(response.status).toBe(429);
  });
});
