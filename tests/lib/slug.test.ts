import { describe, it, expect } from "vitest";
import { slugify } from "../../src/domain/slug.ts";

describe("slugify", () => {
  it("converts title to lowercase kebab-case and appends short id", () => {
    expect(slugify("Chili Con Carne", "a3f8b2c1-1234-5678-9abc-def012345678")).toBe(
      "chili-con-carne-a3f8b2c1",
    );
  });

  it("returns title slug only when no id is provided", () => {
    expect(slugify("Greek Salad")).toBe("greek-salad");
  });

  it("strips accented and special characters to hyphens", () => {
    const result = slugify("Mere's Creme Brulee", "abc12345-6789-0000-0000-000000000000");
    expect(result).toBe("mere-s-creme-brulee-abc12345");
  });

  it("handles long titles (>100 chars) with short id appended", () => {
    const longTitle = "A".repeat(120);
    const result = slugify(longTitle, "deadbeef-1234-5678-9abc-def012345678");
    expect(result).toContain("deadbeef");
    expect(result.endsWith("-deadbeef")).toBe(true);
  });

  it("does not double-process already lowercase input", () => {
    expect(slugify("already lowercase", "abcd1234-0000-0000-0000-000000000000")).toBe(
      "already-lowercase-abcd1234",
    );
  });

  it("preserves numbers in the title", () => {
    expect(slugify("5-Minute Oats", "abcd1234-0000-0000-0000-000000000000")).toBe(
      "5-minute-oats-abcd1234",
    );
  });

  it("strips leading and trailing special characters", () => {
    const result = slugify("--Hello World--", "abcd1234-0000-0000-0000-000000000000");
    expect(result).not.toMatch(/^-/);
    expect(result).toBe("hello-world-abcd1234");
  });

  it("collapses multiple spaces and special chars into a single hyphen", () => {
    const result = slugify("Too   Many   Spaces", "abcd1234-0000-0000-0000-000000000000");
    expect(result).not.toContain("--");
    expect(result).toBe("too-many-spaces-abcd1234");
  });

  it("collapses consecutive special characters into a single hyphen", () => {
    const result = slugify("Hello!!!World???Yes");
    expect(result).not.toContain("--");
    expect(result).toBe("hello-world-yes");
  });
});
