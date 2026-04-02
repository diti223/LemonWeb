import type { Clock, SystemCatalogRepository } from "../domain/ports.ts";
import type { PublishSystemCatalogCommand, SystemCatalogManifest } from "../domain/system-catalog.ts";

export interface PublishSystemCatalogUseCase {
  execute(command: Omit<PublishSystemCatalogCommand, "updatedAt">): Promise<SystemCatalogManifest>;
}

export function createPublishSystemCatalogUseCase(
  repository: SystemCatalogRepository,
  clock: Clock,
): PublishSystemCatalogUseCase {
  return {
    async execute(command) {
      return repository.saveCatalog({
        ...command,
        updatedAt: clock.now().toISOString(),
      });
    },
  };
}
