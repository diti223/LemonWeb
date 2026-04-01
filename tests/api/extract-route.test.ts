import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createExtractRecipeRoute } from "../../src/pages/api/extract.ts";
import type { ExtractedRecipe } from "../../src/domain/extracted-recipe.ts";
import type { RecipeHtmlExtractor } from "../../src/domain/ports.ts";
import { InMemoryPublishedRecipeRepository, fixedClock, fixedPublishingPolicy } from "../support/published-recipe-fixtures.ts";

const EXTRACT_URL = "https://recipes.lemonnutrition.eu/api/extract";

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
    const handler = makeHandler({ extractAuthenticator: { isAuthorized: () => false } });

    const response = await handler({
      request: new Request(EXTRACT_URL, { method: "POST" }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 400 when url field is missing", async () => {
    const handler = makeHandler({ extractAuthenticator: { isAuthorized: () => true } });

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Missing or invalid field: url" });
  });

  it("returns 400 when url is not http/https", async () => {
    const handler = makeHandler({ extractAuthenticator: { isAuthorized: () => true } });

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "file:///etc/passwd" }),
      }),
    } as any);

    expect(response.status).toBe(400);
  });

  it("returns 400 when url is not a valid URL", async () => {
    const handler = makeHandler({ extractAuthenticator: { isAuthorized: () => true } });

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      }),
    } as any);

    expect(response.status).toBe(400);
  });

  it("returns 200 with extracted recipe on success", async () => {
    const handler = makeHandler({ extractAuthenticator: { isAuthorized: () => true } });

    const response = await handler({
      request: new Request(EXTRACT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
