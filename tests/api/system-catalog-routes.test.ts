import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createGetFoodItemsSystemCatalogRoute } from "../../src/pages/api/system-catalog/food-items.ts";
import { createGetStarterRecipesSystemCatalogRoute } from "../../src/pages/api/system-catalog/starter-recipes.ts";
import { makeStoredSystemCatalog, InMemorySystemCatalogRepository } from "../support/system-catalog-fixtures.ts";

describe("GET /api/system-catalog/[catalog]", () => {
  it("returns the food items catalog without authentication", async () => {
    const repository = new InMemorySystemCatalogRepository(null, [
      makeStoredSystemCatalog("food-items", { items: [{ id: "1", name: "Milk" }] }),
    ]);
    const handler = createGetFoodItemsSystemCatalogRoute(() =>
      createLemonWebApplication({ systemCatalogRepository: repository }),
    );

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog/food-items"),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: "1", name: "Milk" }] });
  });

  it("returns 304 when the starter recipes ETag matches", async () => {
    const repository = new InMemorySystemCatalogRepository(null, [
      makeStoredSystemCatalog("starter-recipes", { recipes: [{ id: "a" }] }),
    ]);
    const handler = createGetStarterRecipesSystemCatalogRoute(() =>
      createLemonWebApplication({ systemCatalogRepository: repository }),
    );

    const firstResponse = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog/starter-recipes"),
    } as any);
    const etag = firstResponse.headers.get("etag");

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog/starter-recipes", {
        headers: etag ? { "if-none-match": etag } : undefined,
      }),
    } as any);

    expect(response.status).toBe(304);
  });
});
