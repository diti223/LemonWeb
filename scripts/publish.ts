#!/usr/bin/env npx tsx
/**
 * publish.ts – Convert iOS FileRecipe_v2_0 JSON exports into Astro
 * content collection markdown files.
 *
 * Usage:
 *   npx tsx scripts/publish.ts --input recipe.json [--image hero.jpg]
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "./lib/slug.js";
import { uploadImage } from "./lib/blob-upload.js";
import {
  mapFileRecipeToContent,
  type FileRecipeInput,
  type PublicRecipeContent,
} from "./acl/file-recipe-mapper.js";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { input: string; image?: string } {
  let input: string | undefined;
  let image: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) {
      input = argv[++i];
    } else if (argv[i] === "--image" && argv[i + 1]) {
      image = argv[++i];
    }
  }

  if (!input) {
    console.error("Usage: npx tsx scripts/publish.ts --input <file.json> [--image <hero.jpg>]");
    throw new Error("Missing required --input argument");
  }

  return { input, image };
}

// ---------------------------------------------------------------------------
// YAML serializer (minimal, no dependencies)
// ---------------------------------------------------------------------------

function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
        continue;
      }
      lines.push(`${pad}${key}:`);
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          // Array of objects – inline the first key on the dash line
          const entries = Object.entries(item as Record<string, unknown>);
          const [firstKey, firstVal] = entries[0];
          lines.push(`${pad}  - ${firstKey}: ${yamlScalar(firstVal)}`);
          for (const [k, v] of entries.slice(1)) {
            lines.push(`${pad}    ${k}: ${yamlScalar(v)}`);
          }
        } else {
          lines.push(`${pad}  - ${yamlScalar(item)}`);
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${pad}${key}: ${yamlScalar(value)}`);
    }
  }

  return lines.join("\n");
}

function yamlScalar(value: unknown): string {
  if (typeof value === "string") {
    // Quote strings that could be misinterpreted or contain special chars
    if (
      value === "" ||
      value.includes(":") ||
      value.includes("#") ||
      value.includes("'") ||
      value.includes('"') ||
      value.includes("\n") ||
      value.startsWith("{") ||
      value.startsWith("[") ||
      value.startsWith("*") ||
      value.startsWith("&") ||
      value.startsWith("!") ||
      value.startsWith("%") ||
      value.startsWith("@") ||
      value.startsWith("`") ||
      /^[\d.]+$/.test(value) ||
      value === "true" ||
      value === "false" ||
      value === "null" ||
      value === "yes" ||
      value === "no"
    ) {
      return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Markdown file generation
// ---------------------------------------------------------------------------

function buildMarkdown(content: PublicRecipeContent): string {
  // Build the frontmatter object in display order
  const fm: Record<string, unknown> = {
    title: content.title,
  };
  if (content.description) fm.description = content.description;
  fm.servings = content.servings;
  if (content.imageUrl) fm.imageUrl = content.imageUrl;
  fm.ingredients = content.ingredients;
  fm.instructions = content.instructions;
  fm.notes = content.notes;
  if (content.nutrition) fm.nutrition = content.nutrition;
  fm.canonicalUrl = content.canonicalUrl;
  if (content.originalSourceUrl) fm.originalSourceUrl = content.originalSourceUrl;

  return `---\n${toYaml(fm)}\n---\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  const raw = await readFile(resolve(args.input), "utf-8");
  const json = JSON.parse(raw);

  // Accept both a single recipe object and a collection wrapper
  const recipes: FileRecipeInput[] = Array.isArray(json.recipes)
    ? json.recipes
    : [json as FileRecipeInput];

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = resolve(projectRoot, "src/content/recipes");
  await mkdir(outDir, { recursive: true });

  for (const recipe of recipes) {
    const slug = slugify(recipe.name, recipe.id);

    // Optional image upload
    let imageUrl: string | undefined;
    if (args.image) {
      console.log(`  Uploading image for "${recipe.name}"…`);
      imageUrl = await uploadImage(resolve(args.image), recipe.id);
      console.log(`  → ${imageUrl}`);
    }

    const content = mapFileRecipeToContent(recipe, imageUrl);
    const md = buildMarkdown(content);

    const outPath = resolve(outDir, `${slug}.md`);
    await writeFile(outPath, md, "utf-8");
    console.log(`✓ ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
