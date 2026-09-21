# Menu Man Restaurant Template Development Guide

Last updated: 2026-09-19

## Purpose

Menu Man is building a **shared restaurant platform with flexible restaurant-specific presentation**.

Armando's is the first real restaurant implementation and the first source of reusable restaurant-site pieces.

The goal is **not** to turn Armando's into one giant universal template all at once.

Instead, reusable restaurant-site capabilities should be extracted carefully, one piece at a time, as real needs appear.

The guiding principle is:

> **Shared core. Flexible presentation.**

Menu Man should eventually be able to assemble coherent restaurant websites from reusable sections, variants, restaurant settings, themes, and occasional bespoke client components.

Codex should increasingly behave like a **website composer using known Menu Man pieces**, not like a developer creating every restaurant site from scratch.

---

# 1. Change Classification

Before modifying a restaurant-facing feature or section, classify the work as one of three types.

## A. System Piece

A reusable capability that is broadly useful to restaurants.

Examples:

- restaurant navigation
- searchable menu
- hours/location
- ordering actions
- gallery
- restaurant story/about section
- contact information
- catering section
- reservation section
- footer
- featured menu items

A System Piece should normally be designed for reuse.

It should not contain Armando's-specific content or assumptions unless those values are supplied through restaurant data/settings.

---

## B. Variant

A reusable presentation choice for an existing System Piece.

Examples:

- hero with full-background image
- hero with split image/text layout
- gallery grid
- gallery carousel
- centered hours/location section
- split hours/map section

Variants should exist because a real restaurant needs a meaningfully different presentation.

Do **not** create large libraries of hypothetical variants in advance.

Start with one good implementation.

Add another variant when an actual restaurant requirement justifies it.

---

## C. Client Piece

A genuinely restaurant-specific component or experience.

Examples:

- a unique promotional interaction
- a highly custom storytelling section
- a client-specific event feature
- a visual experience that does not generalize well

Client Pieces are allowed.

They should be intentionally isolated rather than scattered throughout shared components.

If multiple future restaurants need the same Client Piece, consider promoting it into a reusable System Piece or Variant.

---

# 2. Do Not Abstract Prematurely

Armando's is restaurant #1.

Restaurant #1 cannot tell us every abstraction the platform will eventually need.

Therefore:

> **Build the smallest reusable abstraction supported by the current requirement.**

Do not create:

- six hero variants because they might someday be useful
- a giant generalized schema for every possible restaurant section
- a universal CMS architecture before multiple clients require it
- configuration options with no real use case
- reusable abstractions simply because duplication might someday occur

A useful rule:

> One restaurant gives us an implementation.  
> Two restaurants reveal differences.  
> Three restaurants begin revealing the real template system.

Let actual restaurant needs drive abstraction.

---

# 3. Restaurant Data Must Stay Separate From Presentation

Restaurant-specific information should live in restaurant data/settings wherever practical.

Examples:

- restaurant name
- logo
- address
- phone
- hours
- social links
- ordering destinations
- restaurant description
- hero copy
- hero image
- gallery images
- reservation URL
- catering information
- service options
- restaurant-specific CTA labels

Avoid burying restaurant information directly inside reusable React components.

Preferred model:

```tsx
<RestaurantHero restaurant={restaurant} />
```

rather than:

```tsx
<h1>Armando's Mexican Food</h1>
```

inside the shared component.

The long-term goal is for a restaurant configuration to supply content while reusable components determine presentation and behavior.

---

# 4. Theme Through Shared CSS and Tokens

Restaurant visual identity should primarily flow through a comprehensive shared CSS/token system.

Potential restaurant-level tokens include:

```css
--restaurant-bg
--restaurant-surface
--restaurant-text
--restaurant-muted
--restaurant-accent
--restaurant-accent-text

--restaurant-heading-font
--restaurant-body-font

--restaurant-radius-sm
--restaurant-radius-md
--restaurant-radius-lg

--restaurant-content-width
--restaurant-section-gap
```

Reusable components should consume these variables rather than hardcoding Armando's colors.

Example:

```css
.orderButton {
  background: var(--restaurant-accent);
}
```

rather than:

```css
.armandosOrderButton {
  background: #a32222;
}
```

Custom CSS is allowed where a restaurant genuinely needs something unusual.

Custom styling should be the escape hatch, not the default architecture.

---

# 5. Stable Shared Core vs. Flexible Presentation

Not all Menu Man code carries the same risk.

The operational core should be treated conservatively.

## High-Risk Shared Core

Examples:

- menu data model
- item identity
- modifiers
- availability
- pickup scheduling
- cart state
- quantities
- pricing
- discounts
- taxes
- checkout
- order creation
- payment handling
- refunds
- authorization
- shared security rules
- restaurant resolution

Changes here can affect every Menu Man restaurant.

Do not modify these systems merely to satisfy a visual/template requirement.

High-risk changes require stronger justification and broader regression testing.

---

## Medium-Risk Shared Capabilities

Examples:

- menu rendering
- menu search/filtering
- ordering CTA configuration
- restaurant settings
- optional catering module
- reservation module
- reusable content sections

These are shared but generally easier to change safely.

Test affected behavior carefully.

---

## Low-Risk Presentation

Examples:

- homepage composition
- photography
- section order
- typography
- colors
- spacing
- gallery treatment
- static restaurant story
- decorative interaction
- client-specific content pages

These should remain relatively flexible.

The purpose of the shared platform is **not** to make every restaurant look identical.

---

# 6. Core Business Logic Should Not Become Client-Specific

Avoid patterns such as:

```ts
if (restaurant.slug === "armandos") {
  // special cart logic
}
```

or:

```ts
if (restaurant.slug === "restaurant-b") {
  // alternate checkout behavior
}
```

If a restaurant genuinely needs different operational behavior, first determine whether the difference represents:

- a configurable restaurant capability,
- a new shared business rule,
- or a genuinely exceptional requirement.

Prefer explicit configuration over restaurant-name branches.

Example:

```ts
restaurant.capabilities.scheduledPickup = true;
```

is preferable to:

```ts
restaurant.slug === "armandos"
```

---

# 7. Optional Restaurant Capabilities Are Expected

Menu Man is specifically a restaurant platform.

Different restaurants can legitimately have different capabilities.

Examples:

- pickup ordering
- delivery
- scheduled pickup
- reservations
- catering
- multiple locations
- gallery
- specials
- press
- restaurant story
- loyalty in the future

Not every restaurant must use every capability.

The platform should support composition.

Example:

```ts
capabilities: {
  pickup: true,
  scheduledPickup: false,
  reservations: true,
  catering: false
}
```

Do not force every restaurant into the same exact page structure.

---

# 8. Template Development Workflow

Template extraction should be slow and deliberate.

For each piece:

## Step 1 — Inspect Only What Is Needed

Inspect:

- the current implementation
- its relevant data path
- its styling
- directly related settings/components

Do not conduct a repository-wide architectural review unless the task actually requires one.

Large context sweeps are expensive and frequently unnecessary.

---

## Step 2 — Classify It

Explicitly determine:

- System Piece
- Variant
- Client Piece

If uncertain, prefer leaving something client-specific rather than prematurely generalizing it.

---

## Step 3 — Identify Restaurant-Specific Data

Ask:

> What values belong to the restaurant rather than to this component?

Move appropriate values into restaurant data/settings.

Do not move behavior into settings merely for abstraction's sake.

---

## Step 4 — Preserve Behavior First

When extracting an existing Armando's component:

> **The first reusable version should preserve the current working behavior.**

Do not combine extraction with a major redesign unless explicitly requested.

Refactoring and creative redesign are easier to reason about separately.

---

## Step 5 — Build Only the Needed Variant

If Armando's currently needs:

```text
Hero / split layout
```

build:

```text
Hero / split layout
```

Do not simultaneously build:

```text
Hero / centered
Hero / background-video
Hero / minimal
Hero / collage
Hero / parallax
```

Those can be added when justified.

---

## Step 6 — Test the Relevant Surface

Run focused validation.

Examples:

For a Hero extraction:

- TypeScript
- relevant rendering tests
- `/r/armandos`
- mobile/desktop visual check

For menu functionality:

- menu-specific tests
- search behavior
- item rendering
- relevant integration tests

For cart/checkout changes:

- full commerce test suite
- broader regression testing

Testing effort should match risk.

---

## Step 7 — Stop

Do not keep "improving" nearby systems after the requested piece works.

A successful template task should normally leave a small diff.

Commit the piece and move to the next one.

---

# 9. Prompt Size Discipline

Restaurant template work should generally use **small, bounded Codex tasks**.

Avoid prompts such as:

> "Turn Armando's into a complete universal restaurant template architecture."

Prefer:

> "Extract Armando's hours/location section into the first reusable Menu Man location section."

Large site-generation prompts require much more model context, reasoning, visual judgment, and code inspection.

Small template tasks should be cheaper, easier to review, and safer.

---

# 10. Standard Prompt Header

Future template prompts can begin with this short architectural reminder:

> Menu Man uses a shared restaurant platform with flexible restaurant-specific presentation.
>
> Before changing this feature, classify the work as a **System Piece**, **Variant**, or **Client Piece**.
>
> Keep restaurant content/settings separate from presentation where practical.
>
> Prefer shared CSS/theme tokens for restaurant styling.
>
> Do not modify shared commerce/business logic unless the requirement genuinely belongs in the platform core.
>
> Do not generalize beyond the current requirement without a clear reuse case.
>
> Inspect only the files necessary for this feature and its data path.
>
> Preserve current behavior unless redesign is explicitly requested.

This header should usually be enough.

Do not resend the entire Menu Man architecture manifesto for every small task.

---

# 11. Example Template Prompt

## Example: Hours + Location

> Menu Man uses a shared restaurant platform with flexible restaurant-specific presentation.
>
> Before changing this feature, classify the work as a System Piece, Variant, or Client Piece.
>
> Keep restaurant content/settings separate from presentation where practical. Do not modify shared commerce logic. Do not generalize beyond the current requirement.
>
> Inspect only the files necessary for this section and its data path.
>
> Task:
>
> Refactor Armando's existing hours/location presentation into the first reusable Menu Man location section.
>
> Preserve its current behavior and general appearance.
>
> Restaurant-specific values such as address, phone, hours, map/directions URL, and labels should come from restaurant data/settings wherever practical.
>
> Create only the variant Armando's currently needs.
>
> Do not invent additional layout variants.
>
> Do not redesign unrelated homepage sections.
>
> Run focused TypeScript/lint/tests and verify `/r/armandos` on mobile and desktop.
>
> At completion report:
> - classification
> - reusable component created/changed
> - restaurant data moved to settings
> - files changed
> - tests performed
> - any remaining Armando's-specific assumptions

---

# 12. Example Variant Prompt

If a second restaurant later needs another treatment:

> Add a second reusable presentation variant to the existing Menu Man restaurant hero.
>
> Existing:
> `split`
>
> New requirement:
> `full-photo`
>
> Do not create a separate hero system.
>
> Preserve the existing `split` variant unchanged.
>
> Reuse the existing restaurant hero data contract where practical.
>
> Add only configuration required by the new real use case.
>
> Do not add speculative variants.

---

# 13. Example Client-Piece Prompt

> Build this feature as an Armando's-specific Client Piece.
>
> Do not force it into the shared component library unless a natural reusable primitive already exists.
>
> Keep it isolated from shared restaurant functionality.
>
> Reuse shared primitives where helpful.
>
> Do not add Armando's-specific branches to shared commerce logic.

---

# 14. Template Promotion Rule

A Client Piece can later become reusable.

Suggested process:

```text
Armando's-specific piece
        ↓
Second restaurant needs similar behavior
        ↓
Compare both requirements
        ↓
Identify shared behavior
        ↓
Extract System Piece
        ↓
Preserve differences as Variants/configuration
```

This is preferable to guessing the abstraction when only one customer exists.

---

# 15. Restaurant Site Composition Goal

The eventual goal is for Codex to receive a restaurant brief such as:

> Create a Menu Man site for Tony's Pizza.
>
> Family-run neighborhood pizza restaurant.
> Priorities are menu, pickup ordering, family story, catering, and location.
> Use the supplied logo and photography.
> Keep it warm and straightforward.

Codex should then reason primarily in terms of existing pieces:

```text
SplitHero
OrderActions
FeaturedMenu
RestaurantStory
GalleryGrid
CateringCTA
LocationHours
MenuBrowser
Footer
```

and produce restaurant configuration/composition rather than writing an entirely new website.

The desired end state is:

> **Codex composes a restaurant site from the Menu Man system.**

Not:

> **Codex invents a new restaurant application every time.**

---

# 16. Armando's Development Philosophy

For the immediate future, Armando's should stay relatively structurally simple.

Prioritize:

- reusable bones
- clean data boundaries
- page composition
- proven template pieces
- stable functionality

Do not spend excessive time building elaborate theme systems or bespoke visual effects before the reusable foundation exists.

A sensible early sequence is:

```text
Restaurant settings/data
        ↓
Restaurant shell/navigation
        ↓
Homepage composition
        ↓
Hero
        ↓
Ordering actions
        ↓
Hours/location
        ↓
Menu entry/navigation
        ↓
Gallery
        ↓
Story/about
        ↓
Footer
```

The existing menu, cart, ordering, availability, checkout, and order-management systems should remain stable unless separately being worked on.

---

# 17. Completion Report for Template Tasks

Every reusable-template task should finish with a concise report containing:

1. **Classification**
   - System Piece / Variant / Client Piece

2. **What changed**

3. **Reusable API/configuration introduced**

4. **Restaurant-specific data moved or preserved**

5. **Shared core touched**
   - ideally "none" for presentation work

6. **Files changed**

7. **Validation performed**

8. **Known restaurant-specific assumptions**

9. **Potential future variant needs**
   - only real/obvious ones; do not implement them yet

---

# 18. Anti-Patterns

Avoid:

- universal abstractions based on one restaurant
- giant configuration objects nobody currently needs
- dozens of unused component variants
- duplicating entire restaurant sites
- client-specific commerce logic
- hardcoded restaurant information inside shared components
- modifying checkout/cart/order behavior during presentation work
- repo-wide refactors during small template tasks
- redesigning while extracting unless explicitly requested
- changing neighboring components because "they could also be improved"
- introducing dependencies for a single template piece
- treating every visual difference as a new component
- forcing genuinely bespoke work into shared abstractions
- treating all restaurant sites as visually identical

---

# 19. Core Principle

Menu Man is not trying to build one rigid restaurant template.

Menu Man is building:

> **A stable restaurant platform with reusable creative building blocks.**

The operational core should become increasingly boring, reliable, and well-tested.

The presentation layer should remain expressive.

That balance is the product.
