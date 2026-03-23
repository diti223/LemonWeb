import type { APIRoute, GetStaticPaths } from "astro";
import { recipeRepository } from "../../infrastructure/composition-root.ts";

export const getStaticPaths: GetStaticPaths = async () => {
  const recipes = await recipeRepository.listAll();
  return recipes.map((r) => ({ params: { slug: r.slug } }));
};

export const GET: APIRoute = async ({ params }) => {
  const recipe = await recipeRepository.getBySlug(params.slug!);

  if (!recipe) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(recipe), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
