import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { put } from "@vercel/blob";

/**
 * Upload an image file to Vercel Blob storage.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadImage(
  filePath: string,
  slug: string,
): Promise<string> {
  const ext = extname(filePath).slice(1); // remove leading dot
  const pathname = `recipes/${slug}/hero.${ext}`;

  const buffer = await readFile(filePath);

  const { url } = await put(pathname, buffer, { access: "public" });
  return url;
}
