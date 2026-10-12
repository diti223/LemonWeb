import { describe, expect, it, vi } from "vitest";
import { createMemoryKvStore, type KeyValueStore } from "../../src/infrastructure/kv-store.ts";
import { createDeviceChallengeRoute } from "../../src/pages/api/device/challenge.ts";
import { createFailoverKeyValueStore, createVercelKvRateLimiter } from "../../src/infrastructure/rate-limit.ts";
import { TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

describe("GET /api/device/challenge", () => {
  it("issues a challenge after Redis fails and the rate limiter switches to memory", async () => {
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
