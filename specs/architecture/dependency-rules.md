# LemonWeb Dependency Rules

These rules are the architectural guardrails for LemonWeb v2.

## Primary Direction

Allowed dependency direction:

`routes / pages -> application -> domain -> ports -> infrastructure`

Routes and pages are adapters. They translate HTTP or Astro concerns into application requests and application responses.

## Rules

1. Route files must not own product policy.
   - Authentication checks, parsing, and response encoding are allowed.
   - Ownership checks, slug policy, canonical URL policy, projection rules, and publish lifecycle rules belong in application or domain code.

2. Domain contracts must not depend on Blob, Astro, or HTTP details.
   - Public contract types are pure TypeScript types.
   - Domain policies are pure functions or small services.

3. Infrastructure must implement ports, not define behavior.
   - Blob repositories and image stores may persist and retrieve data.
   - They must not decide author ownership, public/private projection, or canonical URL behavior.

4. Presentation data must be projected, not stored as domain truth.
   - `ingredientDisplayTexts`, JSON-LD fragments, and print-specific behavior belong to presentation projection.

5. A single slug and canonical URL policy must be shared by API publish and CLI publish.
   - There must not be separate runtime and script slug rules.

6. Extensibility should happen by adding adapters or policies behind ports.
   - OCP here means new storage, URL, or identity behavior should extend existing seams instead of forcing edits across route handlers.

7. Tests should follow the seam where the rule lives.
   - Domain tests for pure policies
   - Application tests for publish/import behavior
   - Adapter tests for route status codes and persistence translation

## Review Checklist

- Does this new behavior belong in the route, or in a use case?
- Is a domain term doing double duty as both stored truth and display convenience?
- Is a new dependency pointing inward toward policy, or outward toward adapters?
- Can the behavior be tested without Blob, Astro, or network access?
