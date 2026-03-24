import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateAuth } from "../../src/infrastructure/auth.ts";

describe("validateAuth", () => {
  const TEST_KEY = "test-api-key-12345";

  beforeEach(() => {
    process.env.PUBLISH_API_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.PUBLISH_API_KEY;
  });

  it("returns false when no Authorization header", () => {
    const req = new Request("https://example.com", { method: "POST" });
    expect(validateAuth(req)).toBe(false);
  });

  it("returns false when scheme is Basic instead of Bearer", () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: `Basic ${TEST_KEY}` },
    });
    expect(validateAuth(req)).toBe(false);
  });

  it("returns true when Bearer token matches env var", () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_KEY}` },
    });
    expect(validateAuth(req)).toBe(true);
  });

  it("returns false when Bearer token does not match", () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(validateAuth(req)).toBe(false);
  });

  it("returns false when Authorization header is empty", () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "" },
    });
    expect(validateAuth(req)).toBe(false);
  });

  it("returns false when PUBLISH_API_KEY is not configured", () => {
    delete process.env.PUBLISH_API_KEY;
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer some-token" },
    });
    expect(validateAuth(req)).toBe(false);
  });
});
