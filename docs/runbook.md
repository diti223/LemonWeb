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
- `LEMON_WEB_CAPABILITY_TOKEN_SECRET=<server-only signing secret>`
- `OPENAI_API_KEY=<server-only provider key>`
- `ANTHROPIC_API_KEY=<server-only provider key>`
- `GEMINI_API_KEY=<server-only provider key>`
- `KV_REST_API_URL=<Vercel KV URL>`
- `KV_REST_API_TOKEN=<Vercel KV token>`
- `APP_ATTEST_BUNDLE_IDENTIFIER=<bundle id for the iOS app>`
- `APP_ATTEST_TEAM_IDENTIFIER=<Apple team id>`
- `APP_ATTEST_ALLOW_DEVELOPMENT=true|false`
- `AI_IMAGE_ALLOWLIST_INSTALL_IDS=<comma-separated install ids allowed for Magic Photo>`
- `BLOB_READ_WRITE_TOKEN=<Vercel Blob write token>`

The server uses Blob for the canonical public recipe store and public hero images.

## Secret Model

LemonWeb owns the privileged credentials. The iOS app and share extension must not ship provider keys or the publish/extract bearer tokens.

Treat these as server-only:

- OpenAI / Anthropic / Google API keys
- `LEMON_WEB_CAPABILITY_TOKEN_SECRET`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- App Attest bundle/team identifiers
- `AI_IMAGE_ALLOWLIST_INSTALL_IDS`

If any of those values show up in the built iOS `.app` or `.appex`, the release is not safe to ship.

**Important:** After setting env vars in Vercel, you must redeploy for them to take effect. Push to `trunk` to trigger a new deployment.

## Universal Links

LemonWeb serves the Apple App Site Association file from `/.well-known/apple-app-site-association`.

Verification:

```bash
curl -I https://recipes.lemonnutrition.eu/.well-known/apple-app-site-association
```

Expect `200` and `Content-Type: application/json`.

## Publish Auth

- Keep the bearer token boundary on the server.
- The app should only ever use short-lived capability tokens issued by `/api/device/session`.
- Upload images first, then publish recipes.
- Prefer server-side allowlists and short-lived capability tokens for expensive paths.

## Image Flow

- Normalize images on-device before upload.
- Keep one optimized hero image per recipe.
- Use the recipe id as the upload key so upload works before publish and survives slug changes.
- Keep the server cap simple at 5MB.

## Release Check

Before shipping a client or extension build, run the built-artifact secret scan from the app repo against the compiled `.app` and `.appex`.

Example:

```bash
./scripts/scan-built-artifacts-for-secrets.sh \
  /path/to/DerivedData/Build/Products/Debug-iphoneos/Lemon.app \
  /path/to/DerivedData/Build/Products/Debug-iphoneos/Lemon\ Web\ Importer.appex
```
