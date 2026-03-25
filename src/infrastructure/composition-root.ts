import { createGetPublishedRecipeUseCase, type GetPublishedRecipeUseCase } from "../application/get-published-recipe.ts";
import { createGetPublishedRecipeJsonUseCase, type GetPublishedRecipeJsonUseCase } from "../application/get-published-recipe-json.ts";
import { createPublishRecipeUseCase, type PublishRecipeUseCase } from "../application/publish-recipe.ts";
import { createUnpublishRecipeUseCase, type UnpublishRecipeUseCase } from "../application/unpublish-recipe.ts";
import { createUploadRecipeImageUseCase, type UploadRecipeImageUseCase } from "../application/upload-recipe-image.ts";
import { createRecipePublishingPolicy } from "../domain/publishing-policy.ts";
import type { Clock, ImageStore, PublishedRecipeRepository, RecipePublishingPolicy } from "../domain/ports.ts";
import type { RequestAuthenticator } from "./auth.ts";
import { createBearerRequestAuthenticator } from "./auth.ts";
import { BlobImageStore } from "./blob-image-store.ts";
import { BlobRecipeRepository } from "./blob-recipe-repository.ts";
import { SystemClock } from "./system-clock.ts";

const DEFAULT_SITE_URL = "https://recipes.lemonnutrition.eu";

export interface LemonWebApplication {
  readonly requestAuthenticator: RequestAuthenticator;
  readonly publishRecipe: PublishRecipeUseCase;
  readonly unpublishRecipe: UnpublishRecipeUseCase;
  readonly uploadRecipeImage: UploadRecipeImageUseCase;
  readonly getPublishedRecipe: GetPublishedRecipeUseCase;
  readonly getPublishedRecipeJson: GetPublishedRecipeJsonUseCase;
}

export interface LemonWebApplicationDependencies {
  readonly repository?: PublishedRecipeRepository;
  readonly imageStore?: ImageStore;
  readonly clock?: Clock;
  readonly publishingPolicy?: RecipePublishingPolicy;
  readonly requestAuthenticator?: RequestAuthenticator;
}

export function createLemonWebApplication(
  dependencies: LemonWebApplicationDependencies = {},
): LemonWebApplication {
  const repository = dependencies.repository ?? new BlobRecipeRepository();
  const imageStore = dependencies.imageStore ?? new BlobImageStore();
  const clock = dependencies.clock ?? new SystemClock();
  const siteUrl = import.meta.env.PUBLIC_RECIPE_SITE_URL || process.env.PUBLIC_RECIPE_SITE_URL || DEFAULT_SITE_URL;
  const publishingPolicy = dependencies.publishingPolicy ?? createRecipePublishingPolicy(siteUrl);
  const requestAuthenticator = dependencies.requestAuthenticator ?? createBearerRequestAuthenticator();

  return {
    requestAuthenticator,
    publishRecipe: createPublishRecipeUseCase({
      repository,
      clock,
      publishingPolicy,
    }),
    unpublishRecipe: createUnpublishRecipeUseCase(repository),
    uploadRecipeImage: createUploadRecipeImageUseCase(imageStore),
    getPublishedRecipe: createGetPublishedRecipeUseCase(repository),
    getPublishedRecipeJson: createGetPublishedRecipeJsonUseCase(repository),
  };
}
