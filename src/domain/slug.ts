export function slugify(title: string, id?: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!id) return titleSlug;

  // Take first 8 chars of UUID, removing hyphens
  const shortId = id.replace(/-/g, "").substring(0, 8).toLowerCase();
  return `${titleSlug}-${shortId}`;
}
