# LemonWeb Bounded Contexts

These contexts define the architectural seams for LemonWeb v2. Routes and pages may compose across them, but each context owns its own language and rules.

## 1. Publish Management

**Purpose:** Accept publish and unpublish requests from Lemon clients, enforce ownership, validate payloads, and persist private publishing metadata.

**Owns**
- `authorId`
- publish and unpublish rules
- image-upload authorization
- slug and canonical URL policy at publish time
- stored recipe lifecycle

**Does not own**
- web page display formatting
- iOS import UX
- third-party recipe scraping

**Primary verification**
- `specs/publish-recipe.feature`
- LemonWeb application and route tests

## 2. Public Recipe Contract

**Purpose:** Define the machine-readable JSON document served publicly at `/recipes/[slug].json`.

**Owns**
- public field set
- private/public boundary
- canonical recipe payload served to Lemon clients
- versioned contract shape

**Does not own**
- author identity
- page-only strings such as `ingredientDisplayTexts`
- storage backend details

**Primary verification**
- `specs/view-recipe.feature`
- LemonWeb contract tests

## 3. Recipe Page Presentation

**Purpose:** Render the public recipe page and any page-only projections needed for the browser experience.

**Owns**
- ingredient display text formatting
- CTA behavior
- JSON-LD projection
- print-mode rules
- visual page model

**Does not own**
- publish authorization
- stored aggregate fields that should stay private
- iOS save/navigation behavior

**Primary verification**
- `specs/view-recipe.feature`
- LemonWeb page-model and route tests

## 4. LemonWeb Import

**Purpose:** Consume LemonWeb recipe links inside the iOS app via universal links and JSON import.

**Owns**
- LemonWeb URL recognition
- `.json` endpoint fetch
- duplicate detection
- loading/review/save/navigation flow
- fallback to the existing HTML scraper for non-Lemon URLs

**Does not own**
- LemonWeb publishing
- LemonWeb page rendering
- non-Lemon scrape parsing rules

**Primary verification**
- `CookBook/docs/specs/bdd/lemonweb-import.md`
- `CookBookDemo` / `Lemon-UIKitTests`

## Dependency Rule

The allowed direction is:

`routes / UI -> application use cases -> domain contracts and policies -> ports -> infrastructure adapters`

No infrastructure adapter may become the source of truth for product behavior.
