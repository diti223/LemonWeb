import type { Clock, PublishedRecipeRepository, RecipePublishingPolicy } from "../domain/ports.ts";
import type { PublishRecipeCommand, StoredPublishedRecipe } from "../domain/public-recipe.ts";
import { toStoredPublishedRecipe } from "../domain/public-recipe.ts";

export interface PublishRecipeUseCase {
  execute(command: PublishRecipeCommand): Promise<PublishRecipeResult>;
}

export type PublishRecipeResult =
  | { readonly status: "published"; readonly created: boolean; readonly recipe: StoredPublishedRecipe }
  | { readonly status: "forbidden"; readonly existingRecipe: StoredPublishedRecipe };

interface PublishRecipeDependencies {
  readonly repository: PublishedRecipeRepository;
  readonly clock: Clock;
  readonly publishingPolicy: RecipePublishingPolicy;
}

export function createPublishRecipeUseCase(
  dependencies: PublishRecipeDependencies,
): PublishRecipeUseCase {
  const { repository, clock, publishingPolicy } = dependencies;

  return {
    async execute(command) {
      const existingRecipe = await repository.getById(command.id);
      if (existingRecipe && existingRecipe.authorId !== command.authorId) {
        return {
          status: "forbidden",
          existingRecipe,
        };
      }

      const slug = publishingPolicy.createSlug(command.title, command.id);
      const recipe = toStoredPublishedRecipe(command, {
        slug,
        canonicalUrl: publishingPolicy.buildCanonicalUrl(slug),
        publishedAt: clock.now().toISOString(),
      });

      await repository.save(recipe);

      return {
        status: "published",
        created: existingRecipe === undefined,
        recipe,
      };
    },
  };
}
