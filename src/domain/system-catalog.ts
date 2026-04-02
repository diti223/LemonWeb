export type SystemCatalogName = "food-items" | "starter-recipes";

export interface SystemCatalogManifestEntry {
  readonly version: string;
  readonly updatedAt: string;
}

export interface SystemCatalogManifest {
  readonly schemaVersion: "1.0";
  readonly foodItems?: SystemCatalogManifestEntry;
  readonly starterRecipes?: SystemCatalogManifestEntry;
}

export interface PublishSystemCatalogCommand {
  readonly catalog: SystemCatalogName;
  readonly version: string;
  readonly payload: unknown;
  readonly updatedAt: string;
}

export interface StoredSystemCatalog {
  readonly catalog: SystemCatalogName;
  readonly version: string;
  readonly updatedAt: string;
  readonly payload: unknown;
}
