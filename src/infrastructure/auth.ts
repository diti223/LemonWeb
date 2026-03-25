export interface RequestAuthenticator {
  isAuthorized(request: Request): boolean;
}

export function createBearerRequestAuthenticator(
  expectedToken: string | undefined = import.meta.env.PUBLISH_API_KEY || process.env.PUBLISH_API_KEY,
): RequestAuthenticator {
  return {
    isAuthorized(request) {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !expectedToken) {
        return false;
      }

      const [scheme, token] = authHeader.split(" ");
      return scheme === "Bearer" && token === expectedToken;
    },
  };
}

export function validateAuth(request: Request): boolean {
  return createBearerRequestAuthenticator().isAuthorized(request);
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
