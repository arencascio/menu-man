# Armando's menu customization audit (provisional)

**Scope:** staging fixture in `data/armandos.json` and the current staging test modifier seed. Read-only audit; no database, UI, cart, or ordering changes were made.
**Item identity:** source item ID (`doordash:<sourceItemId>`), because the read-only staging API request failed from this session; live UUIDs/configuration were not independently verified.
**Coverage:** 309 unique item placements across 26 sections. The fixture and `supabase/tests/003_armandos_fixture.sql` agree on the 309-placement staging menu version.

## Summary

| Measure | Count |
|---|---:|
| Published fixture items | 309 |
| Already orderable with a valid attached configuration | 2 |
| Need an orderability/configuration change | 307 |
| Ambiguous configuration decisions | 2 |
| Data problems affecting the ordering floor | 0 |
| Would remain non-orderable until ambiguity is resolved | 2 |

Need an orderability/configuration change includes setting `is_orderable = true` in a later approved data pass. Every fixture item has a positive listed price and can have a valid default cart configuration without a modifier selection. Items that advertise choices should receive those choices before activation when the wording is clear. Two 20-taco party packs have quantity/mix semantics that the present generic modifier groups do not express cleanly; hold those two out of activation until the 20-meat mix is represented or the restaurant chooses a single-meat default. Thus the minimum plan leaves 2 unresolved; deciding these rows could reduce that count to zero.

## Existing modifier patterns

| Reusable configuration | Existing options | Price pattern | Audit use |
|---|---|---|---|
| `Choose your meat` (required, exactly 1) | Carne Asada $0; Chicken $0 (seed default); Carnitas $0 | Base advertised selection, $0 | Use when an item explicitly requires a single meat. Existing test group lacks Al Pastor, which is explicitly advertised by some choices. |
| `Add extras` (optional, 0 to 4) | Guacamole +$1.50; Sour Cream +$0.75; Cheese +$1.00 | Guacamole has a $2.00 item override on Tostadas; otherwise option default | Reuse only on compatible savory food and only when the ingredient is not already included. These are demo prices, not verified prices. |

No reusable group is present for tortilla/chips choices, drink size, or flavor selection. Listed fixed-size drinks do not need a size selector. For compatible food, optional extras can be omitted while preserving a valid default. Do not charge for ingredients already described as included.

## Item-by-item plan

Classification: `ALREADY_ORDERABLE` means the existing staging test configuration yields a valid selection; `NEEDS_REQUIRED_CHOICE` means the item?s copy expressly advertises a required choice; `NEEDS_OPTIONAL_ADDONS` means it has no explicit required choice and can be enabled with the listed base item, with extras as an optional enhancement; `AMBIGUOUS` flags a choice the current modifier model/copy does not resolve cleanly. All non-enabled rows need the later orderability flag change.

### 1. Breakfast Plates (4)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_REQUIRED_CHOICE` | `doordash:24580195805` | Ham Plate with Eggs, Cheese, and Potatoes | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortillas or chips; record one required choice, preserving listed price. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:43896844525` | Huevos a la Mexicana | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:24579759048` | Original Plate - Bacon, Egg, Cheese, and Potatoes with Rice & Beans | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortillas or chips; record one required choice, preserving listed price. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:24580228943` | Steak and Eggs Plate with Cheese and Potatoes | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortillas or chips; record one required choice, preserving listed price. Confidence: **medium**. |

### 2. Breakfast Burritos (18)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5333328467` | Bacon and Sausage Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1165791286` | Chicken Breakfast Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880674` | Chorizo Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5772874081` | Chorizo Burrito with Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1165788874` | Chorizo Burrito with Potato | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5333326965` | Egg and Cheese Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5334803698` | Ham and Bacon Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880676` | Ham Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5772977560` | Ham, Egg, and Cheese Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880675` | Machaca Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880673` | Original Breakfast Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1165790039` | Original Breakfast Burrito with Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880679` | Sausage Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5766331847` | Sausage Burrito with Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8476042131` | Sausage, Chorizo, Egg, Cheese, and Potatoes Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:16994295879` | Steak Breakfast Burrito with Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880678` | Steak Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:418346709` | Super Breakfast Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 3. Burritos (33)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880628` | Adobada Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:11825834217` | Asada Burrito Combo | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759912295` | Asada Burrito with Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:2989351384` | Asada Burrito with Cheese and Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759912198` | Asada Burrito with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759911357` | Asada Wet Burrito with Green Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:425682195` | Asada Wet Burrito with Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880664` | Beans and Cheese Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:3343947796` | Birria Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880663` | Cabeza Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880632` | California Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880626` | Carne Asada Burrito with guacamole and pico | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1169949037` | Carne Asada Burrito with Rice and Beans Only | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:16994292882` | Carne Asada Burrito with Cheese, Sour Cream, and Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:23721922361` | Carne Asada Burrito with Guacamole, Pico, Cheese, Sour Cream, Rice, and Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880629` | Carnitas Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:16994291329` | Chicken Burrito with Beans and Rice | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1145493274` | Chicken California Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880671` | Chicken Chipotle | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880666` | Chile Relleno Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880670` | Chile Verde Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880659` | Del Mar Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783650552` | Diabla Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880635` | Fish Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880667` | Ground Beef Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880672` | Mixed Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880627` | Pollo Asado Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880662` | Shredded Beef Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880656` | Shrimp Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:2843786809` | Supreme Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:17056986042` | Surf and Turf Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880668` | Veggie Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880681` | Surf and Turf Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 4. Wet Burritos (9)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:24579992217` | Adobada Wet Burrito with Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:30381328433` | Cabeza Wet Burrito with Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:24580195808` | California Wet Burrito / Red Sauce / Guacamole / Pico / Cheese / Sour Cream / Fries / Only | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9871951347` | Carne Asada Wet Burrito with Green Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9872697488` | Carne Asada Wet Burrito with Red and Green Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9872697486` | Carne Asada Wet Burrito Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9871525714` | Carnitas Wet Burrito with Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:30381107207` | Lengua Wet Burrito with Green Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:30381246062` | Lengua Wet Burrito with Red Sauce | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 5. Street Tacos (11)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:44177153503` | 5 Carnitas Street Tacos Special | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:769016784` | 10 Hard Shell Potato Tacos with Lettuce and Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880534` | Adobada Mini Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880535` | Cabeza Mini Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880530` | Carne Asada Mini Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880532` | Carnitas Mini Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880536` | Ceviche Tostada | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880533` | Pollo Asado Mini Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:7995395228` | 5 Carne Asada Street Tacos Special | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `AMBIGUOUS` | `doordash:359794279` | Special Packet #1 - 20 Mini Tacos | Meat choice(s) for 20 tacos; mix allowed by copy but quantity/mix representation unresolved | ? | Choose your meat options are partial; requires quantity-aware party-pack plan | ?Any combination? across 20 pieces is not represented by one single-select choice. Do not invent a default mix; safe no-choice ordering needs review. Confidence: **low**. |
| `AMBIGUOUS` | `doordash:359796582` | Special Packet #2 - 20 Mini Tacos with Rice and Beans | Meat choice(s) for 20 tacos; mix allowed by copy but quantity/mix representation unresolved | ? | Choose your meat options are partial; requires quantity-aware party-pack plan | ?Any combination? across 20 pieces is not represented by one single-select choice. Do not invent a default mix; safe no-choice ordering needs review. Confidence: **low**. |

### 6. Tacos (23)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:11651480977` | 3 Fish Tacos Special | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:17056986048` | 3 Quesabirria Tacos with Consome (8oz) | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880593` | Adobada Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880594` | Beef Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8139021260` | Birria Taco Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880597` | Cabeza Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880589` | Carne Asada Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880609` | Carne Asada Taco Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880592` | Carnitas Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8139021259` | Carnitas Taco Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564140620` | Chicken Taco Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564140375` | Del Mar Taco Salad Shrimp and Crab Meat | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880595` | Fish Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880603` | Ground Beef Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880590` | Pollo Asado Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880605` | Potato Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:7176579097` | Quesabirria Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:359798143` | Shredded Chicken Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880596` | Shrimp Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:28128242562` | Shrimp Taco Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:7172256177` | Birria Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880604` | Del Mar Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880682` | Shredded Chicken Taco | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 7. Tortas (10)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880582` | Adobada Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880580` | Asada Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880586` | Beef Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:3736422304` | Birria Torta | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880583` | Carnitas Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880584` | Chorizo Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880588` | Ham Torta | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880585` | Machaca Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880581` | Pollo Asado Torta | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:445069647` | Torta with Fries | Choose your meat (exactly 1: menu-listed meats) | Add extras (optional; savory food only) | Reuse Choose your meat group where options match; add explicitly listed Al Pastor if selected; $0 base choices | Menu name/description explicitly says choice of meat.  Confidence: **high**. |

### 8. Sopes (8)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880540` | Adobada Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880537` | Asada Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880541` | Beef Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6416075485` | Birria Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564138398` | Cabeza Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880542` | Carnitas Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880539` | Pollo Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564138455` | Veggie Sope | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 9. Tostadas (7)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880574` | Bean Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880573` | Beef Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880570` | Carne Asada Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:3827669440` | Carnitas Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880572` | Chicken Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783650559` | Lengua Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6929631873` | Al Pastor Tostada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 10. Enchiladas (7)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6912777372` | Asada Enchiladas with Green Sauce | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6921460910` | Asada Enchiladas with Red Sauce | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880576` | Beef Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880575` | Cheese Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880579` | Chicken Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6918221785` | Grilled Chicken Enchiladas with Green Sauce | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880577` | Mixed Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 11. Rolled Tacos (9)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880567` | 3 Beef Rolled Tacos with Guacamole and Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880565` | 3 Beef Rolled Tacos with Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5763647597` | 3 Chicken Rolled Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5765605340` | 5 Chicken Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8570286826` | 5 Chicken Rolled Tacos with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880568` | 5 Beef Rolled Tacos Special | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8570235923` | 5 Beef Rolled Tacos with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5763651453` | 6 Chicken Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880569` | 12 Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 12. Fried Chimichangas (6)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880546` | Adobada Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880548` | Beef Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880543` | Carne Asada Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880545` | Carnitas Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6912933537` | Chile Verde Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880547` | Grilled Chicken Chimichanga | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 13. Side Orders (21)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880550` | 8 oz Refried Beans | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880549` | 8 oz Rice | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:2439306342` | 8 oz Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4953288296` | 4 oz Bacon | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880560` | Extra Meat â€“ Carne Asada or Chicken | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4953282371` | Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4953282370` | 8 oz Lettuce | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564140883` | One Flour Tortilla | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4952014099` | Pico de Gallo | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564138294` | Pint of Beans 32 oz | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564138272` | Pint of Rice 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4952705422` | 4 oz Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1165798551` | 3 Chiles Toreados | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22785216698` | 4 oz Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784110428` | 4 oz Pico de Gallo | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784662544` | 4 oz Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784110426` | 8 oz Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784339672` | 8 oz Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22785216696` | 8 oz Rice | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22919286579` | Carrots and JalapeÃ±os | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22785575681` | Chiles Toreados Serranos | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |

### 14. Carne Asada Fries, Nachos, Quesadillas & Sides (42)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:421785797` | Adobada Chips | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:10770317768` | Adobada Fries with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880554` | Adobada Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:10608873268` | Birria Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:10609047987` | Birria Nachos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9813230337` | Cabeza Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880523` | Carne Asada Chips | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880524` | Carne Asada Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8570438359` | Carne Asada Fries with Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8286200667` | Carne Asada Fries with Beans and Sour Cream â€“ No Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:10891185528` | Carne Asada Fries with PicÃ³ de Gallo | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759912715` | Carne Asada Fries with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8286730317` | Carne Asada Fries with Sour Cream â€“ No Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8287922962` | Carne Asada Fries with Sour Cream, Rice, and Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5995006478` | Carne Asada Nachos with Beans, Onion, and Cilantro | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1169941272` | Carne Asada Nachos with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880556` | Carne Asada Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5336575300` | Carnitas Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880551` | Cheese Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880553` | Chicken Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6917687049` | Chile Verde Nachos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880559` | Chips and Guacamole | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:32960992457` | Chips and Guacamole No Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880561` | Chips and Salsa | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880557` | French Fries | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880562` | Half-Order Carne Asada Chips | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880563` | Half-Order Carne Asada Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759912532` | Half-Order Carne Asada Fries with Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:2222103720` | Large Chicken Nachos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5347103892` | Large Ground Beef Fries with Rice, Cheese, and Sour Cream | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:27634029237` | Large Veggie Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5613241909` | Quesabirria | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:44177153501` | Shredded Beef Nachos Bell Peppers Onion | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880552` | Shrimp Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358347767` | Small Surf and Turf Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:27631629582` | Small Veggie Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:759911924` | Super Nachos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5337571594` | Super Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358347340` | Surf and Turf Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:3871320158` | Surf and Turf Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:4921379008` | Trio Fries with Shrimp, Chicken, and Carne Asada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9830707325` | Two Chiles Rellenos A la Carte | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 15. Combination Plates (40)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5337696094` | #23. Two Shredded Chicken Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880491` | #1. Tostada and Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880495` | #2. Two Beef Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880497` | #3. Two Cheese Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880499` | #4. Bean Tostada and Cheese Enchilada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880500` | #5. Beef Taco and Cheese Enchilada | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880503` | #6. Cheese Enchilada and Beef Burrito | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880504` | #7. Two Beef Burritos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `ALREADY_ORDERABLE` | `doordash:198880505` | #8. Two Tostadas â€“ Choice of Meat | Choose your meat (1) | Add extras (0 to 4) | Existing test groups; Chicken default; listed demo prices, Guac item override +$2 on this item | Attached by current staging test seed; valid default exists. Keep as-is in planning pending replacing demo prices/options. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880507` | #9. Two Pollo Asado Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880508` | #10. Two Chicken Enchiladas | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880509` | #11. Beef Taco and Beef Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:198880510` | #12. Carne Asada Plate | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortilla/chips choice; item-specific tortilla subtype is not given. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880511` | #13. Machaca Plate | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880512` | #14. Chorizo Plate | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:198880513` | #15. Carnitas Plate | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortilla/chips choice; item-specific tortilla subtype is not given. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880514` | #16. Two Carne Asada Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880515` | #17. Two Chiles Rellenos Plate | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880518` | #18. Two Fish Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:198880519` | #19. Pollo Asado Plate | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortilla/chips choice; item-specific tortilla subtype is not given. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880520` | #20. Three Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:7949242446` | Adobada Plate with Rice and Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:376154181` | Birria Combo | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:376154282` | Birria Bowl | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:7995077785` | Cabeza Plate with Rice and Beans | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortilla/chips choice; item-specific tortilla subtype is not given. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880521` | Camarones a la Diabla | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6912796879` | Two Chicken Enchiladas with Green Sauce | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:10770381235` | Chile Relleno and Cheese Enchilada Combo | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:7949201301` | Chile Verde Plate with Rice and Beans | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880522` | Enchiladas del Mar | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880526` | Flying Saucer | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:14833449100` | Ranchera Plate | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5765626765` | Two Chicken Enchiladas with Rice and Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8880117979` | Two-Enchilada Combo â€“ Chicken and Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5732068679` | Two Birria Tacos with Rice, Beans, and ConsommÃ© | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6416059090` | Two Birria Sopes Combo | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `ALREADY_ORDERABLE` | `doordash:1206365534` | Two Sopes Combo â€“ Choice of Meat | Choose your meat (1) | Add extras (0 to 4) | Existing test groups; Chicken default; listed demo prices, Guac item override +$2 on this item | Attached by current staging test seed; valid default exists. Keep as-is in planning pending replacing demo prices/options. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880695` | #21. Super Rolled Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880697` | #23. Two Shredded Chicken Tacos | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880699` | #24. Chicken Fajita Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 16. Soups & Menudo (5)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6875773854` | Caldo de Res | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:359793528` | Caldo de CamarÃ³n | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_REQUIRED_CHOICE` | `doordash:24580277827` | Caldo de Pescado (Fish Soup) | Tortillas or Chips (exactly 1) | Add extras (optional; savory food only) | No existing matching group; choices are stated in item description; base price $0 | Description explicitly offers tortillas or chips; record one required choice, preserving listed price. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:17110451876` | Menudo | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:44255519656` | Red Pozole | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |

### 17. Three-Taco Specials (6)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880564` | 3 Carne Asada Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564141127` | 3 Cabeza Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:1115187588` | 3 Carnitas Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564141004` | 3 Al Pastor Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564141338` | 3 Pollo Asado Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:5336746597` | 3 Birria Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 18. Fajitas (4)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880528` | Chicken Fajitas | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880527` | Shrimp Fajitas | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880529` | Steak Fajitas | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:6918405632` | Trio Fajitas â€“ Shrimp, Chicken, and Steak | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 19. Lengua (12)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070153181` | Lengua Combo | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070184232` | Lengua Burrito | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070309400` | Lengua Fries with Beans, Cheese, Rice, Onion, and Cilantro | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15069923427` | Lengua Fries with Guacamole and Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15069308837` | Lengua Nachos with Beans, Rice, Cheese, Onion, and Cilantro | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070184233` | Lengua Nachos with Guacamole and Cheese | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:30286215939` | Lengua Quesadilla | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070184231` | Lengua Street Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070737811` | Lengua Taco | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070184234` | Lengua Torta with Guacamole, PicÃ³ de Gallo, and Lettuce | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15070738058` | Lengua Torta with Rice and Beans â€“ C/C Only | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15098046416` | 3 Lengua Street Tacos | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 20. Ranchera Plate (1)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:15042953277` | Ranchera Meat Plate | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 21. Shrimp Cocktails (1)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880683` | Armando's CÃ³ctel de CamarÃ³n | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |

### 22. Armando's Chicken Salad (1)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358348813` | Chicken Salad | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 23. Kids' Meals (4)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564136938` | Kids' #4 Cheese Quesadilla with Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880684` | Kids' #1 Five Chicken Nuggets with Fries | ? | Add extras (optional; savory food only) | Add extras; Guac $1.50, sour cream $0.75, cheese $1.00 | No explicit required customization; retain the item as advertised and allow a no-selection default. Add extras only when compatible and not already included. Confidence: **medium**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880685` | Kids' #2 Cheese Quesadilla with Rice and Beans | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880686` | Kids' #3 Bean and Cheese Burrito with Fries | ? | ? | No paid add-on for an ingredient already included | Base item copy already includes common extras; retain them in the advertised price. Confidence: **high**. |

### 24. Fresh Salsas (4)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8476865874` | Dark Green Salsa â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8476852934` | Green Salsa â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8474915738` | Red Salsa â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8474695564` | Spicy Orange Salsa â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |

### 25. Aguas Frescas (12)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358345202` | Cucumber Agua Fresca â€“ 16 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358343248` | Cucumber Agua Fresca â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880620` | Horchata â€“ 16 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358342473` | Horchata â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880621` | Jamaica â€“ 16 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8876267704` | Jamaica â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `AMBIGUOUS` | `doordash:358349641` | Jarritos | Flavor (only if staging flavor options can be sourced) | ? | No current flavor group/options | Copy says flavor selection may vary but does not enumerate available flavors; keep listed Jarritos as default or obtain option list. Confidence: **low**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:358349187` | Mexican Coke â€“ 500 mL | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:8877008484` | Mexican Sprite â€“ 500 mL | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:198880625` | PiÃ±a â€“ 16 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:564135101` | PiÃ±a â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:3871269059` | Watermelon Agua Fresca â€“ 32 oz | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |

### 26. Bottled Drinks & Sodas (11)

| Classification | Item ID | Item name | Proposed required group(s) | Proposed optional group(s) | Reuse / pricing | Reasoning; confidence |
|---|---|---|---|---|---|---|
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783650579` | Diet Coke | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783354747` | Glass Fanta Orange | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9984296304` | Mexican Coke - 1L Glass | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784016685` | Sprite - 1L Glass | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784110276` | Topo Chico Mineral Water - 355ml Glass | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:9976528504` | Monster Energy - 16oz Can | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783354751` | Orange Fanta | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784072256` | Plastic Coke | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22783746824` | Powerade Blue | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784016710` | Red Powerade | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |
| `NEEDS_OPTIONAL_ADDONS` | `doordash:22784172078` | Sprite | ? | ? | No food add-ons proposed | No required choices; no generic extras proposed for this type. Preserve listed item as its default. Confidence: **high**. |

## Later-pass actions

1. Re-read live staging rows before applying anything; compare the fixture item IDs and placements, then use live UUIDs for writes.
2. Replace test-only prices and options with demo-approved values; retain one valid default for every attached required group.
3. Add only explicitly supported choices. Include Al Pastor only on entries whose descriptions list it. Decide how 20-taco party-pack meat mixes should work before requiring a choice.
4. Add a `Tortillas or Chips` group only for rows listed above; its option prices should be $0 unless the source proves an upcharge.
5. Mark the remaining 307 published rows orderable only after checking each default path and each required group has active options.


