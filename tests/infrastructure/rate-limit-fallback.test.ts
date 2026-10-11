import { describe, expect, it, vi } from "vitest";
import { createMemoryKvStore, type KeyValueStore } from "../../src/infrastructure/kv-store.ts";
import { createFailoverKeyValueStore } from "../../src/infrastructure/rate-limit.ts";

describe("createFailoverKeyValueStore", () => {
  it("switches to the fallback after an asynchronous primary failure", async () => {
    const primary = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      del: vi.fn(async () => undefined),
      incr: vi.fn(async () => { throw new Error("getaddrinfo ENOTFOUND redis.example"); }),
      expire: vi.fn(async () => undefined),
    } satisfies KeyValueStore;
    const fallback = createMemoryKvStore();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createFailoverKeyValueStore(primary, fallback, "Redis");

    try {
      await expect(store.incr("challenge:install-1")).resolves.toBe(1);
      await expect(store.incr("challenge:install-1")).resolves.toBe(2);
      expect(primary.incr).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
