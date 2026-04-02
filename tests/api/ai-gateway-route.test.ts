import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCapabilityTokenService } from "../../src/infrastructure/auth.ts";
import { createAiProxyRoute } from "../../src/pages/api/ai/[provider]/[...path].ts";
import {
  makeAllowlistedImageCapabilityToken,
  makeCapabilityToken,
  TEST_CAPABILITY_SECRET,
} from "../support/capability-token-fixtures.ts";

beforeEach(() => {
  process.env.OPENAI_API_KEY = "openai-secret";
  process.env.GEMINI_API_KEY = "gemini-secret";
  process.env.ANTHROPIC_API_KEY = "anthropic-secret";
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  vi.unstubAllGlobals();
});

describe("POST /api/ai/[provider]/*", () => {
  it("proxies openai text requests and preserves the upstream response", async () => {
    const tokenService = createCapabilityTokenService({
      secret: TEST_CAPABILITY_SECRET,
      now: () => new Date("2026-04-02T00:00:00.000Z"),
    });
    const backend = {
      capabilityTokens: tokenService,
      rateLimiter: {
        consume: vi.fn(async () => ({
          allowed: true,
          count: 1,
          limit: 60,
          remaining: 59,
          resetAt: new Date("2026-04-02T01:00:00.000Z"),
          key: "ai:text:install-123",
        })),
      },
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      expect(init?.headers instanceof Headers).toBe(true);
      expect((init?.headers as Headers).get("authorization")).toBe("Bearer openai-secret");
      return new Response(JSON.stringify({
        id: "resp-1",
        model: "gpt-5.4-mini",
        output: [],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const handler = createAiProxyRoute(() => backend as any);
    const response = await handler({
      params: {
        provider: "openai",
        path: "v1/responses",
      },
        request: new Request("https://recipes.lemonnutrition.eu/api/ai/openai/v1/responses", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:text", "extract"])}`,
          },
          body: JSON.stringify({ model: "gpt-5.4-mini", input: [] }),
        }),
      } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "resp-1" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("proxies google image requests when the install is allowlisted for ai:image", async () => {
    const tokenService = createCapabilityTokenService({
      secret: TEST_CAPABILITY_SECRET,
      now: () => new Date("2026-04-02T00:00:00.000Z"),
    });
    const backend = {
      capabilityTokens: tokenService,
      rateLimiter: {
        consume: vi.fn(async () => ({
          allowed: true,
          count: 1,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-04-03T00:00:00.000Z"),
          key: "ai:image:install-123",
        })),
      },
    };

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/models/gemini-3.1-flash-image:generateContent");
      expect(init?.headers instanceof Headers).toBe(true);
      expect((init?.headers as Headers).get("x-goog-api-key")).toBe("gemini-secret");
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "AQID",
                  },
                },
              ],
            },
          },
        ],
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const handler = createAiProxyRoute(() => backend as any);
    const response = await handler({
      params: {
        provider: "google",
        path: "v1beta/openai/models/gemini-3.1-flash-image:generateContent",
      },
        request: new Request("https://recipes.lemonnutrition.eu/api/ai/google/v1beta/openai/models/gemini-3.1-flash-image:generateContent", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${makeAllowlistedImageCapabilityToken("install-123")}`,
          },
          body: JSON.stringify({}),
        }),
      } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      candidates: expect.any(Array),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when an image request lacks the image scope", async () => {
    const tokenService = createCapabilityTokenService({
      secret: TEST_CAPABILITY_SECRET,
      now: () => new Date("2026-04-02T00:00:00.000Z"),
    });
    const backend = {
      capabilityTokens: tokenService,
      rateLimiter: {
        consume: vi.fn(async () => ({
          allowed: true,
          count: 1,
          limit: 5,
          remaining: 4,
          resetAt: new Date("2026-04-03T00:00:00.000Z"),
          key: "ai:image:install-123",
        })),
      },
    };

    const handler = createAiProxyRoute(() => backend as any);
    const response = await handler({
      params: {
        provider: "google",
        path: "v1beta/openai/models/gemini-3.1-flash-image:generateContent",
      },
        request: new Request("https://recipes.lemonnutrition.eu/api/ai/google/v1beta/openai/models/gemini-3.1-flash-image:generateContent", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:text", "extract"])}`,
          },
          body: JSON.stringify({}),
        }),
      } as any);

    expect(response.status).toBe(403);
  });

  it("enforces per-install rate limits", async () => {
    const tokenService = createCapabilityTokenService({
      secret: TEST_CAPABILITY_SECRET,
      now: () => new Date("2026-04-02T00:00:00.000Z"),
    });
    let count = 0;
    const backend = {
      capabilityTokens: tokenService,
      rateLimiter: {
        consume: vi.fn(async () => {
          count += 1;
          if (count > 1) {
            return {
              allowed: false,
              count,
              limit: 1,
              remaining: 0,
              resetAt: new Date("2026-04-02T01:00:00.000Z"),
              key: "rate-limit-key",
            };
          }

          return {
            allowed: true,
            count,
            limit: 1,
            remaining: 1,
            resetAt: new Date("2026-04-02T01:00:00.000Z"),
            key: "rate-limit-key",
          };
        }),
      },
    };
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const handler = createAiProxyRoute(() => backend as any);
    const makeRequest = () => handler({
      params: {
        provider: "openai",
        path: "v1/responses",
      },
        request: new Request("https://recipes.lemonnutrition.eu/api/ai/openai/v1/responses", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:text", "extract"])}`,
          },
          body: JSON.stringify({ model: "gpt-5.4-mini", input: [] }),
        }),
      } as any);

    expect((await makeRequest()).status).toBe(200);
    expect((await makeRequest()).status).toBe(429);
  });
});
