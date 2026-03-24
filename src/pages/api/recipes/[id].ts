import type { APIRoute } from "astro";
import { validateAuth, unauthorizedResponse } from "../../../infrastructure/auth.ts";
import { recipeRepository } from "../../../infrastructure/composition-root.ts";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!validateAuth(request)) {
    return unauthorizedResponse();
  }

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing recipe id" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const deleted = await recipeRepository.delete(id);
  if (!deleted) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
