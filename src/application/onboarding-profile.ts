export interface OnboardingProfileRecord {
  readonly snapshot: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface OnboardingProfileStore {
  get(installId: string): Promise<OnboardingProfileRecord | null>;
  save(installId: string, record: OnboardingProfileRecord): Promise<void>;
}

export interface SaveOnboardingProfileCommand {
  readonly installId: string;
  readonly snapshot: Record<string, unknown>;
}

export interface SaveOnboardingProfileResult {
  readonly installId: string;
  readonly updatedAt: string;
}

export interface SaveOnboardingProfileUseCase {
  execute(command: SaveOnboardingProfileCommand): Promise<SaveOnboardingProfileResult>;
}

export interface GetOnboardingProfileUseCase {
  execute(installId: string): Promise<OnboardingProfileRecord | null>;
}

export interface SaveOnboardingProfileDependencies {
  readonly store: OnboardingProfileStore;
  readonly now?: () => Date;
}

export interface GetOnboardingProfileDependencies {
  readonly store: OnboardingProfileStore;
}

export function createSaveOnboardingProfileUseCase(
  deps: SaveOnboardingProfileDependencies,
): SaveOnboardingProfileUseCase {
  const now = deps.now ?? (() => new Date());

  return {
    async execute(command: SaveOnboardingProfileCommand): Promise<SaveOnboardingProfileResult> {
      const updatedAt = now().toISOString();
      await deps.store.save(command.installId, {
        snapshot: command.snapshot,
        updatedAt,
      });

      return {
        installId: command.installId,
        updatedAt,
      };
    },
  };
}

export function createGetOnboardingProfileUseCase(
  deps: GetOnboardingProfileDependencies,
): GetOnboardingProfileUseCase {
  return {
    async execute(installId: string): Promise<OnboardingProfileRecord | null> {
      return deps.store.get(installId);
    },
  };
}
