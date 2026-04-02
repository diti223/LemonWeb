function hash(value: string): string {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h *= 16777619;
  }
  return (h >>> 0).toString(16);
}

function quotedEtag(value: string): string {
  return `"${hash(value)}"`;
}

function etagMatches(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) {
    return false;
  }

  const normalized = etag.replace(/^W\//, "");
  return header
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .includes(normalized);
}

function makeHeaders(body: string, maxAgeSeconds: number): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Cache-Control": `public, max-age=${maxAgeSeconds}`,
    ETag: quotedEtag(body),
  };
}

export { etagMatches, makeHeaders, quotedEtag };
