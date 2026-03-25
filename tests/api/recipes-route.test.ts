import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createPublishRecipeRoute } from "../../src/pages/api/recipes.ts";
import { fixedClock, fixedPublishingPolicy, InMemoryPublishedRecipeRepository, makePublishRecipeCommand, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("POST /api/recipes", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository(),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      requestAuthenticator: { isAuthorized: () => false },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
      }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when a different author tries to overwrite the recipe id", async () => {
    const handler = createPublishRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      requestAuthenticator: { isAuthorized: () => true },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
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
      requestAuthenticator: { isAuthorized: () => true },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
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
