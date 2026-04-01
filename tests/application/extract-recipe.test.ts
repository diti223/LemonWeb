import { describe, expect, it } from "vitest";
import { createExtractRecipeUseCase } from "../../src/application/extract-recipe.ts";
import type { ExtractedRecipe } from "../../src/domain/extracted-recipe.ts";
import type { RecipeHtmlExtractor } from "../../src/domain/ports.ts";

const fakeHtml = "<html><body>recipe</body></html>";

const stubExtractor: RecipeHtmlExtractor = {
  extract(_html: string, sourceURL: string): ExtractedRecipe {
    return {
      title: "Pasta",
      imageURL: "https://example.com/pasta.jpg",
      ingredients: "200g pasta\n3 eggs",
      instructions: "Boil pasta. Mix eggs.",
      sourceURL,
    };
  },
};

describe("ExtractRecipeUseCase", () => {
  it("fetches HTML from the given URL and returns extracted recipe", async () => {
    const fetchedUrls: string[] = [];
    const useCase = createExtractRecipeUseCase({
      fetchHtml: async (url) => {
        fetchedUrls.push(url);
        return fakeHtml;
      },
      extractor: stubExtractor,
    });

    const result = await useCase.execute({ url: "https://example.com/recipe" });

    expect(fetchedUrls).toEqual(["https://example.com/recipe"]);
    expect(result.title).toBe("Pasta");
    expect(result.sourceURL).toBe("https://example.com/recipe");
    expect(result.ingredients).toBe("200g pasta\n3 eggs");
  });

  it("propagates fetch errors", async () => {
    const useCase = createExtractRecipeUseCase({
      fetchHtml: async () => {
        throw new Error("Network error");
      },
      extractor: stubExtractor,
    });

    await expect(useCase.execute({ url: "https://example.com/recipe" })).rejects.toThrow(
      "Network error",
    );
  });

  it("passes the URL as sourceURL to the extractor", async () => {
    let capturedSourceURL = "";
    const useCase = createExtractRecipeUseCase({
      fetchHtml: async () => fakeHtml,
      extractor: {
        extract(_html, sourceURL) {
          capturedSourceURL = sourceURL;
          return { title: "", imageURL: null, ingredients: "", instructions: "", sourceURL };
        },
      },
    });

    await useCase.execute({ url: "https://allrecipes.com/recipe/12345" });

    expect(capturedSourceURL).toBe("https://allrecipes.com/recipe/12345");
  });
});
