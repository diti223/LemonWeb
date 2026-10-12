import { describe, expect, it, vi } from "vitest";
import { createCapabilityTokenService } from "../../src/infrastructure/auth.ts";
import { createDeviceSessionService } from "../../src/infrastructure/device-session.ts";
import { TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

describe("device session App Attest assertion payload", () => {
  it("verifies the exact signed challenge string used by the iOS assertion client", async () => {
    const installId = "install-123";
    const challenge = createCapabilityTokenService({ secret: TEST_CAPABILITY_SECRET }).signChallengeToken({
      installId,
      challengeId: "challenge-123",
    });
    const verifyAssertion = vi.fn(() => ({ signCount: 1 }));
    const service = createDeviceSessionService({
      tokenService: createCapabilityTokenService({ secret: TEST_CAPABILITY_SECRET }),
      sessionTokenSecret: TEST_CAPABILITY_SECRET,
      enrollmentStore: {
        getEnrollment: vi.fn(async () => ({
          keyId: "key-1",
          publicKey: "public-key",
          signCount: 0,
          enrolledAt: "2026-10-12T00:00:00.000Z",
        })),
        saveEnrollment: vi.fn(async () => undefined),
      },
      appAttest: {
        verifyAttestation: vi.fn(),
        verifyAssertion,
      },
      bundleIdentifier: "eu.lemonnutrition.app",
      teamIdentifier: "TEAM123",
      allowDevelopmentEnvironment: false,
    });

    await service.issueSession({
      installId,
      challenge,
      keyId: "key-1",
      proof: { kind: "assertion", assertion: "assertion-proof" },
    });

    expect(verifyAssertion).toHaveBeenCalledWith(expect.objectContaining({ payload: challenge }));
  });
});
