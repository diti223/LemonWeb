import { describe, expect, it } from "vitest";
import { LEMON_APP_ID, LEMON_APP_STORE_URL, buildLemonRecipeOpenUrl } from "../../src/lib/lemon-app.ts";

describe("lemon app links", () => {
  it("uses the live App Store listing id", () => {
    expect(LEMON_APP_ID).toBe("6618148167");
    expect(LEMON_APP_STORE_URL).toBe("https://apps.apple.com/app/id6618148167?platform=iphone");
  });

  it("builds a recipe-specific open URL for the CTA", () => {
    expect(buildLemonRecipeOpenUrl("https://recipes.lemonnutrition.eu/recipes/greek-salad")).toBe(
      "https://recipes.lemonnutrition.eu/recipes/greek-salad?openIn=lemon",
    );
  });
});
