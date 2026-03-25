import type { RecipePublishingPolicy } from "./ports.ts";

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export function slugifyRecipeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createRecipeSlug(title: string, id: string): string {
  const titleSlug = slugifyRecipeTitle(title);
  const shortId = id.replace(/-/g, "").substring(0, 8).toLowerCase();

  if (!titleSlug) {
    return shortId;
  }

  return `${titleSlug}-${shortId}`;
}

export function buildRecipeCanonicalUrl(siteUrl: string, slug: string): string {
  const base = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  return new URL(`recipes/${slug}`, base).toString();
}

export function createRecipePublishingPolicy(siteUrl: string): RecipePublishingPolicy {
  return {
    createSlug(title, id) {
      return createRecipeSlug(title, id);
    },
    buildCanonicalUrl(slug) {
      return buildRecipeCanonicalUrl(siteUrl, slug);
    },
  };
}
