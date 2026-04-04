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
- `REDIS_URL=<Redis connection URL>` (for rate limiting and sessions)
- `APP_ATTEST_BUNDLE_IDENTIFIER=<bundle id for the iOS app>`
- `APP_ATTEST_TEAM_IDENTIFIER=<Apple team id>`
- `APP_ATTEST_ALLOW_DEVELOPMENT=true|false`
- `AI_IMAGE_ALLOWLIST_INSTALL_IDS=<comma-separated install ids allowed for Magic Photo>`
- `BLOB_READ_WRITE_TOKEN=<Vercel Blob write token>`

The server uses Blob for the canonical public recipe store and public hero images.

## Setting Up Redis (Rate Limiting & Device Sessions)

Rate limiting and device session storage require a shared key-value store. Without Redis, each server instance has its own in-memory counters, which defeats rate limiting under load.

### Options

**Option A: Use Vercel's Managed Redis**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → **Storage** → **Create Database** → **Redis**
2. Name: `lemon-web-redis`, Region: closest to users
3. Vercel auto-sets `REDIS_URL` in environment variables

**Option B: Use Upstash or Redis Cloud**
1. Create a Redis database at [Upstash](https://upstash.com) or [Redis Cloud](https://cloud.redis.io)
2. Copy the connection URL (should be `redis://...`)

### Steps

1. **Get REDIS_URL**: From your Redis provider's dashboard
2. **Add to LemonWeb Project**:
   - Go to LemonWeb project in Vercel → **Settings** → **Environment Variables**
   - Add `REDIS_URL=<your connection string>`
   - Set for: **Production, Preview, Development**
3. **Redeploy**: Push to trunk:
   ```bash
   git push origin trunk
   ```

The backend automatically uses Redis for:
- Rate limiting across instances
- Device session storage
- Rate limit windows and token tracking

Without Redis, the server falls back to in-memory storage (doesn't survive redeploys).

## Device Attestation & Security Model

### How It Works

1. **iOS app** requests a cryptographic challenge from `/api/device/challenge`
2. **Backend** signs the challenge using `LEMON_WEB_CAPABILITY_TOKEN_SECRET`
3. **iOS app** uses Apple's DeviceCheck framework to attest the device is real
4. **Backend** verifies the attestation using Apple's public keys
5. **Backend** issues a short-lived capability token (valid for 24 hours by default)
6. **iOS app** uses the token for all API requests via `Authorization: Bearer <token>`
7. **Backend** verifies the token signature on every request
8. **Rate limiting** prevents token abuse (30 requests/hour per install ID, 120/hour per IP)

If someone tries to abuse a token:
- After 30 requests, they're rate-limited for 1 hour
- They must wait, then request a new challenge
- New device attestation is required each time
- All tokens are signed and expire after 24 hours

### Server-Only Credentials

LemonWeb owns all privileged credentials. The iOS app must never ship these:

- OpenAI / Anthropic / Google API keys
- `LEMON_WEB_CAPABILITY_TOKEN_SECRET` (token signing secret)
- `REDIS_URL` (database connection)
- App Attest bundle/team identifiers
- `AI_IMAGE_ALLOWLIST_INSTALL_IDS`
- `BLOB_READ_WRITE_TOKEN`

**Pre-release check**: Run the built-artifact secret scan against compiled `.app` and `.appex` to ensure no secrets are embedded.

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
