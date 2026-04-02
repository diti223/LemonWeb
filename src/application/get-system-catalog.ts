import type { SystemCatalogRepository } from "../domain/ports.ts";
import type { StoredSystemCatalog, SystemCatalogName } from "../domain/system-catalog.ts";

export interface GetSystemCatalogUseCase {
  execute(catalog: SystemCatalogName): Promise<StoredSystemCatalog | undefined>;
}

export function createGetSystemCatalogUseCase(
  repository: SystemCatalogRepository,
): GetSystemCatalogUseCase {
  return {
    async execute(catalog) {
      return repository.getCatalog(catalog);
    },
  };
}
