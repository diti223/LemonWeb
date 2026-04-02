import { describe, expect, it } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createGetSystemCatalogManifestRoute } from "../../src/pages/api/system-catalog/manifest.ts";
import { InMemorySystemCatalogRepository, fixedSystemCatalogManifest } from "../support/system-catalog-fixtures.ts";

describe("GET /api/system-catalog/manifest", () => {
  it("returns 200 without authentication when the manifest exists", async () => {
    const handler = createGetSystemCatalogManifestRoute(() =>
      createLemonWebApplication({
        systemCatalogRepository: new InMemorySystemCatalogRepository(fixedSystemCatalogManifest),
      }),
    );

    const response = await handler({ request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog/manifest") } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: "1.0",
      foodItems: {
        version: "2.1",
      },
    });
  });

  it("returns 404 when the manifest is missing", async () => {
    const handler = createGetSystemCatalogManifestRoute(() =>
      createLemonWebApplication({
        systemCatalogRepository: new InMemorySystemCatalogRepository(null, []),
      }),
    );

    const response = await handler({ request: new Request("https://recipes.lemonnutrition.eu/api/system-catalog/manifest") } as any);

    expect(response.status).toBe(404);
  });
});
