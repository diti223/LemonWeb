import { describe, expect, it } from "vitest";
import { createRecipeHtmlExtractor } from "../../src/infrastructure/recipe-html-extractor.ts";

const SOURCE_URL = "https://example.com/recipe";
const extractor = createRecipeHtmlExtractor();

function html(body: string): string {
  return `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;
}

function htmlWithHead(head: string, body = ""): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

const RECIPE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Spaghetti Carbonara",
  image: "https://example.com/carbonara.jpg",
  recipeIngredient: ["200g spaghetti", "3 egg yolks", "100g pancetta"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Boil pasta in salted water." },
    { "@type": "HowToStep", text: "Fry pancetta until crispy." },
    { "@type": "HowToStep", text: "Mix eggs with cheese." },
  ],
});

describe("RecipeHtmlExtractor — JSON-LD tier", () => {
  it("extracts title, image, ingredients, and instructions from schema.org/Recipe JSON-LD", () => {
    const result = extractor.extract(
      htmlWithHead(`<script type="application/ld+json">${RECIPE_JSON_LD}</script>`),
      SOURCE_URL,
    );

    expect(result.title).toBe("Spaghetti Carbonara");
    expect(result.imageURL).toBe("https://example.com/carbonara.jpg");
    expect(result.ingredients).toBe("200g spaghetti\n3 egg yolks\n100g pancetta");
    expect(result.instructions).toBe(
      "Boil pasta in salted water.\nFry pancetta until crispy.\nMix eggs with cheese.",
    );
    expect(result.sourceURL).toBe(SOURCE_URL);
  });

  it("handles @graph wrapper (e.g. NYT Cooking style)", () => {
    const graphLd = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "NYT Cooking" },
        {
          "@type": "Recipe",
          name: "Banana Bread",
          image: "https://example.com/banana.jpg",
          recipeIngredient: ["3 bananas", "1 cup flour"],
          recipeInstructions: [{ "@type": "HowToStep", text: "Mash bananas." }],
        },
      ],
    });

    const result = extractor.extract(
      htmlWithHead(`<script type="application/ld+json">${graphLd}</script>`),
      SOURCE_URL,
    );

    expect(result.title).toBe("Banana Bread");
    expect(result.ingredients).toBe("3 bananas\n1 cup flour");
  });

  it("handles image as array", () => {
    const ld = JSON.stringify({
      "@type": "Recipe",
      name: "Test",
      image: ["https://example.com/first.jpg", "https://example.com/second.jpg"],
      recipeIngredient: [],
      recipeInstructions: [],
    });

    const result = extractor.extract(
      htmlWithHead(`<script type="application/ld+json">${ld}</script>`),
      SOURCE_URL,
    );

    expect(result.imageURL).toBe("https://example.com/first.jpg");
  });

  it("handles HowToSection containing steps", () => {
    const ld = JSON.stringify({
      "@type": "Recipe",
      name: "Layered Dish",
      recipeIngredient: ["flour"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Prep",
          itemListElement: [
            { "@type": "HowToStep", text: "Prep step 1." },
            { "@type": "HowToStep", text: "Prep step 2." },
          ],
        },
      ],
    });

    const result = extractor.extract(
      htmlWithHead(`<script type="application/ld+json">${ld}</script>`),
      SOURCE_URL,
    );

    expect(result.instructions).toBe("Prep step 1.\nPrep step 2.");
  });
});

describe("RecipeHtmlExtractor — CSS selector fallback tier", () => {
  it("falls back to CSS selectors when no JSON-LD is present", () => {
    const pageHtml = html(`
      <h1>Chocolate Chip Cookies</h1>
      <div class="wprm-recipe-ingredients-container">2 cups flour\n1 cup sugar</div>
      <div class="wprm-recipe-instructions-container">Mix. Bake at 350F.</div>
    `);

    const result = extractor.extract(pageHtml, SOURCE_URL);

    expect(result.title).toBe("Chocolate Chip Cookies");
    expect(result.ingredients).toContain("flour");
    expect(result.instructions).toContain("Bake");
  });

  it("collects multiple itemprop='recipeIngredient' elements as newline-separated string", () => {
    const pageHtml = html(`
      <h1>Pasta</h1>
      <span itemprop="recipeIngredient">200g pasta</span>
      <span itemprop="recipeIngredient">3 eggs</span>
      <span itemprop="recipeIngredient">50g cheese</span>
    `);

    const result = extractor.extract(pageHtml, SOURCE_URL);

    expect(result.ingredients).toBe("200g pasta\n3 eggs\n50g cheese");
  });

  it("returns empty strings when no recipe markup is found", () => {
    const pageHtml = html("<h1>Blog Post</h1><p>This is not a recipe.</p>");

    const result = extractor.extract(pageHtml, SOURCE_URL);

    expect(result.ingredients).toBe("");
    expect(result.instructions).toBe("");
    expect(result.imageURL).toBeNull();
  });

  it("prefers og:image meta tag for image", () => {
    const pageHtml = htmlWithHead(
      `<meta property="og:image" content="https://example.com/og.jpg" />`,
      `<img class="recipe-image" src="https://example.com/recipe.jpg" />`,
    );

    const result = extractor.extract(pageHtml, SOURCE_URL);

    expect(result.imageURL).toBe("https://example.com/og.jpg");
  });

  it("resolves relative image URLs against sourceURL", () => {
    const pageHtml = htmlWithHead(
      "",
      `<div class="recipe"><img src="/images/pasta.jpg" width="800" height="600" /></div>`,
    );

    const result = extractor.extract(pageHtml, "https://example.com/recipe");

    expect(result.imageURL).toBe("https://example.com/images/pasta.jpg");
  });
});
