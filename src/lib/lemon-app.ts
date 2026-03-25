export const LEMON_APP_ID = "6618148167";
export const LEMON_APP_STORE_URL = `https://apps.apple.com/app/id${LEMON_APP_ID}?platform=iphone`;

export function buildLemonRecipeOpenUrl(canonicalUrl: string): string {
  const url = new URL(canonicalUrl);
  url.searchParams.set("openIn", "lemon");
  return url.toString();
}
