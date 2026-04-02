import type { APIRoute } from "astro";
import { createTextAIGatewayRoute } from "../../../infrastructure/ai-gateway.ts";

export const prerender = false;

export const POST: APIRoute = createTextAIGatewayRoute();
