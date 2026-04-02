import { head, put } from "@vercel/blob";
import type { SystemCatalogRepository } from "../domain/ports.ts";
import type {
  PublishSystemCatalogCommand,
  StoredSystemCatalog,
  SystemCatalogManifest,
  SystemCatalogName,
} from "../domain/system-catalog.ts";

const MANIFEST_KEY = "system-catalog/_manifest.json";
const catalogKey = (catalog: SystemCatalogName) => `system-catalog/${catalog}.json`;

export class BlobSystemCatalogRepository implements SystemCatalogRepository {
  async getManifest(): Promise<SystemCatalogManifest | undefined> {
    try {
      const blob = await head(MANIFEST_KEY);
      if (!blob) {
        return undefined;
      }

      const response = await fetch(blob.url);
      if (!response.ok) {
        return undefined;
      }

      return (await response.json()) as SystemCatalogManifest;
    } catch {
      return undefined;
    }
  }

  async getCatalog(catalog: SystemCatalogName): Promise<StoredSystemCatalog | undefined> {
    try {
      const blob = await head(catalogKey(catalog));
      if (!blob) {
        return undefined;
      }

      const response = await fetch(blob.url);
      if (!response.ok) {
        return undefined;
      }

      const payload = await response.json();
      const manifest = await this.getManifest();
      const entry = catalog === "food-items" ? manifest?.foodItems : manifest?.starterRecipes;

      return {
        catalog,
        version: entry?.version ?? "0.0.0",
        updatedAt: entry?.updatedAt ?? new Date(0).toISOString(),
        payload,
      };
    } catch {
      return undefined;
    }
  }

  async saveCatalog(command: PublishSystemCatalogCommand): Promise<SystemCatalogManifest> {
    await put(catalogKey(command.catalog), JSON.stringify(command.payload), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    const manifest = await this.getManifest();
    const nextManifest: SystemCatalogManifest = {
      schemaVersion: "1.0",
      foodItems: manifest?.foodItems,
      starterRecipes: manifest?.starterRecipes,
    };

    const entry = {
      version: command.version,
      updatedAt: command.updatedAt,
    };

    if (command.catalog === "food-items") {
      nextManifest.foodItems = entry;
    } else {
      nextManifest.starterRecipes = entry;
    }

    await put(MANIFEST_KEY, JSON.stringify(nextManifest), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return nextManifest;
  }
}
