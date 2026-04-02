import { verifyAssertion, verifyAttestation } from "node-app-attest";

export interface AppAttestProofVerifier {
  verifyAttestation(input: AppAttestAttestationInput): AppAttestAttestationResult;
  verifyAssertion(input: AppAttestAssertionInput): AppAttestAssertionResult;
}

export interface AppAttestAttestationInput {
  readonly attestation: string;
  readonly challenge: string;
  readonly keyId: string;
  readonly bundleIdentifier: string;
  readonly teamIdentifier: string;
  readonly allowDevelopmentEnvironment: boolean;
}

export interface AppAttestAttestationResult {
  readonly keyId: string;
  readonly publicKey: string;
}

export interface AppAttestAssertionInput {
  readonly assertion: string;
  readonly payload: string;
  readonly publicKey: string;
  readonly bundleIdentifier: string;
  readonly teamIdentifier: string;
  readonly signCount: number;
}

export interface AppAttestAssertionResult {
  readonly signCount: number;
}

export function createNodeAppAttestVerifier(): AppAttestProofVerifier {
  return {
    verifyAttestation(input) {
      const result = verifyAttestation({
        attestation: Buffer.from(input.attestation, "base64"),
        challenge: input.challenge,
        keyId: input.keyId,
        bundleIdentifier: input.bundleIdentifier,
        teamIdentifier: input.teamIdentifier,
        allowDevelopmentEnvironment: input.allowDevelopmentEnvironment,
      }) as { keyId: string; publicKey: string };

      return {
        keyId: result.keyId,
        publicKey: result.publicKey,
      };
    },
    verifyAssertion(input) {
      const result = verifyAssertion({
        assertion: Buffer.from(input.assertion, "base64"),
        payload: input.payload,
        publicKey: input.publicKey,
        bundleIdentifier: input.bundleIdentifier,
        teamIdentifier: input.teamIdentifier,
        signCount: input.signCount,
      }) as { signCount: number };

      return {
        signCount: result.signCount,
      };
    },
  };
}
