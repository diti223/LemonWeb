import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createExtractRecipeRoute } from "../../src/pages/api/extract.ts";
import type { ExtractedRecipe } from "../../src/domain/extracted-recipe.ts";
import type { RecipeHtmlExtractor } from "../../src/domain/ports.ts";
import { InMemoryPublishedRecipeRepository, fixedClock, fixedPublishingPolicy } from "../support/published-recipe-fixtures.ts";
import { makeCapabilityToken, TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

vi.mock("../../src/infrastructure/rate-limit.ts", async () => {
  const actual = await vi.importActual<typeof import("../../src/infrastructure/rate-limit.ts")>("../../src/infrastructure/rate-limit.ts");
  return {
    ...actual,
    createVercelKvRateLimiter: () => ({
      consume: vi.fn(async () => ({
        allowed: true,
        count: 1,
        limit: 60,
        remaining: 59,
        resetAt: new Date("2026-04-02T01:00:00.000Z"),
        key: "extract:install-123",
      })),
    }),
  };
});

const EXTRACT_URL = "https://recipes.lemonnutrition.eu/api/extract";

beforeEach(() => {
  process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET = TEST_CAPABILITY_SECRET;
});

afterEach(() => {
  delete process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
});

const stubExtractor: RecipeHtmlExtractor = {
  extract(_html, sourceURL): ExtractedRecipe {
    return {
      title: "Test Recipe",
      imageURL: "https://example.com/image.jpg",
      ingredients: "1 cup flour",
      instructions: "Mix and bake.",
      sourceURL,
    };
  },
};

const stubFetchHtml = async (_url: string) => "<html><body></body></html>";

function makeHandler(overrides: Parameters<typeof createLemonWebApplication>[0] = {}) {
  return createExtractRecipeRoute(() =>
    createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository(),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      htmlExtractor: stubExtractor,
      htmlFetcher: stubFetchHtml,
      ...overrides,
    }),
  );
}

describe("POST /api/extract", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, { method: "POST" }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when the token does not carry the extract scope", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["publish"])}`,
        },
        body: JSON.stringify({ url: "https://allrecipes.com/recipe/12345" }),
      }),
    } as any);

    expect(response.status).toBe(403);
  });

  it("returns 400 when url field is missing", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["extract"])}`,
        },
        body: JSON.stringify({}),
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Missing or invalid field: url" });
  });

  it("returns 400 when url is not http/https", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["extract"])}`,
        },
        body: JSON.stringify({ url: "file:///etc/passwd" }),
      }),
    } as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 when url is not a valid URL", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["extract"])}`,
        },
        body: JSON.stringify({ url: "not-a-url" }),
      }),
    } as any);

    expect(response.status).toBe(400);
  });

  it("returns 200 with extracted recipe on success", async () => {
    const handler = makeHandler();

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["extract"])}`,
        },
        body: JSON.stringify({ url: "https://allrecipes.com/recipe/12345" }),
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      title: "Test Recipe",
      imageURL: "https://example.com/image.jpg",
      ingredients: "1 cup flour",
      instructions: "Mix and bake.",
      sourceURL: "https://allrecipes.com/recipe/12345",
    });
  });
});
