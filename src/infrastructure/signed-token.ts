import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export class SignedTokenError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 401,
  ) {
    super(message);
    this.name = "SignedTokenError";
  }
}

export interface SignedTokenService<T extends Record<string, unknown>> {
  sign(payload: T): string;
  verify(token: string): T;
}

export interface SignedTokenOptions {
  readonly secret: string;
}

export function createSignedTokenService<T extends Record<string, unknown>>(
  options: SignedTokenOptions,
): SignedTokenService<T> {
  if (!options.secret) {
    throw new Error("Signed token secret is required");
  }

  return {
    sign(payload) {
      const envelope = JSON.stringify(payload);
      const signature = signEnvelope(envelope, options.secret);
      return `${toBase64Url(envelope)}.${toBase64Url(signature)}`;
    },

    verify(token) {
      const [payloadPart, signaturePart, ...rest] = token.split(".");
      if (!payloadPart || !signaturePart || rest.length > 0) {
        throw new SignedTokenError("Invalid token");
      }

      const envelope = fromBase64Url(payloadPart).toString("utf8");
      const expectedSignature = signEnvelope(envelope, options.secret);
      const actualSignature = fromBase64Url(signaturePart);

      if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
        throw new SignedTokenError("Invalid token");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(envelope);
      } catch {
        throw new SignedTokenError("Invalid token");
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new SignedTokenError("Invalid token");
      }

      return parsed as T;
    },
  };
}

export function newTokenId(): string {
  return randomUUID();
}

export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function fromUnixSeconds(value: number): Date {
  return new Date(value * 1000);
}

function signEnvelope(envelope: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(envelope).digest();
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}
