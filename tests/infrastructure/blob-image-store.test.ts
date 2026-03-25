import { describe, expect, it, vi } from "vitest";
import { BlobImageStore } from "../../src/infrastructure/blob-image-store.ts";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://blob.example/recipes/a3f8b2c1/hero.jpeg" })),
}));

describe("BlobImageStore", () => {
  it("stores images under a recipe id path", async () => {
    const { put } = await import("@vercel/blob");
    const store = new BlobImageStore();

    const url = await store.upload(Buffer.from([1, 2, 3]), "image/jpeg", "a3f8b2c1-1234-5678-9abc-def012345678");

    expect(url).toBe("https://blob.example/recipes/a3f8b2c1/hero.jpeg");
    expect(put).toHaveBeenCalledWith(
      "recipes/a3f8b2c1-1234-5678-9abc-def012345678/hero.jpeg",
      expect.any(Buffer),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
      }),
    );
  });
});
