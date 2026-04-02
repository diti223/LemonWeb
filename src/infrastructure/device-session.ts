import type { AppAttestProofVerifier } from "./app-attest.ts";
import type { CapabilityTokenService } from "./auth.ts";
import { issueCapabilityToken, type CapabilityScope } from "./capability-token.ts";
import type { KeyValueStore } from "./kv-store.ts";
import { HttpJsonError } from "./http.ts";
import { newTokenId } from "./signed-token.ts";

export interface DeviceChallengeResponse {
  readonly challenge: string;
  readonly expiresAt: string;
}

export interface DeviceSessionResponse {
  readonly token: string;
  readonly installId: string;
  readonly scopes: string[];
  readonly expiresAt: string;
}

export interface DeviceEnrollmentRecord {
  readonly keyId: string;
  readonly publicKey: string;
  readonly signCount: number;
  readonly enrolledAt: string;
}

export interface DeviceSessionService {
  createChallenge(installId: string): DeviceChallengeResponse;
  issueSession(input: DeviceSessionRequest): Promise<DeviceSessionResponse>;
  getEnrollment(installId: string): Promise<DeviceEnrollmentRecord | undefined>;
}

export type DeviceSessionProof =
  | { readonly kind: "attestation"; readonly attestation: string }
  | { readonly kind: "assertion"; readonly assertion: string };

export interface DeviceSessionRequest {
  readonly installId: string;
  readonly challenge: string;
  readonly keyId: string;
  readonly proof: DeviceSessionProof;
}

export interface DeviceSessionStore {
  getEnrollment(installId: string): Promise<DeviceEnrollmentRecord | undefined>;
  saveEnrollment(installId: string, record: DeviceEnrollmentRecord): Promise<void>;
}

export interface DeviceSessionServiceOptions {
  readonly tokenService: CapabilityTokenService;
  readonly sessionTokenSecret: string;
  readonly enrollmentStore: DeviceSessionStore;
  readonly appAttest: AppAttestProofVerifier;
  readonly bundleIdentifier: string;
  readonly teamIdentifier: string;
  readonly allowDevelopmentEnvironment: boolean;
  readonly now?: () => Date;
  readonly challengeTtlSeconds?: number;
  readonly capabilityTokenTtlSeconds?: number;
  readonly installIdAllowlist?: ReadonlySet<string>;
}

export function createDeviceSessionService(options: DeviceSessionServiceOptions): DeviceSessionService {
    const now = options.now ?? (() => new Date());
    const challengeTtlSeconds = options.challengeTtlSeconds ?? 5 * 60;
    const capabilityTokenTtlSeconds = options.capabilityTokenTtlSeconds ?? 24 * 60 * 60;

  return {
    createChallenge(installId) {
      const current = now();
      const challenge = options.tokenService.signChallengeToken({
        installId,
        challengeId: newTokenId(),
      });

      return {
        challenge,
        expiresAt: new Date(current.getTime() + challengeTtlSeconds * 1000).toISOString(),
      };
    },
    async issueSession(input) {
      const challengeClaims = options.tokenService.verifyChallengeToken(input.challenge);
      if (challengeClaims.installId !== input.installId) {
        throw new HttpJsonError(401, "Unauthorized");
      }

      const enrollment = await options.enrollmentStore.getEnrollment(input.installId);
      const scopes = defaultScopesForInstall(input.installId, options.installIdAllowlist);

      if (input.proof.kind === "attestation") {
        const attestation = options.appAttest.verifyAttestation({
          attestation: input.proof.attestation,
          challenge: input.challenge,
          keyId: input.keyId,
          bundleIdentifier: options.bundleIdentifier,
          teamIdentifier: options.teamIdentifier,
          allowDevelopmentEnvironment: options.allowDevelopmentEnvironment,
        });

        await options.enrollmentStore.saveEnrollment(input.installId, {
          keyId: attestation.keyId,
          publicKey: attestation.publicKey,
          signCount: enrollment?.signCount ?? 0,
          enrolledAt: enrollment?.enrolledAt ?? now().toISOString(),
        });
      } else {
        if (!enrollment) {
          throw new HttpJsonError(401, "Unauthorized");
        }
        if (enrollment.keyId !== input.keyId) {
          throw new HttpJsonError(401, "Unauthorized");
        }

        const assertion = options.appAttest.verifyAssertion({
          assertion: input.proof.assertion,
          payload: assertionPayload(input.installId, input.challenge, input.keyId),
          publicKey: enrollment.publicKey,
          bundleIdentifier: options.bundleIdentifier,
          teamIdentifier: options.teamIdentifier,
          signCount: enrollment.signCount,
        });

        await options.enrollmentStore.saveEnrollment(input.installId, {
          ...enrollment,
          signCount: assertion.signCount,
        });
      }

      const current = now();
      const token = issueCapabilityToken({
        installId: input.installId,
        scopes: scopes as CapabilityScope[],
        ttlSeconds: capabilityTokenTtlSeconds,
        secret: options.sessionTokenSecret,
      });

      return {
        token,
        installId: input.installId,
        scopes,
        expiresAt: new Date(current.getTime() + capabilityTokenTtlSeconds * 1000).toISOString(),
      };
    },
    async getEnrollment(installId) {
      return options.enrollmentStore.getEnrollment(installId);
    },
  };
}

export function createKeyValueDeviceSessionStore(store: KeyValueStore): DeviceSessionStore {
  return {
    getEnrollment(installId) {
      return store.get<DeviceEnrollmentRecord>(deviceEnrollmentKey(installId));
    },
    async saveEnrollment(installId, record) {
      await store.set(deviceEnrollmentKey(installId), record);
    },
  };
}

export function defaultScopesForInstall(
  installId: string,
  allowlist: ReadonlySet<string> | undefined,
): string[] {
  const scopes = [
    "ai:text",
    "extract",
    "publish",
    "recipes:delete",
    "images:write",
  ];

  if (allowlist?.has(installId)) {
    scopes.push("ai:image");
  }

  return scopes;
}

export function assertionPayload(installId: string, challenge: string, keyId: string): string {
  return JSON.stringify({
    installId,
    challenge,
    keyId,
    proofType: "assertion",
  });
}

export function deviceEnrollmentKey(installId: string): string {
  return `device-enrollment:${installId}`;
}
