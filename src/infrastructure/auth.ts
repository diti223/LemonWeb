export function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const expectedKey = import.meta.env.PUBLISH_API_KEY || process.env.PUBLISH_API_KEY;
  if (!expectedKey) return false;

  return token === expectedKey;
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
