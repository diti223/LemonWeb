import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLemonWebApplication } from "../../src/infrastructure/composition-root.ts";
import {
  createGetOnboardingProfileRoute,
  createSaveOnboardingProfileRoute,
} from "../../src/pages/api/profile/onboarding.ts";
import type {
  OnboardingProfileRecord,
  OnboardingProfileStore,
} from "../../src/application/onboarding-profile.ts";
import { makeCapabilityToken, TEST_CAPABILITY_SECRET } from "../support/capability-token-fixtures.ts";

vi.mock("../../src/infrastructure/rate-limit.ts", async () => {
  const actual = await vi.importActual<typeof import("../../src/infrastructure/rate-limit.ts")>("../../src/infrastructure/rate-limit.ts");
  return {
    ...actual,
    createVercelKvRateLimiter: () => ({
      consume: vi.fn(async () => ({
        allowed: true,
        count: 1,
        limit: 30,
        remaining: 29,
        resetAt: new Date("2026-04-02T01:00:00.000Z"),
        key: "profile:install-123",
      })),
    }),
  };
});

const ONBOARDING_URL = "https://recipes.lemonnutrition.eu/api/profile/onboarding";

beforeEach(() => {
  process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET = TEST_CAPABILITY_SECRET;
});

afterEach(() => {
  delete process.env.LEMON_WEB_CAPABILITY_TOKEN_SECRET;
});

function createInMemoryOnboardingProfileStore(): OnboardingProfileStore {
  const records = new Map<string, OnboardingProfileRecord>();

  return {
    async get(installId) {
      return records.get(installId) ?? null;
    },
    async save(installId, record) {
      records.set(installId, record);
    },
  };
}

function makeRoutes(store: OnboardingProfileStore = createInMemoryOnboardingProfileStore()) {
  const resolveApplication = () => createLemonWebApplication({ onboardingProfileStore: store });

  return {
    put: createSaveOnboardingProfileRoute(resolveApplication),
    get: createGetOnboardingProfileRoute(resolveApplication),
  };
}

describe("/api/profile/onboarding", () => {
  it("returns 401 when the request is unauthorized", async () => {
    const { put } = makeRoutes();

    const response = await put({
      request: new Request(ONBOARDING_URL, { method: "PUT" }),
    } as any);

    expect(response.status).toBe(401);
  });

  it("returns 403 when the token does not carry the profile:write scope", async () => {
    const { put } = makeRoutes();

    const response = await put({
      request: new Request(ONBOARDING_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["publish"])}`,
        },
        body: JSON.stringify({ goal: "lose-weight" }),
      }),
    } as any);

    expect(response.status).toBe(403);
  });

  it("returns 200 and persists the snapshot on PUT", async () => {
    const store = createInMemoryOnboardingProfileStore();
    const { put } = makeRoutes(store);

    const snapshot = { goal: "lose-weight", dietaryPreferences: ["vegetarian"] };
    const response = await put({
      request: new Request(ONBOARDING_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["profile:write"])}`,
        },
        body: JSON.stringify(snapshot),
      }),
    } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.installId).toBe("install-123");
    expect(body.updatedAt).toBeTruthy();

    const record = await store.get("install-123");
    expect(record).toMatchObject({ snapshot });
  });

  it("round-trips the snapshot through GET after PUT", async () => {
    const { put, get } = makeRoutes();

    const snapshot = { goal: "gain-muscle", mealsPerDay: 4 };
    const putResponse = await put({
      request: new Request(ONBOARDING_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["profile:write"])}`,
        },
        body: JSON.stringify(snapshot),
      }),
    } as any);

    expect(putResponse.status).toBe(200);
    const putBody = await putResponse.json();

    const getResponse = await get({
      request: new Request(ONBOARDING_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["profile:write"])}`,
        },
      }),
    } as any);

    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody).toEqual({ snapshot, updatedAt: putBody.updatedAt });
  });

  it("returns 404 when no snapshot is stored", async () => {
    const { get } = makeRoutes();

    const response = await get({
      request: new Request(ONBOARDING_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["profile:write"])}`,
        },
      }),
    } as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 400 when the body is not a JSON object", async () => {
    const { put } = makeRoutes();

    const response = await put({
      request: new Request(ONBOARDING_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${makeCapabilityToken("install-123", ["profile:write"])}`,
        },
        body: JSON.stringify(["not", "an", "object"]),
      }),
    } as any);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
  });
});
