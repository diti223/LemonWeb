import * as cheerio from "cheerio";
import type { RecipeHtmlExtractor } from "../domain/ports.ts";
import type { ExtractedRecipe } from "../domain/extracted-recipe.ts";

// --- JSON-LD extraction ---

function extractJsonLdImage(image: unknown): string | null {
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    for (const item of image) {
      const result = extractJsonLdImage(item);
      if (result) return result;
    }
    return null;
  }
  if (image && typeof image === "object" && "url" in image) {
    return typeof (image as any).url === "string" ? (image as any).url : null;
  }
  return null;
}

function extractJsonLdInstructions(instructions: unknown): string {
  if (!instructions) return "";
  if (typeof instructions === "string") return instructions;
  if (!Array.isArray(instructions)) return "";

  const lines: string[] = [];
  for (const item of instructions) {
    if (typeof item === "string") {
      lines.push(item);
    } else if (item && typeof item === "object") {
      const type = (item as any)["@type"];
      if (type === "HowToSection" && Array.isArray((item as any).itemListElement)) {
        for (const step of (item as any).itemListElement) {
          if (step && typeof step === "object" && typeof step.text === "string") {
            lines.push(step.text);
          }
        }
      } else if (typeof (item as any).text === "string") {
        lines.push((item as any).text);
      }
    }
  }
  return lines.filter(Boolean).join("\n");
}

function extractFromJsonLd(
  $: cheerio.CheerioAPI,
  sourceURL: string,
): Partial<ExtractedRecipe> | null {
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const script of scripts) {
    let json: unknown;
    try {
      json = JSON.parse($(script).text());
    } catch {
      continue;
    }

    const candidates: unknown[] = Array.isArray((json as any)?.["@graph"])
      ? (json as any)["@graph"]
      : [json];

    for (const node of candidates) {
      if (!node || typeof node !== "object") continue;
      const types: string[] = [].concat((node as any)["@type"] ?? []);
      if (!types.some((t) => t === "Recipe" || t?.endsWith?.("/Recipe"))) continue;

      const n = node as any;
      return {
        title: n.name ?? n.headline ?? "",
        imageURL: extractJsonLdImage(n.image),
        ingredients: [].concat(n.recipeIngredient ?? []).join("\n"),
        instructions: extractJsonLdInstructions(n.recipeInstructions),
        sourceURL,
      };
    }
  }
  return null;
}

// --- CSS selector fallback ---

const INGREDIENT_SELECTORS = [
  // AllRecipes
  "#mm-recipes-lrs-ingredients_1-0",
  // BBC Good Food
  "#ingredients-list",
  // Delish
  ".ingredients-body",
  // Epicurious
  "[data-testid='IngredientList']",
  // RecipeTin Eats & JamilaCuisine
  ".wprm-recipe-ingredients-container",
  // Simply Recipes
  "#section--ingredients_1-0",
  // Generic
  "[itemprop='recipeIngredient']",
  ".ingredients",
  "#ingredients",
  ".recipe-ingredients",
];

const INSTRUCTION_SELECTORS = [
  // AllRecipes
  "#mm-recipes-steps_1-0",
  // BBC Good Food
  ".method-steps__list",
  // Delish
  ".directions",
  // Epicurious
  "[data-testid='InstructionsWrapper']",
  // RecipeTin Eats
  ".wprm-recipe-instructions-container",
  // Simply Recipes
  "#section--instructions_1-0",
  // Generic
  "[itemprop='recipeInstructions']",
  ".instructions",
  "#instructions",
  ".recipe-instructions",
  ".method",
  ".steps",
];

function extractTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length === 0) continue;
    if (elements.length > 1) {
      // Multiple matching elements — collect each individually (e.g. itemprop items)
      const texts = elements
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
      if (texts.length > 0) return texts.join("\n");
    }
    const text = elements.first().text().trim();
    if (text) return text;
  }
  return "";
}

function resolveUrl(src: string, baseURL: string): string | null {
  try {
    return new URL(src, baseURL).href;
  } catch {
    return null;
  }
}

function extractImage($: cheerio.CheerioAPI, sourceURL: string): string | null {
  // 1. Meta tags
  for (const attr of ["og:image", "twitter:image", "og:image:url"]) {
    const content =
      $(`meta[property='${attr}']`).attr("content") ||
      $(`meta[name='${attr}']`).attr("content");
    if (content) return content;
  }

  // 2. Recipe-specific img selectors
  const imageSelectors = [
    ".recipe-image img",
    ".recipe-photo img",
    ".hero-photo img",
    "[itemprop='image']",
    ".wprm-recipe-image img",
    ".tasty-recipes-image img",
    ".featured-image img",
    ".post-thumbnail img",
    ".recipe img",
    "#recipe img",
    "[itemtype*='Recipe'] img",
  ];

  for (const selector of imageSelectors) {
    const el = $(selector).first();
    if (el.length === 0) continue;
    const src = el.attr("src") || el.attr("data-src");
    if (src) return resolveUrl(src, sourceURL);
  }

  // 3. Largest image in recipe container
  const container = $("[itemtype*='Recipe'], .recipe, #recipe, .wprm-recipe-container").first();
  if (container.length > 0) {
    let bestSrc: string | null = null;
    let maxSize = 0;
    container.find("img").each((_, img) => {
      const w = parseInt($(img).attr("width") ?? "0", 10) || 0;
      const h = parseInt($(img).attr("height") ?? "0", 10) || 0;
      const size = w * h;
      if (size > maxSize) {
        maxSize = size;
        bestSrc = $(img).attr("src") || $(img).attr("data-src") || null;
      }
    });
    if (bestSrc) return resolveUrl(bestSrc, sourceURL);
  }

  return null;
}

function extractFromCssSelectors($: cheerio.CheerioAPI, sourceURL: string): ExtractedRecipe {
  const title =
    $("h1").first().text().trim() || $("title").first().text().trim() || "";

  return {
    title,
    imageURL: extractImage($, sourceURL),
    ingredients: extractTextFromSelectors($, INGREDIENT_SELECTORS),
    instructions: extractTextFromSelectors($, INSTRUCTION_SELECTORS),
    sourceURL,
  };
}

// --- Public API ---

export function createRecipeHtmlExtractor(): RecipeHtmlExtractor {
  return {
    extract(html: string, sourceURL: string): ExtractedRecipe {
      const $ = cheerio.load(html);

      const fromJsonLd = extractFromJsonLd($, sourceURL);
      if (fromJsonLd) {
        return {
          title: fromJsonLd.title ?? "",
          imageURL: fromJsonLd.imageURL ?? null,
          ingredients: fromJsonLd.ingredients ?? "",
          instructions: fromJsonLd.instructions ?? "",
          sourceURL: fromJsonLd.sourceURL ?? sourceURL,
        };
      }

      return extractFromCssSelectors($, sourceURL);
    },
  };
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; LemonBot/1.0; +https://lemonnutrition.eu)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}
