<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current priorities

- The GetMenuMan.com marketing foundation is considered complete enough for now. Do not redesign or expand the marketing site unless explicitly requested.
- Current product work should prioritize the restaurant platform and Armando's as the first implementation/template source.


## Project-wide guardrails

- Treat `PROJECT_STATE.md` as the current architecture/status reference. Do not assume older prototype code reflects the production architecture.
- Prefer small, focused diffs. Do not refactor adjacent systems unless the requested change requires it.
- Do not introduce new dependencies, frameworks, or infrastructure without a clear requirement.
- Restaurant data/content should come from settings/database/configuration rather than being hardcoded into shared presentation components where practical.
- Presentation changes should not alter cart, checkout, ordering, payment, availability, or order-management behavior unless the task explicitly requires it.
- When touching high-risk shared core, run the relevant regression suite rather than only local component checks.

## Validation

Match validation effort to risk:

- Presentation-only changes: focused lint/type checks plus affected mobile/desktop route checks.
- Shared restaurant capabilities: relevant tests plus affected restaurant routes.
- Commerce/core changes: run the broader commerce/regression suite.

Do not spend time running unrelated expensive validation for a small isolated presentation change unless required.

## Restaurant platform architecture

Menu Man is one shared restaurant platform with flexible restaurant-specific presentation.

For restaurant-facing presentation work:

- Classify changes as a **System Piece**, **Variant**, or **Client Piece**.
- Prefer the smallest reusable abstraction justified by the current requirement.
- Keep restaurant-specific content/settings separate from reusable presentation where practical.
- Theme reusable presentation primarily through shared CSS/tokens.
- Do not create speculative variants or generalized systems for hypothetical future clients.
- Preserve working behavior when extracting reusable pieces unless redesign is explicitly requested.
- Do not modify shared commerce/business logic to satisfy presentation requirements.
- Avoid restaurant-slug branches in shared commerce logic; prefer explicit capabilities/configuration.
- Treat menu identity, cart, modifiers, availability, scheduling, pricing, taxes, checkout, order creation, payments, and security as high-risk shared core.
- Keep template tasks small. Inspect only the files/data path necessary for the requested piece.
- Match testing effort to risk and stop when the requested task is complete.

For substantial template-system work, read:
`docs/restaurant-template-development.md`

Guiding principle: **shared core, flexible presentation.**

## Browser QA

- For local browser QA on Windows, use Google Chrome explicitly.
- Do not open QA URLs through the operating system default browser.
- Prefer launching Chrome directly for visual checks of localhost routes.