export interface ProviderProxyOptions {
  upstreamBaseUrl: string;
  upstreamAuthHeaderName: string;
  upstreamAuthHeaderValue: string;
  extraHeaders?: Record<string, string>;
}

const HOP_BY_HOP_HEADERS = new Set([
  "authorization",
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export async function proxyProviderRequest(
  request: Request,
  pathSegments: string[],
  options: ProviderProxyOptions,
): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(options.upstreamBaseUrl, pathSegments);
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    headers.set(key, value);
  }

  headers.set(options.upstreamAuthHeaderName, options.upstreamAuthHeaderValue);
  for (const [key, value] of Object.entries(options.extraHeaders ?? {})) {
    headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const responseBody = await upstreamResponse.arrayBuffer();
  const responseHeaders = new Headers();
  for (const [key, value] of upstreamResponse.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    responseHeaders.set(key, value);
  }

  return new Response(responseBody, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export function buildUpstreamUrl(baseUrl: string, pathSegments: string[]): string {
  const url = new URL(baseUrl);
  const normalizedSegments = pathSegments
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""));

  for (const segment of normalizedSegments) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${segment}`;
  }

  return url.toString();
}

export function normalizeRouteSegments(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((segment) => segment.split("/")).filter((segment) => segment.length > 0);
  }

  return value.split("/").filter((segment) => segment.length > 0);
}
