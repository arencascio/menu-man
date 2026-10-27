# Upper Crust item photo mapping

Twelve of the 26 fixture items have verified menu photos. All are served through the finite protected `/r/upper-crust/media/` allowlist outside `public/`. Existing owner-attested photos remain scoped to the SSO-protected Preview. New item photos are from the local menu-item source folder and are included only in this protected Preview per the owner's instruction; this is not authorization for public or production release. SHA-256 values and exact source paths are recorded in `upper-crust-hosted-asset-manifest.json`.

| Fixture item ID | Protected asset | Match basis |
| --- | --- | --- |
| `uc-italian-sub-one` | `menu-italian-sub-for-one.jpg` | Source filename identifies the one-person Italian Sub entry; the image shows a cut Italian-style sub portion. |
| `uc-hawaiian` | `hawaiian sandwich.jpg` | Existing owner gallery caption identifies the Hawaiian sandwich; the photo shows pineapple. |
| `uc-grinder-one` | `menu-grinder-for-one.png` | Source filename identifies the one-person Grinder entry; image shows one Grinder serving cut into halves. |
| `uc-french-dip` | `menu-french-dip.jpg` | Source filename identifies French Dip; the image shows roast beef on a roll with a dipping cup. |
| `uc-bbq-beef` | `menu-bbq-beef.jpg` | Source filename identifies BBQ Beef; the image shows the beef sandwich. |
| `uc-blt` | `menu-blt.jpg` | Source filename identifies BLT; the image shows a sandwich with bacon, lettuce and tomato. |
| `uc-grinder-two` | `menu-grinder-for-two.png` | Source filename identifies the two-person Grinder; the image shows two separate Grinder servings. |
| `uc-custom` | `veggie sandwich.jpg` | Owner gallery caption identifies a vegetarian sandwich; visual review shows both halves. The public merchant Whole Custom Sandwich dialog explicitly offers Vegetarian (Includes Avocado). This is the pictured vegetarian configuration of the whole custom sandwich, not a fixed filling/default or a half/two-person portion. |
| `uc-half-custom` | `menu-half-custom-sandwich.jpg` | Source filename identifies Half Custom Sandwich; image shows a single sandwich portion. |
| `uc-cobb-salad` | `cobb salad.jpg` | Existing owner gallery caption identifies Cobb salad; the photo shows the salad. |
| `uc-dinner-salad` | `menu-dinner-salad.jpg` | Source filename identifies Dinner Salad; image shows a plated garden salad. |
| `uc-brownies` | `brownie.jpg` | Existing owner gallery caption identifies a brownie; the photo shows a brownie. |

The new source folder contained 12 named files. Eight are now assigned: six new fixture identities plus the more specific item-photo files for the already-matched BLT and one-person Italian Sub. The other four were not added: the Chicken Salad Salad photo shows sliced chicken breast rather than the fixture's scoop-style preparation; the Hawaiian candidate does not visibly establish pineapple and Swiss, so the existing owner-attested match remains; the Cobb Salad and Whole Custom candidates do not improve on their existing verified matches.

Fourteen fixture items remain without a verified photo: `uc-soup-bowl`, `uc-soup-cup`, `uc-italian-sub-two`, `uc-albacore-tuna-salad`, `uc-chef-salad`, `uc-caesar-salad`, `uc-chicken-salad-salad`, `uc-side-orders`, `uc-cheesecake`, `uc-chips`, `uc-two-cookies`, `uc-bottled-water`, `uc-large-drink`, and `uc-small-drink`. No two-person item receives a one-person photo, and no generic side/dessert image is assigned to a specific item without evidence.

The prior DoorDash scraper investigation remains historical: it had no saved Upper Crust result, and the challenged automated request was not repeated. The new local photos were checked directly and matched by named item identity; no DoorDash hotlinks or new scrape requests were used.
