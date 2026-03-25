import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createPublishedRecipeJsonRoute } from "../../src/pages/recipes/[slug].json.ts";
import { fixedClock, fixedPublishingPolicy, InMemoryPublishedRecipeRepository, makeStoredPublishedRecipe } from "../support/published-recipe-fixtures.ts";

describe("GET /recipes/[slug].json", () => {
  it("returns the public contract without private author fields", async () => {
    const storedRecipe = makeStoredPublishedRecipe();
    const handler = createPublishedRecipeJsonRoute(() => createLemonWebApplication({
      repository: new InMemoryPublishedRecipeRepository([storedRecipe]),
      clock: fixedClock,
      publishingPolicy: fixedPublishingPolicy,
      requestAuthenticator: { isAuthorized: () => true },
    }));

    const response = await handler({
      params: {
        slug: storedRecipe.slug,
      },
    } as any);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.authorId).toBeUndefined();
    expect(body.ingredientDisplayTexts).toBeUndefined();
    expect(body.slug).toBe(storedRecipe.slug);
  });
});
