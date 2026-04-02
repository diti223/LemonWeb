import { createMemoryKvStore, createVercelKvStore, type KeyValueStore } from "./kv-store.ts";
import { toUnixSeconds } from "./signed-token.ts";

export interface RateLimitQuota {
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly key: string;
}

export interface RouteRateLimitPolicy {
  readonly install?: RateLimitQuota;
  readonly ip?: RateLimitQuota;
}

export interface RateLimitContext {
  readonly route: string;
  readonly installId?: string;
  readonly ip?: string;
}

export interface RateLimitService {
  consume(context: RateLimitContext, policy: RouteRateLimitPolicy): Promise<RateLimitResult | undefined>;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: number;
  readonly key: string;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number, now?: number): Promise<RateLimitDecision>;
}

export function createRateLimitService(store: KeyValueStore, now: () => Date = () => new Date()): RateLimitService {
  return {
    async consume(context, policy) {
      const subjects: Array<[string, RateLimitQuota | undefined]> = [
        ["install", policy.install && context.installId ? policy.install : undefined],
        ["ip", policy.ip && context.ip ? policy.ip : undefined],
      ];

      let failure: RateLimitResult | undefined;

      for (const [dimension, quota] of subjects) {
        if (!quota) {
          continue;
        }

        const subject = dimension === "install" ? context.installId : context.ip;
        if (!subject) {
          continue;
        }

        const result = await consumeFixedWindow(
          store,
          `${context.route}:${dimension}:${subject}`,
          quota,
          now,
        );

        if (!result.allowed && !failure) {
          failure = result;
        }
      }

      return failure;
    },
  };
}

export function buildRateLimitKey(
  scope: string,
  installId: string,
  windowSeconds: number,
  now: number = Date.now(),
): string {
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  return `rate:${scope}:${installId}:${windowStart}`;
}

export function createInMemoryRateLimiter(): RateLimiter {
  const counts = new Map<string, number>();
  return {
    async consume(key: string, limit: number, windowSeconds: number, now: number = Date.now()): Promise<RateLimitDecision> {
      const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
      const windowKey = `${key}:${windowStart}`;
      const count = (counts.get(windowKey) ?? 0) + 1;
      counts.set(windowKey, count);
      const resetAt = windowStart + windowSeconds * 1000;
      return {
        allowed: count <= limit,
        count,
        limit,
        remaining: Math.max(limit - count, 0),
        resetAt,
        key: windowKey,
      };
    },
  };
}

export function createVercelKvRateLimiter(store?: KeyValueStore): RateLimiter {
  const kvStore = store ?? createDefaultRateLimitStore();
  return {
    async consume(key: string, limit: number, windowSeconds: number, now: number = Date.now()): Promise<RateLimitDecision> {
      const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
      const windowKey = `${key}:${windowStart}`;
      const count = await kvStore.incr(windowKey);
      if (count === 1) {
        await kvStore.expire(windowKey, windowSeconds + 5);
      }
      const resetAt = windowStart + windowSeconds * 1000;
      return {
        allowed: count <= limit,
        count,
        limit,
        remaining: Math.max(limit - count, 0),
        resetAt,
        key: windowKey,
      };
    },
  };
}

function createDefaultRateLimitStore(): KeyValueStore {
  const hasVercelKvConfiguration = Boolean(readEnv("KV_REST_API_URL") && readEnv("KV_REST_API_TOKEN"));

  if (!hasVercelKvConfiguration) {
    return createMemoryKvStore();
  }

  return createVercelKvStore();
}

function readEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function consumeFixedWindow(
  store: KeyValueStore,
  keyPrefix: string,
  quota: RateLimitQuota,
  now: () => Date = () => new Date(),
): Promise<RateLimitResult> {
  const current = now();
  const windowStart = Math.floor(current.getTime() / (quota.windowSeconds * 1000)) * quota.windowSeconds * 1000;
  const windowKey = `${keyPrefix}:${windowStart}`;
  const count = await store.incr(windowKey);
  if (count === 1) {
    await store.expire(windowKey, quota.windowSeconds + 5);
  }

  const allowed = count <= quota.limit;
  const resetAt = new Date(windowStart + quota.windowSeconds * 1000);
  return {
    allowed,
    count,
    limit: quota.limit,
    remaining: Math.max(quota.limit - count, 0),
    resetAt,
    key: windowKey,
  };
}

export function quotaExceededMessage(result: RateLimitResult): string {
  return `Rate limit exceeded. Retry after ${result.resetAt.toISOString()}`;
}

export function defaultRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(Math.max(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000), 0)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(toUnixSeconds(result.resetAt)),
  };
}
