# LemonWeb Runbook

This is the operational checklist for the public recipe share surface.

## Vercel Domain

1. Open the LemonWeb project in the Vercel dashboard.
2. Add `recipes.lemonnutrition.eu` as a domain.
3. Copy the DNS record Vercel shows for that subdomain into the DNS provider for `lemonnutrition.eu`.
4. Verify the domain in Vercel after DNS propagates.
5. Keep the recipe site on the subdomain, not the apex domain.

## Blob And Env Vars

Set these environment variables in Vercel for the LemonWeb project:

- `PUBLIC_RECIPE_SITE_URL=https://recipes.lemonnutrition.eu`
- `PUBLISH_API_KEY=<shared bearer token for Lemon clients>`
- `BLOB_READ_WRITE_TOKEN=<Vercel Blob write token>`

The server uses Blob for the canonical public recipe store and public hero images.

**Important:** After setting env vars in Vercel, you must redeploy for them to take effect. Push to trunk to trigger a new deployment.

Verify env vars are loaded:
```bash
curl -X POST https://recipes.lemonnutrition.eu/api/images \
  -H "Authorization: Bearer <PUBLISH_API_KEY>"
```

Should return `200` with success or proper error, not `401 Unauthorized`.

## Universal Links

LemonWeb serves the Apple App Site Association file from `/.well-known/apple-app-site-association`.

Verification:

```bash
curl -I https://recipes.lemonnutrition.eu/.well-known/apple-app-site-association
```

Expect `200` and `Content-Type: application/json`.

## Publish Auth

This release is internal/TestFlight-first.

- Keep the bearer token boundary on the server.
- Do not ship broad public publish access until the app-side publish flow is hardened.
- Upload images first, then publish recipes.

## Image Flow

- Normalize images on-device before upload.
- Keep one optimized hero image per recipe.
- Use the recipe id as the upload key so upload works before publish and survives slug changes.
- Keep the server cap simple at 5MB.
