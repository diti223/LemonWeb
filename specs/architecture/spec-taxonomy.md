# LemonWeb Spec Taxonomy

This file defines which artifact is authoritative for each kind of truth.

## 1. Behavior Specs

**Location:** `specs/*.feature`

**Purpose:** User-visible behavior, API outcomes, import expectations, ownership rules, and page behavior.

**Authority:** Product behavior and contract intent.

**Must include**
- scenario wording
- public/private expectations when relevant
- verification target category

## 2. Architecture Specs

**Location:** `specs/architecture/*.md`

**Purpose:** Bounded contexts, dependency direction, port boundaries, and policy placement.

**Authority:** Architectural constraints and vocabulary.

**Must include**
- context boundaries
- allowed dependency direction
- rules for where behavior belongs

## 3. Domain Contracts

**Location:** `src/domain/**`

**Purpose:** Typed source of truth for stored aggregates, public documents, page view models, and ports.

**Authority:** Compile-time contract truth.

**Rule**
- If a field is private, it belongs only on stored/internal types.
- If a field is page-only, it belongs only on projection/view-model types.

## 4. Tests

**Location:** `tests/**` in LemonWeb, `docs/specs/bdd/**` plus XCTest targets in CookBook

**Purpose:** Fast feedback that behavior and architecture are still true.

**Authority:** Verification proof, not product definition.

**Rule**
- A test proves a spec.
- A test is not the only place a product rule is described.

## 5. Seed Plans

**Examples:** ad hoc planning notes such as `hidden-gliding-crescent.md`

**Purpose:** Discovery and staging.

**Authority:** None after migration into repo-local specs.

**Rule**
- Once behavior is migrated into repo-local specs and code contracts, the seed plan is historical context only.
