import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createPublishRecipeRoute } from "../../src/pages/api/recipes.ts";
import { fixedClock, fixedPublishingPolicy, InMemoryPublishedRecipeRepository, makePublishRecipeCommand, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";
import { makeCapabilityToken, TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

vi.mock("../../src/infrastructure/rate-limit.ts", async () => {
  const actual = await vi.importActual<typeof import("../../src/infrastructure/rate-limit.ts")>("../../src/infrastructure/rate-limit.ts");
  return {
    ...actual,
    createVercelKvRateLimiter: () => ({
      consume: vi.fn(async () => ({
        allowed: true,
        count: 1,
        limit: 30,
        remaining: 29,
        resetAt: new Date("2026-04-02T01:00:00.000Z"),
        key: "publish:author-123",
      })),
    }),
  };
});

beforeEach(() => {
  process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET = TEST_CAPABILITY_SECRET;
});

afterEach(() => {
  delete process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
});

describe("POST /api/recipes", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository(),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
      }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when the token does not carry the publish scope", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository(),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("author-123", ["extract"])}`,
        },
        body: JSON.stringify(makePublishRecipeCommand({
          authorId: "author-123",
        })),
      }),
    } as any);

    expect(response.status).toBe(403);
  });

  it("returns 403 when a different author tries to overwrite the recipe id", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("different999", ["publish"])}`,
        },
        body: JSON.stringify(makePublishRecipeCommand({
          authorId: "different999",
        })),
      }),
    } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Recipe belongs to a different author",
    });
  });

  it("returns 400 when publish payload contains a non-web image url", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository(),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("abc123xyz789", ["publish"])}`,
        },
        body: JSON.stringify(makePublishRecipeCommand({
          imageUrl: "file:///Users/adrian/Pictures/recipe.jpg",
        })),
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid field: imageUrl",
    });
  });
});
