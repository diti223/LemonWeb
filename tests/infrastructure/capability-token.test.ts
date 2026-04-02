import { describe, expect, it } from "vitest";
import { issueCapabilityToken, verifyCapabilityToken, type CapabilityScope } from "../../src/infrastructure/capability-token.ts";

describe("capability token", () => {
  it("issues and verifies scoped tokens", () => {
    const secret = "secret-1";
    const issuedAt = Date.parse("2026-04-02T00:00:00.000Z");
    const token = issueCapabilityToken({
      installId: "install-123",
      scopes: ["ai:text", "extract"],
      ttlSeconds: 60 * 60,
      issuedAt,
      tokenId: "token-1",
      secret,
    });

    const claims = verifyCapabilityToken(token, {
      secret,
      now: issuedAt + 1,
    });

    expect(claims).not.toBeNull();
    expect(claims).toMatchObject({
      installId: "install-123",
      scopes: ["ai:text", "extract"] satisfies CapabilityScope[],
      issuedAt,
      expiresAt: issuedAt + 60 * 60 * 1000,
      tokenId: "token-1",
    });
  });

  it("rejects expired tokens", () => {
    const secret = "secret-1";
    const issuedAt = Date.parse("2026-04-02T00:00:00.000Z");
    const token = issueCapabilityToken({
      installId: "install-123",
      scopes: ["publish"],
      ttlSeconds: 1,
      issuedAt,
      tokenId: "token-2",
      secret,
    });

    const claims = verifyCapabilityToken(token, {
      secret,
      now: issuedAt + 2_000,
    });

    expect(claims).toBeNull();
  });
});
