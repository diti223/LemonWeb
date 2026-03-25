import { put } from "@vercel/blob";
import type { ImageStore } from "../domain/ports.ts";

export class BlobImageStore implements ImageStore {
  async upload(data: Buffer, contentType: string, recipeId: string): Promise<string> {
    const ext = contentType.split("/")[1] || "jpg";
    const pathname = `recipes/${recipeId}/hero.${ext}`;
    const { url } = await put(pathname, data, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return url;
  }
}
