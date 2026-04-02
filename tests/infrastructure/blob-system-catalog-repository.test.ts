import { beforeEach, describe, expect, it, vi } from "vitest";

const { putMock, headMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  headMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: putMock,
  head: headMock,
}));

describe("BlobSystemCatalogRepository", () => {
  beforeEach(() => {
    putMock.mockReset();
    headMock.mockReset();
  });

  it("writes the payload before the manifest and keeps public access", async () => {
    const { BlobSystemCatalogRepository } = await import("../../src/infrastructure/blob-system-catalog-repository.ts");
    const repository = new BlobSystemCatalogRepository();
    headMock.mockResolvedValue(null);

    putMock.mockResolvedValue({ url: "https://blob.example/system-catalog/food-items.json" });

    await repository.saveCatalog({
      catalog: "food-items",
      version: "2.2",
      payload: { items: [] },
      updatedAt: "2026-04-02T10:00:00.000Z",
    });

    expect(putMock).toHaveBeenNthCalledWith(
      1,
      "system-catalog/food-items.json",
      JSON.stringify({ items: [] }),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    );
    expect(putMock).toHaveBeenNthCalledWith(
      2,
      "system-catalog/_manifest.json",
      JSON.stringify({
        schemaVersion: "1.0",
        foodItems: {
          version: "2.2",
          updatedAt: "2026-04-02T10:00:00.000Z",
        },
      }),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    );
  });
});
