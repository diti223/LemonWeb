import { describe, expect, it } from "vitest";
import { createCapabilityTokenService } from "../../src/infrastructure/auth.ts";
import { TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";
import { createDeviceSessionStatusRoute } from "../../src/pages/api/device/session/status.ts";

describe("GET /api/device/session/status", () => {
  it("returns token metadata for an authorized capability token", async () => {
    const tokenService = createCapabilityTokenService({
      secret: TEST_CAPABILITY_SECRET,
      capabilityTokenTtlSeconds: 3600,
    });
    const handler = createDeviceSessionStatusRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
      allowDevelopmentEnvironment: true,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session/status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenService.signCapabilityToken({
            installId: "install-123",
            scopes: ["ai:text", "extract", "publish"],
          })}`,
        },
      }),
    } as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        valid: true,
        installId: "install-123",
        scopes: expect.arrayContaining(["ai:text", "extract", "publish"]),
        environment: "development",
        acceptedProofKind: "debug-attestation",
      }),
    );
  });

  it("rejects requests without a bearer token", async () => {
    const handler = createDeviceSessionStatusRoute({
      tokenSecret: TEST_CAPABILITY_SECRET,
    });

    const response = await handler({
      request: new Request("https://recipes.lemonnutrition.eu/api/device/session/status", {
        method: "GET",
      }),
    } as any);

    expect(response.status).toBe(401);
  });
});
