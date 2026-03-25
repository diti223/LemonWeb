import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createDeleteRecipeRoute } from "../../src/pages/api/recipes/[id].ts";
import { fixedClock, fixedPublishingPolicy, InMemoryPublishedRecipeRepository, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("DELETE /api/recipes/[id]", () => {
  it("returns 403 when the request author does not own the recipe", async () => {
    const handler = createDeleteRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      requestAuthenticator: { isAuthorized: () => true },
    }));

    const response = await handler({
      params: {
        id: "a3f8b2c1-1234-5678-9abc-def012345678",
      },
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes/a3f8b2c1-1234-5678-9abc-def012345678", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorId: "different999",
        }),
      }),
    } as any);

    expect(response.status).toBe(403);
  });

  it("returns 204 when the author owns the recipe", async () => {
    const handler = createDeleteRecipeRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository([makeStoredPublishedRecipe()]),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      requestAuthenticator: { isAuthorized: () => true },
    }));

    const response = await handler({
      params: {
        id: "a3f8b2c1-1234-5678-9abc-def012345678",
      },
      request: new Request("https://recipes.lemonnutrition.eu/api/recipes/a3f8b2c1-1234-5678-9abc-def012345678", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorId: "abc123xyz789",
        }),
      }),
    } as any);

    expect(response.status).toBe(204);
  });
});
