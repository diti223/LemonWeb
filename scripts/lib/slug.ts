import { createRecipeSlug, slugifyRecipeTitle } from "../../src/domain/publishing-policy.ts";

export { slugifyRecipeTitle };

export function slugify(title: string, id?: string): string {
  return id ? createRecipeSlug(title, id) : slugifyRecipeTitle(title);
}
