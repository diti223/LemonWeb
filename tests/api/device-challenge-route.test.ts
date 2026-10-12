import { describe, expect, it, vi } from "vitest";
import { createMemoryKvStore, type KeyValueStore } from "../../src/infrastructure/kv-store.ts";
import { createDeviceChallengeRoute } from "../../src/pages/api/device/challenge.ts";
import { createFailoverKeyValueStore, createVercelKvRateLimiter } from "../../src/infrastructure/rate-limit.ts";
import { TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

describe("GET /api/device/challenge", () => {
  it("returns only the enrollment key ID for the requested install", async () => {
    const getEnrollment = vi.fn(async (installId: string) => ({
      keyId: `key-for-${installId}`,
    }));
    const handler = createDeviceChallengeRoute({
      secret: TEST_CAPABILITY_SECRET,
      rateLimiter: { consume: vi.fn(async () => ({ allowed: true })) } as any,
      getEnrollment,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/challenge?installId=install-123"),
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      installId: "install-123",
      enrolledKeyId: "key-for-install-123",
    });
    expect(getEnrollment).toHaveBeenCalledExactlyOnceWith("install-123");
  });

  it("surfaces enrollment-store failures instead of treating them as no enrollment", async () => {
    const getEnrollment = vi.fn(async () => {
      throw new Error("Redis unavailable");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createDeviceChallengeRoute({
      secret: TEST_CAPABILITY_SECRET,
      rateLimiter: { consume: vi.fn(async () => ({ allowed: true })) } as any,
      getEnrollment,
    });

    try {
      const response = await handler({
        request: new Request("https://recipes.lemonnutrition.eu/api/device/challenge?installId=install-123"),
      } as any);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Internal challenge error" });
      expect(log).toHaveBeenCalledWith(
        "[LemonWebDeviceChallengeRoute] Unhandled failure",
        expect.objectContaining({ stage: "enrollment-check", installId: "install-123" }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("issues a challenge after rate-limit Redis fails when enrollment storage is healthy", async () => {
    const primary = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      del: vi.fn(async () => undefined),
      incr: vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND redis.example");
      }),
      expire: vi.fn(async () => undefined),
    } satisfies KeyValueStore;
    const fallback = createMemoryKvStore();
    const fallbackIncr = vi.spyOn(fallback, "incr");
    const store = createFailoverKeyValueStore(primary, fallback, "Redis");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const handler = createDeviceChallengeRoute({
      secret: TEST_CAPABILITY_SECRET,
      rateLimiter: createVercelKvRateLimiter(store),
      getEnrollment: vi.fn(async () => undefined),
    });

    try {
      const response = await handler({
        request: new Request("https://recipes.lemonnutrition.eu/api/device/challenge?installId=install-123", {
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      } as any);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        installId: "install-123",
        challenge: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(primary.incr).toHaveBeenCalledTimes(1);
      expect(fallbackIncr).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
