import type { RecipeHtmlExtractor } from "../domain/ports.ts";
import type { ExtractedRecipe, ExtractRecipeCommand } from "../domain/extracted-recipe.ts";

export interface ExtractRecipeUseCase {
  execute(command: ExtractRecipeCommand): Promise<ExtractedRecipe>;
}

export interface ExtractRecipeDependencies {
  readonly fetchHtml: (url: string) => Promise<string>;
  readonly extractor: RecipeHtmlExtractor;
}

export function createExtractRecipeUseCase(
  deps: ExtractRecipeDependencies,
): ExtractRecipeUseCase {
  return {
    async execute(command: ExtractRecipeCommand): Promise<ExtractedRecipe> {
      const html = await deps.fetchHtml(command.url);
      return deps.extractor.extract(html, command.url);
    },
  };
}
