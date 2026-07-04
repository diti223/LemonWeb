import type { OnboardingProfileRecord, OnboardingProfileStore } from "../application/onboarding-profile.ts";
import type { KeyValueStore } from "./kv-store.ts";

export function createKeyValueOnboardingProfileStore(store: KeyValueStore): OnboardingProfileStore {
  return {
    get(installId) {
      return store.get<OnboardingProfileRecord>(onboardingProfileKey(installId));
    },
    async save(installId, record) {
      await store.set(onboardingProfileKey(installId), record);
    },
  };
}

export function onboardingProfileKey(installId: string): string {
  return `onboarding-profile:${installId}`;
}
