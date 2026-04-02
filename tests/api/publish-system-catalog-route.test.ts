import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createPublishSystemCatalogRoute } from "../../src/pages/api/system-catalog/index.ts";
import { InMemorySystemCatalogRepository } from "../support/system-catalog-fixtures.ts";

describe("POST /api/system-catalog", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const handler = createPublishSystemCatalogRoute(() =>
      createLemonWebApplication({
        systemCatalogRepository: new InMemorySystemCatalogRepository(null, []),
        requestAuthenticator: { isAuthorized: () => false },
      }),
    );

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog", {
        method: "POST",
      }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("publishes a catalog and updates the manifest", async () => {
    const repository = new InMemorySystemCatalogRepository(null, []);
    const handler = createPublishSystemCatalogRoute(() =>
      createLemonWebApplication({
        systemCatalogRepository: repository,
        requestAuthenticator: { isAuthorized: () => true },
      }),
    );

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          catalog: "food-items",
          version: "2.2",
          payload: { items: [] },
        }),
      }),
    } as any);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      manifest: {
        schemaVersion: "1.0",
        foodItems: {
          version: "2.2",
        },
      },
    });
  });
});
