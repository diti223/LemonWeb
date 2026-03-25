import { describe, expect, it, vi } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createUploadImageRoute } from "../../src/pages/api/images.ts";

describe("POST /api/images", () => {
  it("returns 400 when recipeId is missing", async () => {
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      requestAuthenticator: { isAuthorized: () => true },
      imageStore: {
        upload: vi.fn(),
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images"),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing query parameter: recipeId",
    });
  });

  it("uploads an image under the recipe id path", async () => {
    const upload = vi.fn(async () => "https://blob.example/recipes/a3f8b2c1/hero.jpg");
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      requestAuthenticator: { isAuthorized: () => true },
      imageStore: {
        upload,
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678"),
    } as any);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      url: "https://blob.example/recipes/a3f8b2c1/hero.jpg",
    });
    expect(upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/jpeg",
      "a3f8b2c1-1234-5678-9abc-def012345678",
    );
  });

  it("returns 413 for oversized uploads", async () => {
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      requestAuthenticator: { isAuthorized: () => true },
      imageStore: {
        upload: vi.fn(),
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(5 * 1_024 * 1_024 + 1),
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678"),
    } as any);

    expect(response.status).toBe(413);
  });
});
