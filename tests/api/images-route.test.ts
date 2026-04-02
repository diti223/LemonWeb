import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import { createUploadImageRoute } from "../../src/pages/api/images.ts";
import { makeCapabilityToken, TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

beforeEach(() => {
  process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET = TEST_CAPABILITY_SECRET;
});

afterEach(() => {
  delete process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
});

describe("POST /api/images", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      repository: {
        getById: vi.fn(),
        getBySlug: vi.fn(),
        listAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
      imageStore: {
        upload: vi.fn(),
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1"),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 400 when recipeId is missing", async () => {
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      repository: {
        getById: vi.fn(),
        getBySlug: vi.fn(),
        listAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
      imageStore: {
        upload: vi.fn(),
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          Authorization: `Bearer ${makeCapabilityToken("author-1", ["images:write"])}`,
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
      repository: {
        getById: vi.fn(async () => ({ id: "a3f8b2c1-1234-5678-9abc-def012345678", authorId: "author-1" } as any)),
        getBySlug: vi.fn(),
        listAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
      imageStore: {
        upload,
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          Authorization: `Bearer ${makeCapabilityToken("author-1", ["images:write"])}`,
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1"),
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
      repository: {
        getById: vi.fn(),
        getBySlug: vi.fn(),
        listAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
      imageStore: {
        upload: vi.fn(),
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(5 * 1_024 * 1_024 + 1),
          Authorization: `Bearer ${makeCapabilityToken("author-1", ["images:write"])}`,
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1"),
    } as any);

    expect(response.status).toBe(413);
  });

  it("returns 403 when another author tries to overwrite an existing recipe image", async () => {
    const upload = vi.fn();
    const handler = createUploadImageRoute(() => createLemonWebApplication({
      repository: {
        getById: vi.fn(async () => ({ id: "a3f8b2c1-1234-5678-9abc-def012345678", authorId: "author-2" } as any)),
        getBySlug: vi.fn(),
        listAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
      imageStore: {
        upload,
      },
    }));

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1", {
        method: "POST",
        headers: {
          "content-type": "image/jpeg",
          Authorization: `Bearer ${makeCapabilityToken("author-1", ["images:write"])}`,
        },
        body: Buffer.from([1, 2, 3]),
      }),
      url: new URL("https://recipes.lemonnutrition.eu/api/images?recipeId=a3f8b2c1-1234-5678-9abc-def012345678&authorId=author-1"),
    } as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Recipe belongs to a different author",
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
