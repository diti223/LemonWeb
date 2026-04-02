import type { APIRoute } from "astro";
import { authorizeCapabilityRequest } from "./capability-auth.ts";
import { HttpJsonError, jsonErrorResponse, jsonResponse } from "./http.ts";
import { type RateLimiter } from "./rate-limit.ts";

export interface AIGatewayRouteOptions {
  readonly tokenSecret?: string;
  readonly rateLimiter?: RateLimiter;
  readonly allowlistedInstallIds?: ReadonlySet<string>;
  readonly textLimit?: number;
  readonly textWindowSeconds?: number;
  readonly textIpLimit?: number;
  readonly textIpWindowSeconds?: number;
  readonly imageLimit?: number;
  readonly imageWindowSeconds?: number;
  readonly imageIpLimit?: number;
  readonly imageIpWindowSeconds?: number;
}

interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content?: string | null;
  imageData?: string | null;
}

interface TextRequestBody {
  model: string;
  messages: GatewayMessage[];
  format: "text" | "json";
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  promptCache?: {
    key: string;
    retention?: "inMemory" | "twentyFourHours";
  };
}

interface ImageRequestBody {
  sourceImageData: string;
  sourceMimeType: string;
  promptText: string;
  model: string;
}

interface TextResponseBody {
  messages: GatewayMessage[];
  requestedModel: string;
  resolvedModel: string;
  usage?: unknown;
  fallbackUsed: boolean;
  providerRequestID?: string;
}

interface ImageResponseBody {
  generatedImageData: string;
  model: string;
  responseText?: string;
  usage?: { outputImageCount: number };
}

type TextProvider = "openai" | "anthropic" | "google";

export function createTextAIGatewayRoute(options: AIGatewayRouteOptions = {}): APIRoute {
  return async ({ request }) => {
    try {
      const claims = await authorizeCapabilityRequest(request, {
        requiredScope: "ai:text",
        rateLimitScope: "ai:text",
        rateLimitLimit: options.textLimit ?? 60,
        rateLimitWindowSeconds: options.textWindowSeconds ?? 60 * 60,
        rateLimitIpLimit: options.textIpLimit ?? 120,
        rateLimitIpWindowSeconds: options.textIpWindowSeconds ?? 60 * 60,
        rateLimiter: options.rateLimiter,
        tokenSecret: options.tokenSecret,
      });

      const body = await parseTextBody(request);
      const upstream = await performTextRequest(body);
      if (!upstream.ok) {
        return proxyErrorResponse(upstream);
      }

      const normalized = await normalizeTextResponse(upstream.response, body);
      return jsonResponse(normalized, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      console.error("[LemonWebTextAIGateway] Unhandled failure", { error });
      return jsonResponse({ error: "Internal AI text error" }, 500);
    }
  };
}

export function createImageAIGatewayRoute(options: AIGatewayRouteOptions = {}): APIRoute {
  return async ({ request }) => {
    try {
      const claims = await authorizeCapabilityRequest(request, {
        requiredScope: "ai:image",
        rateLimitScope: "ai:image",
        rateLimitLimit: options.imageLimit ?? 5,
        rateLimitWindowSeconds: options.imageWindowSeconds ?? 24 * 60 * 60,
        rateLimitIpLimit: options.imageIpLimit ?? 10,
        rateLimitIpWindowSeconds: options.imageIpWindowSeconds ?? 24 * 60 * 60,
        rateLimiter: options.rateLimiter,
        tokenSecret: options.tokenSecret,
      });

      const allowlistedInstallIds = options.allowlistedInstallIds ?? readInstallAllowlist("AI_IMAGE_ALLOWLIST_INSTALL_IDS");
      if (!allowlistedInstallIds.has(claims.installId)) {
        throw new HttpJsonError(403, "Magic Photo is not enabled for this install");
      }

      const body = await parseImageBody(request);
      const upstream = await performImageRequest(body);
      if (!upstream.ok) {
        return proxyErrorResponse(upstream);
      }

      const normalized = await normalizeImageResponse(upstream.response, body);
      return jsonResponse(normalized, 200);
    } catch (error) {
      if (error instanceof HttpJsonError) {
        return jsonErrorResponse(error);
      }

      console.error("[LemonWebImageAIGateway] Unhandled failure", { error });
      return jsonResponse({ error: "Internal AI image error" }, 500);
    }
  };
}

async function performTextRequest(body: TextRequestBody): Promise<{ ok: true; response: Response } | { ok: false; response: Response }> {
  const provider = resolveTextProvider(body.model);
  const upstream = upstreamForText(provider, body.model);
  const requestBody = buildTextUpstreamBody(provider, body);
  const response = await fetch(upstream.url, {
    method: "POST",
    headers: upstream.headers,
    body: JSON.stringify(requestBody),
  });
  return response.ok ? { ok: true, response } : { ok: false, response };
}

async function performImageRequest(body: ImageRequestBody): Promise<{ ok: true; response: Response } | { ok: false; response: Response }> {
  const upstream = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent`);
  const response = await fetch(upstream.toString(), {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
    }),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: body.promptText },
            {
              inlineData: {
                mimeType: body.sourceMimeType,
                data: body.sourceImageData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  return response.ok ? { ok: true, response } : { ok: false, response };
}

async function normalizeTextResponse(response: Response, request: TextRequestBody): Promise<TextResponseBody> {
  const raw = await response.json() as Record<string, unknown>;
  const provider = resolveTextProvider(request.model);
  const resolvedModel = readString(raw.model) ?? request.model;
  const providerRequestID = readString(raw.id);
  const usage = normalizeUsage(raw.usage, provider);
  const messages = provider === "anthropic"
    ? normalizeAnthropicMessages(raw.content)
    : [normalizeAssistantMessage(readAssistantText(raw, provider))];

  return {
    messages,
    requestedModel: request.model,
    resolvedModel,
    usage,
    fallbackUsed: resolvedModel !== request.model,
    providerRequestID,
  };
}

async function normalizeImageResponse(response: Response, request: ImageRequestBody): Promise<ImageResponseBody> {
  const raw = await response.json() as Record<string, unknown>;
  const model = readString(raw.model) ?? request.model;
  const [generatedImageData, responseText] = extractImageAndText(raw);
  if (!generatedImageData) {
    throw new HttpJsonError(502, "The AI image provider returned no image");
  }

  return {
    generatedImageData: generatedImageData.toString("base64"),
    model,
    responseText,
    usage: { outputImageCount: 1 },
  };
}

function extractImageAndText(raw: Record<string, unknown>): [Buffer | null, string | undefined] {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates as Array<Record<string, unknown>> : [];
  let responseText: string | undefined;

  for (const candidate of candidates) {
    const content = candidate.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content?.parts as Array<Record<string, unknown>> : [];
    for (const part of parts) {
      if (!responseText) {
        const text = readString(part.text);
        if (text) {
          responseText = responseText ? `${responseText}\n${text}` : text;
        }
      }

      const inlineData = part.inlineData as Record<string, unknown> | undefined;
      const data = readString(inlineData?.data);
      if (data) {
        const buffer = Buffer.from(data, "base64");
        if (buffer.byteLength > 0) {
          return [buffer, responseText];
        }
      }
    }
  }

  return [null, responseText];
}

function normalizeAssistantMessage(text: string): GatewayMessage {
  return {
    role: "assistant",
    content: text,
  };
}

function normalizeAnthropicMessages(rawContent: unknown): GatewayMessage[] {
  const content = Array.isArray(rawContent) ? rawContent as Array<Record<string, unknown>> : [];
  const messages: GatewayMessage[] = [];
  for (const item of content) {
    const text = readString(item.text);
    if (text) {
      messages.push({
        role: "assistant",
        content: text,
      });
    }
  }
  return messages.length > 0 ? messages : [normalizeAssistantMessage("")];
}

function readAssistantText(raw: Record<string, unknown>, provider: TextProvider): string {
  if (provider === "openai" || provider === "google") {
    const output = raw.output;
    if (Array.isArray(output)) {
      const texts = output.flatMap((entry) => {
        const record = entry as Record<string, unknown>;
        if (record.type !== "message") {
          return [];
        }
        const content = Array.isArray(record.content) ? record.content as Array<Record<string, unknown>> : [];
        return content.map((part) => readString(part.text)).filter((value): value is string => Boolean(value));
      });
      if (texts.length > 0) {
        return texts.join("\n");
      }
    }
  }

  const choices = Array.isArray(raw.choices) ? raw.choices as Array<Record<string, unknown>> : [];
  const texts = choices.map((choice) => readString((choice.message as Record<string, unknown> | undefined)?.content)).filter((value): value is string => Boolean(value));
  return texts.join("\n");
}

function normalizeUsage(rawUsage: unknown, provider: TextProvider): Record<string, unknown> | undefined {
  if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) {
    return undefined;
  }

  const usage = rawUsage as Record<string, unknown>;
  if (provider === "openai" || provider === "google") {
    return {
      inputTokens: numberOrUndefined(usage.input_tokens) ?? numberOrUndefined(usage.prompt_tokens),
      cachedInputTokens: numberOrUndefined(usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens),
      outputTokens: numberOrUndefined(usage.output_tokens) ?? numberOrUndefined(usage.completion_tokens),
      reasoningTokens: numberOrUndefined(usage.output_tokens_details?.reasoning_tokens),
      totalTokens: numberOrUndefined(usage.total_tokens),
    };
  }

  return {
    inputTokens: numberOrUndefined(usage.input_tokens),
    cachedInputTokens: numberOrUndefined(usage.cache_read_input_tokens),
    cacheCreationInputTokens: numberOrUndefined(usage.cache_creation_input_tokens),
    outputTokens: numberOrUndefined(usage.output_tokens),
    totalTokens: numberOrUndefined(usage.total_tokens),
  };
}

function buildTextUpstreamBody(provider: TextProvider, body: TextRequestBody): Record<string, unknown> {
  if (provider === "anthropic") {
    const systemMessages = body.messages.flatMap((message) => message.role === "system" ? [message] : []);
    const messages = body.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content ?? "",
      }));

    return {
      model: body.model,
      system: systemMessages.map((message) => message.content ?? "").filter(Boolean).join("\n") || undefined,
      messages,
      max_tokens: 1024,
    };
  }

  if (body.model.startsWith("gpt-5")) {
    return {
      model: body.model,
      reasoning: body.reasoningEffort ? { effort: body.reasoningEffort } : undefined,
      instructions: undefined,
      input: body.messages.map((message) => ({
        role: message.role,
        content: message.content ?? "",
      })),
      text: body.format === "json" ? { format: { type: "json_object" } } : undefined,
      prompt_cache_key: body.promptCache?.key,
      prompt_cache_retention: body.promptCache?.retention === "inMemory" ? "in_memory" : body.promptCache?.retention === "twentyFourHours" ? "24h" : undefined,
    };
  }

  return {
    model: body.model,
    messages: body.messages.map((message) => ({
      role: message.role,
      content: encodeMessageContent(message),
    })),
    response_format: body.format === "json" ? { type: "json_object" } : undefined,
    temperature: 0.8,
  };
}

function encodeMessageContent(message: GatewayMessage): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [];
  if (message.content && message.content.length > 0) {
    content.push({ type: "text", text: message.content });
  }

  if (message.imageData && message.imageData.length > 0) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${message.imageData}`,
      },
    });
  }

  return content;
}

function upstreamForText(provider: TextProvider, model: string): { url: string; headers: Headers } {
  switch (provider) {
    case "openai":
      return {
        url: bodyModelIsResponses(model)
          ? "https://api.openai.com/v1/responses"
          : "https://api.openai.com/v1/chat/completions",
        headers: new Headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
        }),
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: new Headers({
          "Content-Type": "application/json",
          "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
        }),
      };
    case "google":
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: new Headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${requireEnv("GEMINI_API_KEY")}`,
        }),
      };
  }
}

function resolveTextProvider(model: string): TextProvider {
  if (model.startsWith("claude-")) {
    return "anthropic";
  }
  if (model.startsWith("gemini-")) {
    return "google";
  }
  if (model.startsWith("gpt-")) {
    return "openai";
  }

  throw new HttpJsonError(400, "Unsupported model");
}

function bodyModelIsResponses(model: string): boolean {
  return /^gpt-5/.test(model);
}

async function parseTextBody(request: Request): Promise<TextRequestBody> {
  const body = await parseJsonBody(request);
  const model = requiredString(body.model, "model");
  const messages = Array.isArray(body.messages) ? body.messages.map(parseMessage) : [];
  if (messages.length === 0) {
    throw new HttpJsonError(400, "Missing or invalid field: messages");
  }

  return {
    model,
    messages,
    format: parseFormat(body.format),
    reasoningEffort: parseReasoningEffort(body.reasoningEffort),
    promptCache: parsePromptCache(body.promptCache),
  };
}

async function parseImageBody(request: Request): Promise<ImageRequestBody> {
  const body = await parseJsonBody(request);
  const model = requiredString(body.model, "model");
  const sourceImageData = requiredString(body.sourceImageData, "sourceImageData");
  const sourceMimeType = requiredString(body.sourceMimeType, "sourceMimeType");
  const promptText = requiredString(body.promptText, "promptText");

  if (Buffer.from(sourceImageData, "base64").byteLength === 0) {
    throw new HttpJsonError(400, "Missing or invalid field: sourceImageData");
  }

  return { model, sourceImageData, sourceMimeType, promptText };
}

function parseMessage(value: unknown): GatewayMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpJsonError(400, "Missing or invalid field: messages");
  }

  const record = value as Record<string, unknown>;
  const role = record.role;
  if (role !== "system" && role !== "user" && role !== "assistant") {
    throw new HttpJsonError(400, "Missing or invalid field: messages");
  }

  return {
    role,
    content: typeof record.content === "string" ? record.content : undefined,
    imageData: typeof record.imageData === "string" ? record.imageData : undefined,
  };
}

function parseFormat(value: unknown): "text" | "json" {
  if (value === "text") {
    return "text";
  }
  if (value === "json") {
    return "json";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.type === "text" || record.type === "json") {
      return record.type;
    }
  }

  return "json";
}

function parseReasoningEffort(value: unknown): "minimal" | "low" | "medium" | "high" | undefined {
  if (value === "minimal" || value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return undefined;
}

function parsePromptCache(value: unknown): TextRequestBody["promptCache"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const key = requiredOptionalString(record.key);
  if (!key) {
    return undefined;
  }

  const retention = record.retention === "inMemory" || record.retention === "twentyFourHours"
    ? record.retention
    : undefined;
  return {
    key,
    retention,
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }
  return value.trim();
}

function requiredOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  return value.trim();
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpJsonError(400, "Invalid JSON");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpJsonError) {
      throw error;
    }
    throw new HttpJsonError(400, "Invalid JSON");
  }
}

function proxyErrorResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    headers: filterResponseHeaders(response.headers),
  });
}

function filterResponseHeaders(headers: Headers): Headers {
  const responseHeaders = new Headers();
  for (const [name, value] of headers.entries()) {
    if (["content-type", "cache-control", "etag"].includes(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  }
  return responseHeaders;
}

function readInstallAllowlist(name: string): ReadonlySet<string> {
  const value = readEnv(name) ?? "";
  return new Set(
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function readEnv(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name] ?? process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
