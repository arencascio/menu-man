# Upper Crust modifier evidence and coverage

Client Piece: local TypeScript fixture only. Baseline `6b350d9`, disclosure
`6b2496c`. This pass changes no shared commerce code, database, media, descriptive
copy, deployment, or approved menu layout. Source-backed item-dialog Delivery
prices remain unchanged. Pickup and in-store prices remain unconfirmed.

## Evidence references

All observations use the approved [DoorDash store/menu 86182/2374041](https://www.doordash.com/en/store/the-upper-crust-sandwich-shoppe-riverside-86182/2374041/),
signed out, on 2026-10-26. The prior source-reconciliation conversation contains
the browser tool transcripts; this document preserves their option inventories.
These references identify observations, not new screenshots or restaurant approvals.

| Ref | Observation in source-reconciliation transcript (UTC) |
| --- | --- |
| E1 | 21:58:30–21:59:21: Half Custom Sandwich full groups; Carrot Sticks reveals Ranch; No Toppings and Lettuce both checked simultaneously. |
| E2 | 21:59:21–21:59:48: Italian Sub for one, Hawaiian, Grinder for one, French Dip, BLT dialogs. |
| E3 | 22:00:53–22:00:58: BBQ Beef, Grinder for Two, Italian Sub for Two dialogs. |
| E4 | 22:01:13–22:01:40: all six salads and all five Extras dialogs. |
| E5 | 22:01:47–22:02:21: both drink sizes, Bottled Water, and Soup of the Day (Cup). |
| E6 | 22:03:29: Whole Custom Sandwich full inventory; 22:03:36–22:03:42: Grinder for Two, each side independently exposes optional Ranch; two Ranch groups present together. |
| E7 | Focused Bowl recheck in this implementation pass: 22:18:14 UTC, browser page `8f9b7ba1-e572-4eae-8dc4-4a61175273ad`. Dialog loaded after its initial loading state; text below, checked-input count **0**. The previous browser page had expired. No broad re-browse. |
| E8 | Focused signed-out item-dialog checks, 2026-10-26 UTC, browser tab `43581790`: all seven specialty sandwiches and Caesar Salad. Each of the six one-side sandwiches (Italian Sub for one, Hawaiian, Grinder for one, French Dip, BBQ Beef, BLT) exposes optional Ranch, select up to 1, $0, unchecked by default, only after Carrot Sticks is selected. Italian Sub for Two exposes that Ranch child only for its first Side Choice; changing the first side away from Carrot Sticks hides Ranch while the second side remains Carrot Sticks. Caesar Salad shows `Add Chicken $ 2.00` in its description, but its `Add-Ons` group has no choice control. Source cart stayed empty. |

E7 exact relevant displayed text:

```text
Soup of the Day (Bowl)
With your choice of bread or crackers.
Bread or Crackers
(Optional)
•
Select up to 1
Crackers
Rye
Indian Grain
Sourdough
French Roll
Whole Wheat
Add to cart - $7.95
```

The source cart was never used to add an item or submit an order. Only local
sample-cart interactions are exercised by the implementation QA.

## Bounds, defaults and spelling

- Names and spellings below are verbatim, including `Tomatos`, `Iceburg`,
  `Rasberry Vinegarette`, and `Blue Chesse`.
- `1..1` means required exactly one; `0..1` optional up to one. For checkbox
  groups with “Select at least 1” and no smaller displayed cap, the fixture's
  maximum is the number of listed choices. This does **not** establish a new
  source restriction. In particular dressing is **1..8**, not exactly one.
- All fixture options remain `isDefault: false`. No default is inferred from
  descriptions, recommended popular combinations, or the first listed option.
  Half's captured initial controls and E7 show unselected choices. Checked-state
  evidence was not preserved for every other group's initial state; confirming
  any preselected specialty toppings remains a source gap.
- An absent displayed option surcharge is represented as zero. No toppings
  exclusivity is introduced. `No Toppings` may coexist with other selected
  custom toppings, as directly observed in E1.

## Reusable inventories

All prices here are option upcharges above the item's base price.

| Inventory | Exact group / rule | Options, in source order |
| --- | --- | --- |
| Filling | Choose Filling, 1..1 | Vegetarian (Includes Avocado); Tuna Salad; Chicken Salad; Pastrami; Egg Salad; Turkey; Corned Beef; Roast Beef; Ham. All $0. |
| Bread | Bread Choice, 1..1 | French Roll (If Available); Indian Grain; Rye; Sourdough; Whole Wheat. All $0. |
| Custom toppings | Topping Choices, 1..9 | Lettuce; Tomatos; Pickles; Cheese; Onions; Sprouts; Mayo; Mustard; No Toppings. All $0. |
| Specialty toppings | Topping Choices A, 1..7 | Iceburg lettuce; Tomatos; Pickles; Cheese; Onions; Mayo; Mustard. All $0. |
| Meat | Choice of Meat, 2..2 | Pastrami; Mesquite Turkey; Corned Beef; Roast Beef; Honey Baked Ham. All $0. |
| Single/second side | Side Choice, 1..1 | Soup of the Day +$1.00; Macaroni Salad; Pasta Salad; Potato Salad; Chips; Fresh Fruit (Seasonal); Carrot Sticks; Cole Slaw. Others $0. |
| First side for two | Side Choice, 1..1 | Soup of the Day +$1.00; Fresh Fruit (Seasonal); Chips; Macaroni Salad; Carrot Sticks; Cole Slaw; Potato Salad; Pasta Salad. Others $0. |
| Single extras | Add Extras, 0..10 | Cheese; Lettuce; Mayo; Mustard; Onions; Pickles; Sprouts; Tomato: each +$0.50. Avocado; Bacon: each +$2.00. |
| For-two extras | Add Extras, 0..9 | Iceberg Lettuce; Tomato; Pickles; Cheese; Onions; Mayo; Mustard: each $0. Avocado; Bacon: each +$4.00. No smaller maximum displayed. |
| Ranch | Ranch, 0..1 | Ranch $0. Active only when its specific parent Side Choice is Carrot Sticks. Verified for Whole/Half custom and both Grinder for Two sides. No default. |
| Soup bread | Bread or Crackers, 0..1 | Crackers; Rye; Indian Grain; Sourdough; French Roll; Whole Wheat. All $0. |
| Dressing | Dressing Choice, 1..8 | Caesar; Italian; Rasberry Vinegarette; Thousand Island; Vidalia Onion Vinegarette; Balsamic Vinegarette; Ranch; Blue Chesse. All $0; no smaller maximum displayed. |
| Side order | Additional Side Order, 1..1 | Potato Salad; Pasta Salad; Macaroni Salad; Fresh Fruit (Seasonal); Cole Slaw; Carrot Sticks w/Ranch. All $0. The description mentions chips but the group does not list a chips option; none is invented. |
| Cookies | Cookie Selection, 1..1 | 2 Reese's Peanut Butter Cookies; 2 Chocolate Chip Cookies; 1 Reese’s Peanut Butter Cookie and 1 Chocolate Chip Cookie. All $0. |
| Soda | Drink Choices, 1..1 | Coke; Diet Coke; Sprite; Dr. Pepper; Lemonade; Raspberry Tea; Unsweetened Tea. All $0. |

## Item-by-item configuration

“Verified” below describes captured item modifier controls. It excludes the
separately documented recommendation blocks and initial-default gaps.

| Item | Delivery base | Configured item groups | Evidence / remaining gap |
| --- | ---: | --- | --- |
| Italian Sub for one | $14.95 | Specialty toppings; Single side; Single extras; conditional Ranch | E2/E8. Carrot Sticks says Includes customization; nested inventory was not opened for this item. It reveals optional, unchecked Ranch, 0..1, $0. Other topping defaults remain unconfirmed. |
| Hawaiian | $14.95 | Single side; Hawaiian Topping Choices 0..4: Lettuce, Mayo, Pineapple, Swiss Cheese ($0); Single extras; conditional Ranch | E2/E8. Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. Initial Hawaiian topping defaults remain unconfirmed. |
| Grinder for one | $14.95 | Specialty toppings; Meat; Single side; Single extras; conditional Ranch | E2/E8. Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. |
| French Dip | $14.95 | Single side; French Dip Other Toppings 0..1: Onions ($0); French Dip Cheese Choices 0..1: Cheddar, Swiss, Provolone ($0); conditional Ranch | E2/E8. Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. |
| BBQ Beef | $13.95 | Single side; BBQ Other Toppings 0..1: Onions ($0); BBQ Cheese Choices 0..1: Cheddar, Provolone, Swiss ($0); conditional Ranch | E3/E8. Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. |
| BLT | $13.95 | Bread; Single side; BLT Toppings 0..4: Bacon, Iceburg Lettuce, Mayo, Tomatos ($0); Single extras; conditional Ranch | E2/E8. Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. Initial BLT topping defaults remain unconfirmed. |
| Grinder for Two | $22.95 | Meat; Specialty toppings; First side for two; Second side; For-two extras; two independent conditional Ranch groups | E3/E6. Verified item groups. Each side and each Ranch has its own ID; changing side A clears only A's Ranch. |
| Italian Sub for Two | $22.95 | Specialty toppings; First side for two; Second side; For-two extras; Ranch conditional on first side Carrot Sticks | E3/E8. First side Carrot Sticks reveals optional, unchecked Ranch, 0..1, $0. Second side Carrot Sticks does not expose Ranch when the first side is changed away. |
| Whole Custom Sandwich | $14.95 | Filling; Bread; Custom toppings; Single side; Single extras; conditional Ranch | E6 and earlier committed Ranch capture. Verified. Existing group/option IDs preserved. |
| Half Custom Sandwich | $13.95 | Filling; Bread; Custom toppings; Single side; Single extras; conditional Ranch | E1. Verified; newly attaches the existing verified custom Ranch group. |
| Soup of the Day (Bowl) | $7.95 | Soup bread | E7 reconfirms previous inventory. Verified. |
| Soup of the Day (Cup) | $6.95 | Soup bread | E5. Verified. |
| Cobb Salad | $13.95 | Dressing | E4. Verified; multiple dressings allowed. |
| Albacore Tuna Salad | $13.95 | Dressing | E4. Verified; multiple dressings allowed. |
| Chef Salad | $13.95 | Dressing | E4. Verified; multiple dressings allowed. |
| Caesar Salad | $13.95 | No item-specific modifier controls | E4/E8. Dialog description says `Add Chicken $ 2.00`; `Add-Ons` is empty and no chicken selector or price-triggering control appears. Do not invent a group or surcharge trigger. |
| Chicken Salad Salad | $13.95 | Dressing | E4. Verified; multiple dressings allowed. |
| Dinner Salad | $10.50 | Dressing | E4. Verified; multiple dressings allowed. |
| Side Orders | $3.25 | Side order | E4. Verified. |
| Cheesecake | $3.75 | None | E4. No item-specific modifiers displayed. |
| Chips | $2.00 | None | E4. No varieties offered as modifier choices; no invented varieties. |
| Brownies | $3.25 | None | E4. No item-specific modifiers displayed. |
| 2 Cookies | $1.50 | Cookies | E4. Verified. |
| Bottled Water | $2.00 | None | E5. No item-specific modifiers displayed. |
| Large Drink (20 oz) | $3.25 | Soda | E5. Verified. |
| Small Drink (16 oz) | $2.25 | Soda | E5. Verified. |

## Recommendation blocks: recorded, not implemented as flat modifiers

Sandwich, soup, and salad dialogs also show separate recommended catalog items:

- Recommended Desserts: optional, choose up to 3; Brownies +$3.25,
  2 Cookies +$1.50, Cheesecake +$3.75.
- Recommended Sides And Apps: Side Orders +$3.25; soup/salad dialogs additionally
  show Chips +$2.00 and choose up to 2. Sandwich dialogs show Side Orders without
  a displayed numeric cap.
- Recommended Beverages: optional, choose up to 3; Large Drink (20 oz) +$3.25,
  Small Drink (16 oz) +$2.25, Bottled Water +$2.00.

Some recommendations have embedded customization indicators. Their nested flow,
defaults, and any item-specific variation were not captured in full. These are
not silently converted into flat add-ons that bypass the separate item's
required cookie, drink or side selections. The standalone menu items have their
verified configuration. Recommendation-flow parity remains incomplete.

## Unresolved pricing and availability

- Drink category text says `large $2.25 small $1.75`; item cards/dialogs say
  **Large $3.25 / Small $2.25**. The fixture retains the item-dialog Delivery
  amounts. The discrepancy remains unresolved, documented internally only.
- Caesar Salad's chicken description has no corresponding configurable control;
  the +$2.00 relationship remains unresolved. Recommendation flows and exhaustive
  initial-default evidence remain incomplete. Specialty sandwich Carrot Sticks
  Ranch branches are now checked and configured as described in E8.
- Source Full Menu hours were `10:00 am - 4:10 pm`. French Roll is labeled
  `(If Available)` and Fresh Fruit `(Seasonal)`. No sold-out state was observed;
  this does not confirm current item, Pickup, in-store, or delivery availability.

## Implementation and validation

- Fixture: [config.ts](../src/lib/upper-crust/config.ts). Shared modifier/cart
  infrastructure is reused without modification; identities already in saved
  carts are retained. New child group IDs distinguish both Grinder side branches.
- Tests: [config.test.ts](../src/lib/upper-crust/config.test.ts),
  [modifiers.test.ts](../src/lib/upper-crust/modifiers.test.ts), existing cart,
  conditional modifier, card-ordering and modifier-loader tests.
- Chrome interactions: [upper-crust-modifiers.browser-qa.mjs](../scripts/upper-crust-modifiers.browser-qa.mjs),
  isolated loopback port 3213, 390/1440 widths. Server remote-fetch guard and
  browser request routing prohibit remote service access. No checkout submission.
- **63/63 focused tests passed**, including fixture inventory, shared cart,
  conditional modifiers, card ordering and modifier loader. Eight new behavior
  cases cover required selections/no inferred defaults, No Toppings coexistence,
  multiple dressings, Half/Whole conditional Ranch, independent Grinder Ranch,
  dual sides/meat limits, exact upcharges, persistence/hydration/editing, and
  standalone side/cookie/drink/soup inventories (some covered in combined cases).
- Follow-up changed-fixture/modifier run: **12/12 passed** (3 fixture and 9
  modifier cases), including specialty Ranch relationships, Italian Sub for Two's
  first-side-only branch, transition cleanup, defaults, and zero-cost pricing.
- **TypeScript** (`npx tsc --noEmit`), targeted **ESLint** on all changed TS/MJS
  files, and **git diff --check** passed.
- **Google Chrome**, `channel: "chrome"`, 390px and 1440px: required choices,
  No Toppings coexistence, Half Ranch, independent dual Ranch, parent-switch
  clearing, two soup surcharges, multi-dressing choices, cookie/drink/side/soup
  selection, local storage reload and cart editing all passed. Zero uncaught page
  errors; zero browser write requests. The existing, unpackaged Upper Crust logo
  returned 404 in this worktree; no replacement media was introduced. This check
  verifies interactions, not complete asset readiness. Unchanged page design reuses previous
  visual QA; affected modal screenshots were also inspected at mobile/desktop.
- Follow-up **Google Chrome** check at 320px: Italian Sub for one Carrot Sticks
  opens its optional Ranch group; Italian Sub for Two exposes Ranch only when
  the first side is Carrot Sticks. Changing that side hides Ranch while the
  second Carrot Sticks selection remains. No overflow, browser errors, or
  non-GET requests. The previously noted Upper Crust logo 404 persists.
- Implementation is committed as `0089f53` on `feature/upper-crust-full-menu-v1`.

## Final fixture reconciliation

The fixture has **26 items**: **21 have one or more configured modifier groups**;
**5 have none**—Caesar Salad, Cheesecake, Chips, Brownies, and Bottled Water.
The previous `21 modified + 4 unmodified` summary omitted Caesar Salad from its
unmodified count. Caesar has no modifier control; its item description mentions
Add Chicken $2.00, but the dialog exposes no chicken choice. This is a reporting
omission, not a missing fixture entry. The six newly verified one-side Ranch
children and Italian Sub for Two's first-side-only Ranch child add configuration
to already-modified items, so the 21/5 item count remains unchanged.
