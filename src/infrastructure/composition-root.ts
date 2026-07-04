import { createGetPublishedRecipeUseCase, type GetPublishedRecipeUseCase } from "../application/get-published-recipe.ts";
import { createGetPublishedRecipeJsonUseCase, type GetPublishedRecipeJsonUseCase } from "../application/get-published-recipe-json.ts";
import { createGetCatalogManifestUseCase, type GetCatalogManifestUseCase } from "../application/get-catalog-manifest.ts";
import { createGetSystemCatalogUseCase, type GetSystemCatalogUseCase } from "../application/get-system-catalog.ts";
import { createPublishRecipeUseCase, type PublishRecipeUseCase } from "../application/publish-recipe.ts";
import { createPublishSystemCatalogUseCase, type PublishSystemCatalogUseCase } from "../application/publish-system-catalog.ts";
import { createUnpublishRecipeUseCase, type UnpublishRecipeUseCase } from "../application/unpublish-recipe.ts";
import { createUploadRecipeImageUseCase, type UploadRecipeImageUseCase } from "../application/upload-recipe-image.ts";
import { createExtractRecipeUseCase, type ExtractRecipeUseCase } from "../application/extract-recipe.ts";
import {
  createGetOnboardingProfileUseCase,
  createSaveOnboardingProfileUseCase,
  type GetOnboardingProfileUseCase,
  type OnboardingProfileStore,
  type SaveOnboardingProfileUseCase,
} from "../application/onboarding-profile.ts";
import { createRecipePublishingPolicy } from "../domain/publishing-policy.ts";
import type {
  Clock,
  ImageStore,
  PublishedRecipeRepository,
  RecipePublishingPolicy,
  RecipeHtmlExtractor,
  SystemCatalogRepository,
} from "../domain/ports.ts";
import type { RequestAuthenticator } from "./auth.ts";
import { createBearerRequestAuthenticator } from "./auth.ts";
import { BlobImageStore } from "./blob-image-store.ts";
import { BlobRecipeRepository } from "./blob-recipe-repository.ts";
import { BlobSystemCatalogRepository } from "./blob-system-catalog-repository.ts";
import { SystemClock } from "./system-clock.ts";
import { createRecipeHtmlExtractor, fetchHtml } from "./recipe-html-extractor.ts";
import { createVercelKvStore } from "./kv-store.ts";
import { createKeyValueOnboardingProfileStore } from "./onboarding-profile-store.ts";

const DEFAULT_SITE_URL = "https://recipes.lemonnutrition.eu";

export interface LemonWebApplication {
  readonly requestAuthenticator: RequestAuthenticator;
  readonly publishRecipe: PublishRecipeUseCase;
  readonly unpublishRecipe: UnpublishRecipeUseCase;
  readonly uploadRecipeImage: UploadRecipeImageUseCase;
  readonly getPublishedRecipe: GetPublishedRecipeUseCase;
  readonly getPublishedRecipeJson: GetPublishedRecipeJsonUseCase;
  readonly getCatalogManifest: GetCatalogManifestUseCase;
  readonly getSystemCatalog: GetSystemCatalogUseCase;
  readonly publishSystemCatalog: PublishSystemCatalogUseCase;
  readonly extractAuthenticator: RequestAuthenticator;
  readonly extractRecipe: ExtractRecipeUseCase;
  readonly saveOnboardingProfile: SaveOnboardingProfileUseCase;
  readonly getOnboardingProfile: GetOnboardingProfileUseCase;
}

export interface LemonWebApplicationDependencies {
  readonly repository?: PublishedRecipeRepository;
  readonly imageStore?: ImageStore;
  readonly clock?: Clock;
  readonly publishingPolicy?: RecipePublishingPolicy;
  readonly systemCatalogRepository?: SystemCatalogRepository;
  readonly requestAuthenticator?: RequestAuthenticator;
  readonly extractAuthenticator?: RequestAuthenticator;
  readonly htmlExtractor?: RecipeHtmlExtractor;
  readonly htmlFetcher?: (url: string) => Promise<string>;
  readonly onboardingProfileStore?: OnboardingProfileStore;
}

export function createLemonWebApplication(
  dependencies: LemonWebApplicationDependencies = {},
): LemonWebApplication {
  const repository = dependencies.repository ?? new BlobRecipeRepository();
  const systemCatalogRepository = dependencies.systemCatalogRepository ?? new BlobSystemCatalogRepository();
  const imageStore = dependencies.imageStore ?? new BlobImageStore();
  const clock = dependencies.clock ?? new SystemClock();
  const siteUrl = readEnv("PUBLIC_RECIPE_SITE_URL") || DEFAULT_SITE_URL;
  const publishingPolicy = dependencies.publishingPolicy ?? createRecipePublishingPolicy(siteUrl);
  const requestAuthenticator = dependencies.requestAuthenticator ?? createBearerRequestAuthenticator();
  const extractAuthenticator =
    dependencies.extractAuthenticator ??
    createBearerRequestAuthenticator(readEnv("EXTRACT_API_KEY"));
  const htmlExtractor = dependencies.htmlExtractor ?? createRecipeHtmlExtractor();
  const htmlFetcher = dependencies.htmlFetcher ?? fetchHtml;
  const onboardingProfileStore =
    dependencies.onboardingProfileStore ?? createKeyValueOnboardingProfileStore(createVercelKvStore());

  return {
    requestAuthenticator,
    publishRecipe: createPublishRecipeUseCase({
      repository,
      clock,
      publishingPolicy,
    }),
    unpublishRecipe: createUnpublishRecipeUseCase(repository),
    uploadRecipeImage: createUploadRecipeImageUseCase(imageStore, repository),
    getPublishedRecipe: createGetPublishedRecipeUseCase(repository),
    getPublishedRecipeJson: createGetPublishedRecipeJsonUseCase(repository),
    getCatalogManifest: createGetCatalogManifestUseCase(systemCatalogRepository),
    getSystemCatalog: createGetSystemCatalogUseCase(systemCatalogRepository),
    publishSystemCatalog: createPublishSystemCatalogUseCase(systemCatalogRepository, clock),
    extractAuthenticator,
    extractRecipe: createExtractRecipeUseCase({ fetchHtml: htmlFetcher, extractor: htmlExtractor }),
    saveOnboardingProfile: createSaveOnboardingProfileUseCase({
      store: onboardingProfileStore,
      now: () => clock.now(),
    }),
    getOnboardingProfile: createGetOnboardingProfileUseCase({ store: onboardingProfileStore }),
  };
}

function readEnv(name: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
