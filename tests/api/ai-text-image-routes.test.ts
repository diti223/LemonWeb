import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageAIGatewayRoute, createTextAIGatewayRoute } from "../../src/infrastructure/ai-gateway.ts";
import { makeCapabilityToken, TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

beforeEach(() => {
  process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET = TEST_CAPABILITY_SECRET;
  process.env.OPENAI_API_KEY = "openai-secret";
  process.env.GEMINI_API_KEY = "gemini-secret";
  process.env.ANTHROPIC_API_KEY = "anthropic-secret";
  process.env.AI_IMAGE_ALLOWLIST_INSTALL_IDS = "install-123";
});

afterEach(() => {
  delete process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_IMAGE_ALLOWLIST_INSTALL_IDS;
  vi.unstubAllGlobals();
});

describe("/api/ai/text", () => {
  it("normalizes OpenAI responses into the app-facing AIResponse shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      expect((init?.headers as Headers).get("authorization")).toBe("Bearer openai-secret");
      return new Response(JSON.stringify({
        id: "resp-123",
        model: "gpt-5.4-mini",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              { type: "output_text", text: "{\"answer\":\"ok\"}" },
            ],
          },
        ],
        usage: {
          input_tokens: 5,
          output_tokens: 7,
          total_tokens: 12,
        },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }));

    const handler = createTextAIGatewayRoute();
    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/ai/text", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:text"])}`,
        },
        body: JSON.stringify({
          model: "gpt-5.4-mini",
          messages: [
            { role: "user", content: "Hello" },
          ],
          format: "json",
        }),
      }),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      requestedModel: "gpt-5.4-mini",
      resolvedModel: "gpt-5.4-mini",
      fallbackUsed: false,
      providerRequestID: "resp-123",
      messages: [
        {
          role: "assistant",
          content: "{\"answer\":\"ok\"}",
        },
      ],
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      },
    });
  });

  it("returns 403 when the token lacks ai:text", async () => {
    const handler = createTextAIGatewayRoute();
    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/ai/text", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:image"])}`,
        },
        body: JSON.stringify({
          model: "gpt-5.4-mini",
          messages: [
            { role: "user", content: "Hello" },
          ],
        }),
      }),
    } as any);

    expect(response.status).toBe(403);
  });
});

describe("/api/ai/image", () => {
  it("normalizes Gemini image responses into the app-facing image response shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent");
      expect((init?.headers as Headers).get("x-goog-api-key")).toBe("gemini-secret");
      return new Response(JSON.stringify({
        model: "gemini-3.1-flash-image",
        candidates: [
          {
            content: {
              parts: [
                { text: "Styled image ready." },
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
    }));

    const handler = createImageAIGatewayRoute();
    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/ai/image", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:image"])}`,
        },
        body: JSON.stringify({
          sourceImageData: Buffer.from([0x0A]).toString("base64"),
          sourceMimeType: "image/jpeg",
          promptText: "Make it fancy",
          model: "gemini-3.1-flash-image",
        }),
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      model: "gemini-3.1-flash-image",
      responseText: "Styled image ready.",
      usage: {
        outputImageCount: 1,
      },
    });
    expect(Buffer.from(body.generatedImageData, "base64")).toEqual(Buffer.from([0x01, 0x02, 0x03]));
  });

  it("returns 403 when the install is not allowlisted", async () => {
    const handler = createImageAIGatewayRoute({
      allowlistedInstallIds: new Set(["another-install"]),
    });
    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/ai/image", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["ai:image"])}`,
        },
        body: JSON.stringify({
          sourceImageData: Buffer.from([0x0A]).toString("base64"),
          sourceMimeType: "image/jpeg",
          promptText: "Make it fancy",
          model: "gemini-3.1-flash-image",
        }),
      }),
    } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Magic Photo is not enabled for this install",
    });
  });
});
