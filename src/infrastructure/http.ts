import type { PublishRecipeCommand, RecipeIngredient, RecipeNutrition } from "../domain/public-recipe.ts";
import type { ExtractRecipeCommand } from "../domain/extracted-recipe.ts";

const MAX_RECIPE_PAYLOAD_BYTES = 1_048_576;
const MAX_IMAGE_SIZE = 5 * 1_024 * 1_024;

export class HttpJsonError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpJsonError";
    this.status = status;
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function jsonErrorResponse(error: unknown): Response {
  if (error instanceof HttpJsonError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  throw error;
}

export async function parsePublishRecipeRequest(request: Request): Promise<PublishRecipeCommand> {
  enforceContentLengthLimit(request, MAX_RECIPE_PAYLOAD_BYTES, "Payload too large");

  const body = await parseJsonBody(request);

  const id = requiredString(body.id, "id");
  const authorId = requiredString(body.authorId, "authorId");
  const title = requiredString(body.title, "title");
  const ingredients = requiredNonEmptyArray<RecipeIngredient>(body.ingredients, "ingredients");
  const optionalIngredients = optionalArray<RecipeIngredient>(body.optionalIngredients, "optionalIngredients") ?? [];
  const instructions = requiredArray<string>(body.instructions, "instructions");

  return {
    id,
    authorId,
    title,
    description: optionalString(body.description, "description"),
    servings: optionalNumber(body.servings, "servings"),
    imageUrl: optionalWebUrlString(body.imageUrl, "imageUrl"),
    ingredients,
    optionalIngredients,
    instructions,
    notes: optionalArray<string>(body.notes, "notes"),
    nutrition: optionalObject<RecipeNutrition>(body.nutrition, "nutrition"),
    originalSourceUrl: optionalWebUrlString(body.originalSourceUrl, "originalSourceUrl"),
  };
}

export async function parseExtractRecipeRequest(request: Request): Promise<ExtractRecipeCommand> {
  const body = await parseJsonBody(request);
  const rawUrl = body.url;
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new HttpJsonError(400, "Missing or invalid field: url");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpJsonError(400, "Missing or invalid field: url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpJsonError(400, "Missing or invalid field: url");
  }
  return { url: rawUrl };
}

export async function parseUnpublishRecipeRequest(
  request: Request,
  recipeId: string | undefined,
): Promise<{ id: string; authorId: string }> {
  const id = requiredString(recipeId, "recipe id");
  const headerAuthorId = request.headers.get("x-author-id");
  if (headerAuthorId) {
    return { id, authorId: headerAuthorId };
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new HttpJsonError(400, "Missing or invalid field: authorId");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new HttpJsonError(400, "Invalid JSON");
  }

  const body = parsed as Record<string, unknown>;
  return {
    id,
    authorId: requiredString(body.authorId, "authorId"),
  };
}

export async function parseImageUploadRequest(
  request: Request,
  url: URL,
): Promise<{ recipeId: string; authorId: string; contentType: string; data: Buffer }> {
  const recipeId = url.searchParams.get("recipeId");
  if (!recipeId) {
    throw new HttpJsonError(400, "Missing query parameter: recipeId");
  }
  const authorId = url.searchParams.get("authorId");
  if (!authorId) {
    throw new HttpJsonError(400, "Missing query parameter: authorId");
  }

  const contentType = request.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new HttpJsonError(400, "Content-Type must be image/*");
  }

  enforceContentLengthLimit(request, MAX_IMAGE_SIZE, "Image too large (max 5MB)");

  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    throw new HttpJsonError(413, "Image too large (max 5MB)");
  }

  return {
    recipeId,
    authorId,
    contentType,
    data: Buffer.from(arrayBuffer),
  };
}

function enforceContentLengthLimit(request: Request, maxBytes: number, message: string): void {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new HttpJsonError(413, message);
  }
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

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }

  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredString(value, field);
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }

  return value;
}

function optionalWebUrlString(value: unknown, field: string): string | undefined {
  const stringValue = optionalString(value, field);
  if (stringValue === undefined) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(stringValue);
  } catch {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }

  return url.toString();
}

function requiredArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) {
    throw new HttpJsonError(400, `Missing field: ${field}`);
  }

  return value as T[];
}

function requiredNonEmptyArray<T>(value: unknown, field: string): T[] {
  const array = requiredArray<T>(value, field);
  if (array.length === 0) {
    throw new HttpJsonError(400, `Missing or empty field: ${field}`);
  }

  return array;
}

function optionalArray<T>(value: unknown, field: string): T[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredArray<T>(value, field);
}

function optionalObject<T>(value: unknown, field: string): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpJsonError(400, `Missing or invalid field: ${field}`);
  }

  return value as T;
}
