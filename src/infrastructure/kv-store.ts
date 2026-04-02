import { kv } from "@vercel/kv";

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { readonly ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

export function createVercelKvStore(): KeyValueStore {
  return {
    async get<T>(key: string): Promise<T | null> {
      return (await kv.get<T>(key)) ?? null;
    },
    async set<T>(key: string, value: T, options?: { readonly ex?: number }): Promise<void> {
      await kv.set(key, value, options?.ex ? { ex: options.ex } : undefined);
    },
    async del(key: string): Promise<void> {
      await kv.del(key);
    },
    async incr(key: string): Promise<number> {
      return kv.incr(key);
    },
    async expire(key: string, seconds: number): Promise<void> {
      await kv.expire(key, seconds);
    },
  };
}

export function createMemoryKvStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  const expiries = new Map<string, number>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const expiry = expiries.get(key);
      if (expiry !== undefined && expiry <= Date.now()) {
        values.delete(key);
        expiries.delete(key);
        return null;
      }

      return (values.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T, options?: { readonly ex?: number }): Promise<void> {
      values.set(key, value);
      if (options?.ex !== undefined) {
        expiries.set(key, Date.now() + options.ex * 1000);
      }
    },
    async del(key: string): Promise<void> {
      values.delete(key);
      expiries.delete(key);
    },
    async incr(key: string): Promise<number> {
      const current = values.get(key);
      const next = typeof current === "number" ? current + 1 : 1;
      values.set(key, next);
      return next;
    },
    async expire(key: string, seconds: number): Promise<void> {
      if (values.has(key)) {
        expiries.set(key, Date.now() + seconds * 1000);
      }
    },
  };
}
