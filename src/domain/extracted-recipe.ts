export interface ExtractedRecipe {
  readonly title: string;
  readonly imageURL: string | null;
  readonly ingredients: string;
  readonly instructions: string;
  readonly sourceURL: string;
}

export interface ExtractRecipeCommand {
  readonly url: string;
}
