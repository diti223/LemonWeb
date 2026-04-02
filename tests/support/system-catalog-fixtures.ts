import type { SystemCatalogRepository } from "../../src/domain/ports.ts";
import type {
  PublishSystemCatalogCommand,
  StoredSystemCatalog,
  SystemCatalogManifest,
  SystemCatalogName,
} from "../../src/domain/system-catalog.ts";

export const fixedSystemCatalogManifest: SystemCatalogManifest = {
  schemaVersion: "1.0",
  foodItems: {
    version: "2.1",
    updatedAt: "2026-04-02T10:00:00.000Z",
  },
  starterRecipes: {
    version: "3.1",
    updatedAt: "2026-04-02T10:00:00.000Z",
  },
};

export function makeStoredSystemCatalog(
  catalog: SystemCatalogName,
  payload: unknown,
  overrides: Partial<StoredSystemCatalog> = {},
): StoredSystemCatalog {
  const entry = catalog === "food-items" ? fixedSystemCatalogManifest.foodItems : fixedSystemCatalogManifest.starterRecipes;
  return {
    catalog,
    payload,
    version: overrides.version ?? entry?.version ?? "0.0.0",
    updatedAt: overrides.updatedAt ?? entry?.updatedAt ?? "1970-01-01T00:00:00.000Z",
  };
}

export class InMemorySystemCatalogRepository implements SystemCatalogRepository {
  private manifest: SystemCatalogManifest | null;
  private catalogs = new Map<SystemCatalogName, StoredSystemCatalog>();

  constructor(
    initialManifest: SystemCatalogManifest | null = fixedSystemCatalogManifest,
    initialCatalogs: StoredSystemCatalog[] = [],
  ) {
    this.manifest = initialManifest;
    for (const catalog of initialCatalogs) {
      this.catalogs.set(catalog.catalog, catalog);
    }
  }

  async getManifest(): Promise<SystemCatalogManifest | undefined> {
    return this.manifest ?? undefined;
  }

  async getCatalog(catalog: SystemCatalogName): Promise<StoredSystemCatalog | undefined> {
    return this.catalogs.get(catalog);
  }

  async saveCatalog(command: PublishSystemCatalogCommand): Promise<SystemCatalogManifest> {
    const nextCatalog: StoredSystemCatalog = {
      catalog: command.catalog,
      version: command.version,
      updatedAt: command.updatedAt,
      payload: command.payload,
    };
    this.catalogs.set(command.catalog, nextCatalog);

    const nextManifest: SystemCatalogManifest = {
      schemaVersion: "1.0",
      foodItems: this.manifest?.foodItems,
      starterRecipes: this.manifest?.starterRecipes,
    };
    if (command.catalog === "food-items") {
      nextManifest.foodItems = { version: command.version, updatedAt: command.updatedAt };
    } else {
      nextManifest.starterRecipes = { version: command.version, updatedAt: command.updatedAt };
    }

    this.manifest = nextManifest;
    return nextManifest;
  }
}
