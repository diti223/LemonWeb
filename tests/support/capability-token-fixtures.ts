import { issueCapabilityToken, type CapabilityScope } from "../../src/infrastructure/capability-token.ts";

export const TEST_CAPABILITY_SECRET = "test-capability-secret";
export const DEFAULT_CAPABILITY_SCOPES: CapabilityScope[] = ["ai:text", "extract", "publish"];

export function makeCapabilityToken(
  installId = "install-123",
  scopes: CapabilityScope[] = DEFAULT_CAPABILITY_SCOPES,
  ttlSeconds = 60 * 60,
  issuedAt = Date.now(),
  tokenId = "token-123",
): string {
  return issueCapabilityToken({
    installId,
    scopes,
    ttlSeconds,
    issuedAt,
    tokenId,
    secret: TEST_CAPABILITY_SECRET,
  });
}

export function makeAllowlistedImageCapabilityToken(
  installId = "install-123",
  scopes: CapabilityScope[] = ["ai:text", "ai:image", "extract"],
): string {
  return makeCapabilityToken(installId, scopes);
}
