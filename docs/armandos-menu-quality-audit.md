# Armando's Menu Copy and Data Quality Audit

**Scope:** Armando's 309 DoorDash-source item placements in `data/armandos.json` (26 sections), compared with the published Armando's staging menu and its current provisional modifier configuration on 2026-09-30.

**Read-only:** No staging data, fixtures, application code, or menu configuration was changed. This document is a recommendation list; it does not authorize copy or configuration edits.

## 1. Executive summary

The source fixture has 309 items and 26 sections. All source IDs and descriptions were scanned for encoding artifacts, missing values, whitespace and grammar defects, repeated names/descriptions, and obvious source-copy inconsistencies. The published staging menu was checked with read-only SQL for choice wording, required groups, attached paid extras, and whole-menu orderability.

The scan found no mojibake or replacement characters. It found one missing description, five clear typo records, and three mechanically clear copy defects. Several same-name or same-description clusters should remain separate pending owner review because the source IDs, prices, or sections differ. Modifier checks found 12 orderable items whose copy says they are served with “corn or flour tortillas” but which have no active required choice group. The two 20-taco packs also advertise a meat combination but are intentionally held non-orderable. Their hold is expected and was not counted as an orderable-item modifier defect.

Read-only staging checks returned 309 placements; 307 orderable items and the two held 20-taco packs; 29 placements whose name or description contains broad choice wording; 14 of those with no active required group (12 orderable items plus the two holds); and zero active paid-extra selections that duplicated a named included guacamole/avocado, sour cream, or cheese ingredient. The broad choice scan is a review signal, not a claim that every “or” in prose must become a modifier. Existing “Choose your meat,” “Choose chicken or beef,” and “Tortillas or Chips” required groups otherwise match explicit source choices where attached.

### Issue counts

Counts below are issue records. One record may cover a duplicate cluster with multiple source items; one source item may appear in more than one classification.

| Classification | Issue records |
|---|---:|
| `ENCODING_FIX` | 0 |
| `OBVIOUS_TYPO` | 5 |
| `COPY_CLEANUP` | 4 |
| `MISSING_DESCRIPTION` | 1 |
| `POSSIBLE_DUPLICATE` | 9 |
| `POSSIBLE_DATA_MISMATCH` | 2 |
| `CUSTOMIZATION_COPY_CONFLICT` | 13 |
| `PRICE_OR_SIZE_ANOMALY` | 6 |
| `OWNER_VERIFICATION` | 1 |
| **Total issue records** | **41** |

Eight mechanical copy changes (the five typo records and three mechanical cleanup records) are high-confidence and safe to correct before owner approval. There are **37 unique source items** in non-mechanical findings that need owner confirmation or should remain unchanged pending it. That count excludes the two intentionally held party packs and does not count safe mechanical items.

## 2. High-confidence mechanical fixes

These are the only recommendations marked safe before owner approval. Corrections are literal typo/spacing/grammar repairs; do not alter meaning or food composition. Nothing has been edited.

| Source item ID | Item / section | Current text | Recommended mechanical correction | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `16994295879` | Steak Breakfast Burrito with Beans / Breakfast Burritos | “scrambled scrambled eggs” | “scrambled eggs” | `OBVIOUS_TYPO` | High | Yes |
| `2843786809` | Supreme Burrito / Burritos | “a chille relleno” | “a chile relleno” | `OBVIOUS_TYPO` | High | Yes |
| `198880534` | Adobada Mini Taco / Street Tacos | “corn torilla” | “corn tortilla” | `OBVIOUS_TYPO` | High | Yes |
| `198880597` | Cabeza Taco / Tacos | “corn torilla” | “corn tortilla” | `OBVIOUS_TYPO` | High | Yes |
| `198880589` | Carne Asada Taco / Tacos | “corn torilla” | “corn tortilla” | `OBVIOUS_TYPO` | High | Yes |
| `5772977560` | Ham, Egg, and Cheese Burrito / Breakfast Burritos | “and  cheddar cheese” | Remove the duplicated space | `COPY_CLEANUP` | High | Yes |
| `198880632` | California Burrito / Burritos | “french fries  wrapped” | Remove the duplicated space | `COPY_CLEANUP` | High | Yes |
| `198880533` | Pollo Asado Mini Taco / Street Tacos | “with topped with fresh chopped onions” | “topped with fresh chopped onions” | `COPY_CLEANUP` | High | Yes |

One additional title is awkward but not a safe mechanical edit: `24580195808` California Wet Burrito / Red Sauce / Guacamole / Pico / Cheese / Sour Cream / Fries / Only (Wet Burritos). The slash-delimited recipe and trailing “Only” may encode a source-specific variant. Classify as `COPY_CLEANUP`, confidence medium, safe before approval: **No**; ask what “Only” distinguishes before proposing a replacement title.

No source item has a detected encoding-repair candidate. Accented characters such as `picó`, `Camarón`, and `consommé` are present as valid text in the source; SQL-editor rendering seen in prior seed text is not evidence that these source values are corrupted.

## 3. Possible duplicates

Do not merge or delete these. Distinct DoorDash IDs may intentionally preserve separate listings, source menus, or price points.

| Source items | Evidence | Why they may be intentional | Classification / confidence / safe? |
|---|---|---|---|
| `17056986042` and `198880681` — Surf and Turf Burrito, Burritos | Same display name; $14.34 vs $13.67; descriptions list different ingredients (`fresh vegetables` versus avocado, sour cream, and cheese). | The descriptions differ materially, so these may be two source variants despite sharing a title. | `POSSIBLE_DUPLICATE`; Medium; No |
| `359798143` and `198880682` — Shredded Chicken Taco, Tacos | Same name; $2.99 vs $3.45; one description is only “With cheese and lettuce,” while the other specifies shredded chicken and a crispy shell. | A different shell/style or source listing may explain the price and copy difference. | `POSSIBLE_DUPLICATE`; Medium; No |
| `198880549` and `22785216696` — 8 oz Rice, Side Orders | Same name and exact description; $3.99 vs $4.25. | Could be separate source listings or a source price change; same stated size makes the price difference worth checking. | `POSSIBLE_DUPLICATE`; High; No |
| `2439306342` and `22784339672` — 8 oz Guacamole, Side Orders | Same name and exact description; $4.75 vs $4.99. | Could be separate source listings or a source price change. | `POSSIBLE_DUPLICATE`; High; No |
| `4952705422` and `22784662544` — 4 oz Sour Cream, Side Orders | Same name and exact description; $2.19 vs $2.56. | Could be separate source listings or a source price change. | `POSSIBLE_DUPLICATE`; High; No |
| `5337696094` and `198880697` — #23. Two Shredded Chicken Tacos, Combination Plates | Same name and exact description; $13.99 vs $10.99. | Separate DoorDash IDs may reflect distinct menus or source revisions; the $3 difference is not explained by the copy. | `POSSIBLE_DUPLICATE`; High; No |
| `6912796879` and `5765626765` — Two Chicken Enchiladas with Green Sauce / Two Chicken Enchiladas with Rice and Beans, Combination Plates | Descriptions are identical and mention both green salsa and rice/beans; titles distinguish different aspects; $13.67 vs $13.66. | Titles could represent two intended source variants, but the identical copy does not distinguish them. | `POSSIBLE_DUPLICATE`; Medium; No |
| `14833449100` — Ranchera Plate, Combination Plates; `15042953277` — Ranchera Meat Plate, Ranchera Plate | Same exact description; related names; $17.99 vs $18.98; separate sections. | The separate section and name may be intentional, but the copy gives no distinction. | `POSSIBLE_DUPLICATE`; Medium; No |
| `5337571594` — Super Rolled Tacos, Carne Asada Fries, Nachos, Quesadillas & Sides; `198880695` — #21. Super Rolled Tacos, Combination Plates | Exact same description; $13.99 vs $9.99; listings are in separate sections and have different names. | May be separate source listings or portions; the description does not explain the $4 difference. Both advertise chicken-or-beef and staging has a required group on each. | `POSSIBLE_DUPLICATE`; Medium; No |

Additional near-match observed but not counted as a likely duplicate issue: Small Veggie Fries (`27631629582`, $9.99) and Large Veggie Fries (`27634029237`, $11.99) share a description, while their names clearly specify size. Preserve both unless the owner says otherwise.

## 4. Description and copy issues

### Clear mechanical copy issues

The eight high-confidence repairs are listed in section 2.

### Missing description

| Source item ID | Item / section | Current text/value | Recommendation | Confidence | Safe before approval? |
|---|---|---|---|---|---|
| `198880605` | Potato Taco / Tacos | Description is `null`; staging displays no description. Price is $2.45. | Request source/owner-approved description or retain the empty description. Do not infer ingredients. | High that it is missing; low on any proposed text | No |

### Sparse or non-distinguishing copy

| Source item IDs | Items / section | Current relevant text | Recommendation | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `9871951347`, `9872697488`, `9872697486`, `9871525714` | Carne Asada Wet Burrito with Green Sauce; Carne Asada Wet Burrito with Red and Green Sauce; Carne Asada Wet Burrito Red Sauce; Carnitas Wet Burrito with Red Sauce / Wet Burritos | Each description is only “Served with rice and refried beans.” | Ask whether the source descriptions are intentionally abbreviated. If approved, add only owner-provided distinctions about the filling/sauce; do not infer or copy ingredients from similarly named listings. | `POSSIBLE_DATA_MISMATCH` | High | No |
| `15070738058` | Lengua Torta with Rice and Beans – C/C Only / Lengua | Description ends “Beef tongue, rice, beans, and C/C”; the abbreviation is unexplained. | Ask the owner what “C/C” means and whether it belongs in the customer-facing copy. Preserve it pending an answer. | `OWNER_VERIFICATION` | High | No |

## 5. Data inconsistencies

| Source item IDs | Item / section | Current relevant text/value | Issue and recommendation | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `198880699` | #24. Chicken Fajita Burrito / Combination Plates | Name says “Chicken”; description says “A chicken or carne asada fajita burrito with rice, avocado, shrimp, onion, and bell peppers.” Staging `Choose your meat` group is restricted to Chicken and Carne Asada. | The required choices match the description, but the title is narrower and the listed shrimp is unexplained by the title. Ask whether the title, filling list, or both need correction. Do not remove shrimp or rename the item without source confirmation. | `POSSIBLE_DATA_MISMATCH` | Medium | No |

The four generic wet-burrito descriptions are classified as `POSSIBLE_DATA_MISMATCH`; they may be incomplete source copy rather than an item-to-description join error. No automated mismatch was treated as proof that a dish's ingredients are wrong.

### Price/size review

These six pair-level price flags overlap the duplicate candidates in section 3; they are separate price questions, not six additional items or proof that either price is wrong.

| Source item IDs | Item / section | Current values | Owner question | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `198880549`, `22785216696` | 8 oz Rice / Side Orders | Same stated size/copy; $3.99 vs $4.25 | Are both prices current for separate listings? | `PRICE_OR_SIZE_ANOMALY` | High | No |
| `2439306342`, `22784339672` | 8 oz Guacamole / Side Orders | Same stated size/copy; $4.75 vs $4.99 | Are both prices current for separate listings? | `PRICE_OR_SIZE_ANOMALY` | High | No |
| `4952705422`, `22784662544` | 4 oz Sour Cream / Side Orders | Same stated size/copy; $2.19 vs $2.56 | Are both prices current for separate listings? | `PRICE_OR_SIZE_ANOMALY` | High | No |
| `5337696094`, `198880697` | #23. Two Shredded Chicken Tacos / Combination Plates | Same name/copy; $13.99 vs $10.99 | Is the $3.00 difference intentional or a stale source price? | `PRICE_OR_SIZE_ANOMALY` | High | No |
| `6912796879`, `5765626765` | Two Chicken Enchiladas titles / Combination Plates | Identical description; $13.67 vs $13.66 | Is the one-cent difference intentional, and do the titles represent separate listings? | `PRICE_OR_SIZE_ANOMALY` | Medium | No |
| `14833449100`, `15042953277` | Ranchera Plate / Ranchera Meat Plate, two sections | Identical description; $17.99 vs $18.98 | Are these separate section listings with separate prices? | `PRICE_OR_SIZE_ANOMALY` | Medium | No |

## 6. Modifier/copy conflicts

### “Corn or flour tortillas” without a required group

Live staging has these 12 orderable listings whose descriptions say “corn or flour tortillas” but which have no active required modifier group. This wording may describe an actual customer choice; the existing group is named **Tortillas or Chips**, so it does not obviously encode the stated corn-versus-flour choice. Confirm intended ordering semantics before changing copy or configuration.

| Source item ID | Item / section | Current relevant text | Question / recommendation | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `7949242446` | Adobada Plate with Rice and Beans / Combination Plates | “Served with corn or flour tortillas.” | Is the customer choosing corn vs flour, and should the wording/configuration make that choice explicit? | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `376154282` | Birria Bowl / Combination Plates | “Served with onion, cilantro, and corn or flour tortillas.” | Does a bowl include a tortilla choice? Confirm whether the description is accurate. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `376154181` | Birria Combo / Combination Plates | “Served with corn or flour tortillas.” | Confirm whether this is a choice and whether the same rule applies to comparable combos. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `7949201301` | Chile Verde Plate with Rice and Beans / Combination Plates | “Served with rice, refried beans, and corn or flour tortillas.” | Confirm whether a customer choice is intended. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `14833449100` | Ranchera Plate / Combination Plates | “Served with corn or flour tortillas.” | Confirm whether a customer choice is intended; this listing shares copy with Ranchera Meat Plate in another section. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `198880528` | Chicken Fajitas / Fajitas | “Served with … corn or flour tortillas.” | Confirm whether the tortilla type is selectable. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `198880527` | Shrimp Fajitas / Fajitas | “Served with … corn or flour tortillas.” | Confirm whether the tortilla type is selectable. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `198880529` | Steak Fajitas / Fajitas | “Served with … corn or flour tortillas.” | Confirm whether the tortilla type is selectable. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `15070153181` | Lengua Combo / Lengua | “Served with corn or flour tortillas.” | Confirm whether this is a customer choice. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `15042953277` | Ranchera Meat Plate / Ranchera Plate | “Served with corn or flour tortillas.” | Confirm whether this is a customer choice; it duplicates Ranchera Plate copy across sections. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `359793528` | Caldo de Camarón / Soups & Menudo | “Served with onion, cilantro, and corn or flour tortillas.” | Confirm whether a tortilla selection is intended for this soup. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |
| `17110451876` | Menudo / Soups & Menudo | “Served with onion, cilantro, and corn or flour tortillas.” | Confirm whether a tortilla selection is intended for this soup. | `CUSTOMIZATION_COPY_CONFLICT` | Medium | No |

### Included toppings without removals

| Source item ID | Item / section | Current relevant text/value | Question / recommendation | Classification | Confidence | Safe before approval? |
|---|---|---|---|---|---|---|
| `198880526` | Flying Saucer / Combination Plates | Description lists refried beans, shredded beef, cheese, lettuce, onion, and bell peppers. It is intentionally base-only in the current plan while similar plated/loaded items expose selected removals. | Current base-only treatment preserves the dish as a layered identity, so this is not a proven defect. Ask whether removals are desired for any toppings before changing the provisional setup. | `CUSTOMIZATION_COPY_CONFLICT` | Low | No |

### Choices that are already represented

- `#8. Two Tostadas – Choice of Meat` (`198880505`) and `Two Sopes Combo – Choice of Meat` (`1206365534`) have the required meat group.
- `Torta with Fries` (`445069647`) says “Your choice of meat” and has the required meat group. `Extra Meat – Carne Asada or Chicken` (`198880560`) likewise has the required choice.
- `Super Rolled Tacos` (`5337571594`) and `#21. Super Rolled Tacos` (`198880695`) say chicken or beef and have the required chicken/beef group.
- `#24. Chicken Fajita Burrito` (`198880699`) describes chicken or carne asada and has the matching required meat group restricted to those two options.
- Items whose copy explicitly says “your choice of tortillas or chips” and already has the required `Tortillas or Chips` group did not produce a mismatch in this audit.
- The read-only staging query found no active paid `Add extras` option duplicating a named included guacamole/avocado, sour cream, or cheese ingredient. It found no required group attached to the two held party packs.

The two held source items, `359794279` Special Packet #1 – 20 Mini Tacos and `359796582` Special Packet #2 – 20 Mini Tacos with Rice and Beans, say “your choice of meat – any combination.” Both remain non-orderable by design, so no required group is attached. Keep them held pending an owner-defined meat-mix model.

## 7. Items requiring owner verification

There are **37 unique source item IDs** in findings that are not safe mechanical repairs: the duplicate/price clusters, the 12 orderable tortilla-wording cases, Flying Saucer's base-only treatment, the Chicken Fajita Burrito wording, four sparse wet-burrito descriptions, the missing Potato Taco description, the unexplained C/C abbreviation, and the slash-delimited California Wet Burrito title. Their individual IDs and evidence appear in sections 3–6.

Owner verification should resolve, without consolidating listings:

1. Whether the repeated names and copy clusters are intentional separate DoorDash listings, and which prices remain current.
2. Whether “corn or flour tortillas” describes a selectable option, and whether each soup/bowl/plate actually includes tortillas.
3. Which source-approved copy should distinguish the four wet burrito listings and what “C/C” means.
4. Whether the Chicken Fajita Burrito title and listed shrimp ingredient are both correct.
5. Whether any Flying Saucer toppings should be removable while preserving its fixed layered base.
6. A source-approved Potato Taco description.

The two party packs are held and excluded from the 37-item count: their required-choice absence is intentional for now, not an accidental configuration loss.

## 8. Recommended pre-pitch fixes vs post-approval cleanup

### Safe mechanical fixes before owner approval

Eight records: `scrambled scrambled`, `chille`, three instances of `torilla`, two duplicated-space defects, and `with topped with`. Apply only the literal corrections shown in section 2 after the normal copy-review step. No encoding repair is needed.

### Hold for owner approval

- All duplicate clusters and price differences. Preserve each DoorDash item ID, name, section, and price until the owner confirms which entries are intentional/current.
- All 12 “corn or flour tortillas” cases. Do not guess that the existing `Tortillas or Chips` group means corn vs flour.
- Chicken Fajita Burrito wording, wet-burrito copy, C/C abbreviation, Potato Taco description, and Flying Saucer removals.
- The two 20-taco party packs remain unavailable; do not invent mix semantics.

### Post-approval cleanup

Once the owner confirms source meaning, update copy and tenant-owned modifiers in a separate scoped change. Keep source IDs and distinct listings, preserve prices unless explicitly approved, and maintain orderability for all currently orderable items.

## Audit notes

- **Source/grain:** one DoorDash source item per menu placement in `data/armandos.json`; distinct source IDs are preserved even when names repeat.
- **Staging evidence:** read-only queries against the Armando's published Main Menu on 2026-09-30; checked placements, required-group attachments, active paid extras, current held IDs, and 307/2 orderability.
- **Text checks:** source descriptions, names, sizes, prices, and sections scanned for null/empty descriptions, mojibake/replacement characters, repeated normalized names/descriptions, whitespace defects, and selected obvious spelling/grammar problems.
- **Limits:** identical or near-identical copy does not prove a duplicate; “corn or flour tortillas” may be descriptive rather than a customer choice; this audit does not verify recipe truth or source-platform history.
