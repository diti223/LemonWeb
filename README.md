# LemonWeb

Public recipe share surface for Lemon.

LemonWeb is the backend that the iOS app talks to when it publishes recipes, checks auth, or opens shared recipe pages.

## What it does

- serves the public recipe pages
- exposes recipe publish and unpublish endpoints
- stores published recipe data and images
- handles the device-session auth flow used by the app Settings screen

## API Route Map

Astro uses file-based routing for backend endpoints. In this repo, anything under `src/pages/api/` becomes an API route:

- `src/pages/api/device/challenge.ts` -> `GET /api/device/challenge`
- `src/pages/api/device/session.ts` -> `POST /api/device/session`
- `src/pages/api/device/session/status.ts` -> `GET /api/device/session/status`
- `src/pages/api/recipes.ts` -> `GET` and `POST /api/recipes`
- `src/pages/api/recipes/[id].ts` -> `DELETE /api/recipes/:id`
- `src/pages/api/images.ts` -> `POST /api/images`

The file path is the URL path, and the exported HTTP verb functions (`GET`, `POST`, `DELETE`, etc.) decide which methods are allowed.

## Local development

Start the backend with:

```bash
npm run dev
```

If you want breakpoints in the backend routes, use the debug script:

```bash
npm run dev:debug
```

Then attach your debugger to port `9229`.

## How the app connects to it

The iOS app can point to:

- `http://localhost:4321` for local debugging
- `https://recipes.lemonnutrition.eu` for production

The app stores that choice in its Settings screen, so you can switch environments without editing code.

## Testing

Run the backend tests with:

```bash
npm test
```

## Runbook

The operational steps for deploying and publishing LemonWeb live in [docs/runbook.md](./docs/runbook.md).
