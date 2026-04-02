import type { APIRoute } from "astro";
import { createImageAIGatewayRoute } from "../../../infrastructure/ai-gateway.ts";

export const prerender = false;

export const POST: APIRoute = createImageAIGatewayRoute();
