import type { APIRoute } from "astro";
import { validateAuth, unauthorizedResponse } from "../../infrastructure/auth.ts";
import { imageStore } from "../../infrastructure/composition-root.ts";

export const prerender = false;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const POST: APIRoute = async ({ request, url }) => {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  const slug = url.searchParams.get("slug");
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing query parameter: slug" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = request.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return new Response(JSON.stringify({ error: "Content-Type must be image/*" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Read body as buffer
  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    return new Response(JSON.stringify({ error: "Image too large (max 5MB)" }), {
      status: 413, headers: { "Content-Type": "application/json" },
    });
  }

  const buffer = Buffer.from(arrayBuffer);
  const imageUrl = await imageStore.upload(buffer, contentType, slug);

  return new Response(
    JSON.stringify({ url: imageUrl }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
};
