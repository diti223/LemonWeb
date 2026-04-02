import type { SystemCatalogRepository } from "../domain/ports.ts";
import type { SystemCatalogManifest } from "../domain/system-catalog.ts";

export interface GetCatalogManifestUseCase {
  execute(): Promise<SystemCatalogManifest | undefined>;
}

export function createGetCatalogManifestUseCase(
  repository: SystemCatalogRepository,
): GetCatalogManifestUseCase {
  return {
    async execute() {
      return repository.getManifest();
    },
  };
}
