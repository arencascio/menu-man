# Armando's menu orderability plan

**Status:** implementation-ready planning artifact; no database, fixture, migration, or application changes.
**Source:** `data/armandos.json`, current staging test modifier seed, and prior audit.
**Identity:** stable source item ID `doordash:<sourceItemId>`; live staging UUIDs were unavailable. Item names are repaired only for obvious encoding corruption.

## Summary

| Classification | Items |
|---|---:|
| ENABLE_ONLY | 295 |
| REQUIRED_CHOICE | 12 |
| OPTIONAL_EXTRAS | 0 |
| REQUIRED_AND_EXTRAS | 0 |
| HOLD_FOR_REVIEW | 2 |
| **Total** | **309** |

Projected orderable after the safe plan: **307**. Projected unresolved: **2**. Counts reconcile to 309 items.

Jarritos is ENABLE_ONLY: its listing is generic, and the note that flavor may vary does not advertise a customer choice or provide a flavor list. Preserve the generic item as listed; do not create an unsupported flavor group. The two 20-taco packs remain on hold because any-combination meat selection needs quantity/mix handling that current groups do not represent.

## Restaurant scope

Every modifier group, option, item attachment, pricing override, and option activation override in this plan is Armando's restaurant-owned configuration, stored with Armando's `restaurant_id`. Reuse means reuse across Armando's menu items only. `Tortillas or Chips` is one group owned by Armando's and may attach to several Armando's items; it is not a platform-global or cross-tenant modifier.

The platform provides only the generic modifier machinery: groups and options, required/optional rules, min/max selections, pricing adjustments, per-item option activation/overrides, and item/group relationships. Modifier names, option names, prices, and assignments are restaurant configuration.

## Modifier group plan

| Group | Instruction |
|---|---|
| `Choose your meat` | Reuse the existing staging group for clear single-choice meat products. Current options are Carne Asada, Chicken, and Carnitas at $0. Add Al Pastor at $0 only for Tostadas and Sopes, where explicitly listed. Use item-level inactive overrides to hide Al Pastor on Torta and Extra Meat; Extra Meat only permits Carne Asada or Chicken. |
| `Tortillas or Chips` | Create one reusable required single-select group with Tortillas and Chips at $0. Attach only where the description expressly offers that choice. |
| `Add extras` | No items assigned. The existing demo group is not needed for orderability; do not attach by default. |

No new optional groups are proposed. The plan uses one existing reusable group (`Choose your meat`) and creates one required group (`Tortillas or Chips`).

## Breakfast Plates (4)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:24580195805` | Ham Plate with Eggs, Cheese, and Potatoes | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:43896844525` | Huevos a la Mexicana | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:24579759048` | Original Plate - Bacon, Egg, Cheese, and Potatoes with Rice & Beans | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:24580228943` | Steak and Eggs Plate with Cheese and Potatoes | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |

## Breakfast Burritos (18)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:5333328467` | Bacon and Sausage Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1165791286` | Chicken Breakfast Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880674` | Chorizo Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5772874081` | Chorizo Burrito with Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1165788874` | Chorizo Burrito with Potato | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5333326965` | Egg and Cheese Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5334803698` | Ham and Bacon Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880676` | Ham Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5772977560` | Ham, Egg, and Cheese Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880675` | Machaca Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880673` | Original Breakfast Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1165790039` | Original Breakfast Burrito with Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880679` | Sausage Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5766331847` | Sausage Burrito with Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8476042131` | Sausage, Chorizo, Egg, Cheese, and Potatoes Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:16994295879` | Steak Breakfast Burrito with Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880678` | Steak Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:418346709` | Super Breakfast Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Burritos (33)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880628` | Adobada Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:11825834217` | Asada Burrito Combo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759912295` | Asada Burrito with Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:2989351384` | Asada Burrito with Cheese and Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759912198` | Asada Burrito with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759911357` | Asada Wet Burrito with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:425682195` | Asada Wet Burrito with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880664` | Beans and Cheese Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:3343947796` | Birria Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880663` | Cabeza Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880632` | California Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880626` | Carne Asada Burrito with guacamole and pico | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1169949037` | Carne Asada Burrito with Rice and Beans Only | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:16994292882` | Carne Asada Burrito with Cheese, Sour Cream, and Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:23721922361` | Carne Asada Burrito with Guacamole, Pico, Cheese, Sour Cream, Rice, and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880629` | Carnitas Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:16994291329` | Chicken Burrito with Beans and Rice | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1145493274` | Chicken California Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880671` | Chicken Chipotle | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880666` | Chile Relleno Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880670` | Chile Verde Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880659` | Del Mar Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22783650552` | Diabla Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880635` | Fish Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880667` | Ground Beef Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880672` | Mixed Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880627` | Pollo Asado Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880662` | Shredded Beef Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880656` | Shrimp Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:2843786809` | Supreme Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:17056986042` | Surf and Turf Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880668` | Veggie Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880681` | Surf and Turf Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Wet Burritos (9)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:24579992217` | Adobada Wet Burrito with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:30381328433` | Cabeza Wet Burrito with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:24580195808` | California Wet Burrito / Red Sauce / Guacamole / Pico / Cheese / Sour Cream / Fries / Only | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9871951347` | Carne Asada Wet Burrito with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9872697488` | Carne Asada Wet Burrito with Red and Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9872697486` | Carne Asada Wet Burrito Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9871525714` | Carnitas Wet Burrito with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:30381107207` | Lengua Wet Burrito with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:30381246062` | Lengua Wet Burrito with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Street Tacos (11)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:44177153503` | 5 Carnitas Street Tacos Special | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:769016784` | 10 Hard Shell Potato Tacos with Lettuce and Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880534` | Adobada Mini Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880535` | Cabeza Mini Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880530` | Carne Asada Mini Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880532` | Carnitas Mini Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880536` | Ceviche Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880533` | Pollo Asado Mini Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7995395228` | 5 Carne Asada Street Tacos Special | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:359794279` | Special Packet #1 - 20 Mini Tacos | `HOLD_FOR_REVIEW` | - | - | None | high | Any combination across 20 tacos needs quantity-aware meat selection or an explicit single-meat default. Do not invent a mix. |
| `doordash:359796582` | Special Packet #2 - 20 Mini Tacos with Rice and Beans | `HOLD_FOR_REVIEW` | - | - | None | high | Any combination across 20 tacos needs quantity-aware meat selection or an explicit single-meat default. Do not invent a mix. |

## Tacos (23)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:11651480977` | 3 Fish Tacos Special | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:17056986048` | 3 Quesabirria Tacos with Consome (8oz) | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880593` | Adobada Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880594` | Beef Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8139021260` | Birria Taco Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880597` | Cabeza Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880589` | Carne Asada Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880609` | Carne Asada Taco Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880592` | Carnitas Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8139021259` | Carnitas Taco Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564140620` | Chicken Taco Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564140375` | Del Mar Taco Salad Shrimp and Crab Meat | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880595` | Fish Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880603` | Ground Beef Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880590` | Pollo Asado Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880605` | Potato Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7176579097` | Quesabirria Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:359798143` | Shredded Chicken Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880596` | Shrimp Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:28128242562` | Shrimp Taco Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7172256177` | Birria Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880604` | Del Mar Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880682` | Shredded Chicken Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Tortas (10)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880582` | Adobada Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880580` | Asada Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880586` | Beef Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:3736422304` | Birria Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880583` | Carnitas Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880584` | Chorizo Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880588` | Ham Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880585` | Machaca Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880581` | Pollo Asado Torta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:445069647` | Torta with Fries | `REQUIRED_CHOICE` | Choose your meat (exactly 1) | - | Reuse Choose your meat; listed base choices are $0. | medium | Copy requires a meat choice but does not enumerate options; reuse current canonical options Carne Asada, Chicken, and Carnitas, all $0. |

## Sopes (8)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880540` | Adobada Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880537` | Asada Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880541` | Beef Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6416075485` | Birria Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564138398` | Cabeza Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880542` | Carnitas Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880539` | Pollo Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564138455` | Veggie Sope | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Tostadas (7)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880574` | Bean Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880573` | Beef Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880570` | Carne Asada Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:3827669440` | Carnitas Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880572` | Chicken Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22783650559` | Lengua Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6929631873` | Al Pastor Tostada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Enchiladas (7)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:6912777372` | Asada Enchiladas with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6921460910` | Asada Enchiladas with Red Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880576` | Beef Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880575` | Cheese Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880579` | Chicken Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6918221785` | Grilled Chicken Enchiladas with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880577` | Mixed Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Rolled Tacos (9)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880567` | 3 Beef Rolled Tacos with Guacamole and Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880565` | 3 Beef Rolled Tacos with Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5763647597` | 3 Chicken Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5765605340` | 5 Chicken Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8570286826` | 5 Chicken Rolled Tacos with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880568` | 5 Beef Rolled Tacos Special | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8570235923` | 5 Beef Rolled Tacos with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5763651453` | 6 Chicken Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880569` | 12 Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Fried Chimichangas (6)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880546` | Adobada Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880548` | Beef Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880543` | Carne Asada Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880545` | Carnitas Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6912933537` | Chile Verde Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880547` | Grilled Chicken Chimichanga | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Side Orders (21)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880550` | 8 oz Refried Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880549` | 8 oz Rice | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:2439306342` | 8 oz Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:4953288296` | 4 oz Bacon | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880560` | Extra Meat – Carne Asada or Chicken | `REQUIRED_CHOICE` | Choose your meat (exactly 1) | - | Reuse Choose your meat; listed base choices are $0. | medium | Extra Meat explicitly lists Carne Asada or Chicken. Hide Al Pastor with an item-level inactive override; keep the two choices at $0 and the item price as the extra-meat charge. |
| `doordash:4953282371` | Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:4953282370` | 8 oz Lettuce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564140883` | One Flour Tortilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:4952014099` | Pico de Gallo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564138294` | Pint of Beans 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564138272` | Pint of Rice 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:4952705422` | 4 oz Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1165798551` | 3 Chiles Toreados | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22785216698` | 4 oz Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784110428` | 4 oz Pico de Gallo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784662544` | 4 oz Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784110426` | 8 oz Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784339672` | 8 oz Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22785216696` | 8 oz Rice | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22919286579` | Carrots and Jalapeños | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22785575681` | Chiles Toreados Serranos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Carne Asada Fries, Nachos, Quesadillas & Sides (42)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:421785797` | Adobada Chips | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:10770317768` | Adobada Fries with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880554` | Adobada Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:10608873268` | Birria Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:10609047987` | Birria Nachos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9813230337` | Cabeza Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880523` | Carne Asada Chips | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880524` | Carne Asada Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8570438359` | Carne Asada Fries with Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8286200667` | Carne Asada Fries with Beans and Sour Cream – No Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:10891185528` | Carne Asada Fries with Picó de Gallo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759912715` | Carne Asada Fries with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8286730317` | Carne Asada Fries with Sour Cream – No Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8287922962` | Carne Asada Fries with Sour Cream, Rice, and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5995006478` | Carne Asada Nachos with Beans, Onion, and Cilantro | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1169941272` | Carne Asada Nachos with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880556` | Carne Asada Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5336575300` | Carnitas Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880551` | Cheese Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880553` | Chicken Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6917687049` | Chile Verde Nachos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880559` | Chips and Guacamole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:32960992457` | Chips and Guacamole No Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880561` | Chips and Salsa | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880557` | French Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880562` | Half-Order Carne Asada Chips | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880563` | Half-Order Carne Asada Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759912532` | Half-Order Carne Asada Fries with Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:2222103720` | Large Chicken Nachos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5347103892` | Large Ground Beef Fries with Rice, Cheese, and Sour Cream | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:27634029237` | Large Veggie Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5613241909` | Quesabirria | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:44177153501` | Shredded Beef Nachos Bell Peppers Onion | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880552` | Shrimp Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358347767` | Small Surf and Turf Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:27631629582` | Small Veggie Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:759911924` | Super Nachos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5337571594` | Super Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358347340` | Surf and Turf Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:3871320158` | Surf and Turf Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:4921379008` | Trio Fries with Shrimp, Chicken, and Carne Asada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9830707325` | Two Chiles Rellenos A la Carte | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Combination Plates (40)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:5337696094` | #23. Two Shredded Chicken Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880491` | #1. Tostada and Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880495` | #2. Two Beef Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880497` | #3. Two Cheese Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880499` | #4. Bean Tostada and Cheese Enchilada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880500` | #5. Beef Taco and Cheese Enchilada | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880503` | #6. Cheese Enchilada and Beef Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880504` | #7. Two Beef Burritos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880505` | #8. Two Tostadas – Choice of Meat | `REQUIRED_CHOICE` | Choose your meat (exactly 1) | - | Reuse Choose your meat; listed base choices are $0. | high | Description lists Carne Asada, Chicken, Carnitas, and Al Pastor; existing group has only the first three. Add Al Pastor at $0 for this item. |
| `doordash:198880507` | #9. Two Pollo Asado Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880508` | #10. Two Chicken Enchiladas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880509` | #11. Beef Taco and Beef Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880510` | #12. Carne Asada Plate | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:198880511` | #13. Machaca Plate | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880512` | #14. Chorizo Plate | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880513` | #15. Carnitas Plate | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:198880514` | #16. Two Carne Asada Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880515` | #17. Two Chiles Rellenos Plate | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880518` | #18. Two Fish Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880519` | #19. Pollo Asado Plate | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:198880520` | #20. Three Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7949242446` | Adobada Plate with Rice and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:376154181` | Birria Combo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:376154282` | Birria Bowl | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7995077785` | Cabeza Plate with Rice and Beans | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:198880521` | Camarones a la Diabla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6912796879` | Two Chicken Enchiladas with Green Sauce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:10770381235` | Chile Relleno and Cheese Enchilada Combo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:7949201301` | Chile Verde Plate with Rice and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880522` | Enchiladas del Mar | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880526` | Flying Saucer | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:14833449100` | Ranchera Plate | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5765626765` | Two Chicken Enchiladas with Rice and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8880117979` | Two-Enchilada Combo – Chicken and Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5732068679` | Two Birria Tacos with Rice, Beans, and Consommé | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6416059090` | Two Birria Sopes Combo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1206365534` | Two Sopes Combo – Choice of Meat | `REQUIRED_CHOICE` | Choose your meat (exactly 1) | - | Reuse Choose your meat; listed base choices are $0. | high | Description lists Carne Asada, Chicken, Carnitas, and Al Pastor; existing group has only the first three. Add Al Pastor at $0 for this item. |
| `doordash:198880695` | #21. Super Rolled Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880697` | #23. Two Shredded Chicken Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880699` | #24. Chicken Fajita Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Soups & Menudo (5)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:6875773854` | Caldo de Res | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:359793528` | Caldo de Camarón | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:24580277827` | Caldo de Pescado (Fish Soup) | `REQUIRED_CHOICE` | Tortillas or Chips (exactly 1) | - | Create reusable group; both options $0. | high | Description expressly offers tortillas or chips; preserve the listed item price. |
| `doordash:17110451876` | Menudo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:44255519656` | Red Pozole | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Three-Taco Specials (6)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880564` | 3 Carne Asada Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564141127` | 3 Cabeza Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:1115187588` | 3 Carnitas Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564141004` | 3 Al Pastor Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564141338` | 3 Pollo Asado Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:5336746597` | 3 Birria Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Fajitas (4)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880528` | Chicken Fajitas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880527` | Shrimp Fajitas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880529` | Steak Fajitas | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:6918405632` | Trio Fajitas – Shrimp, Chicken, and Steak | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Lengua (12)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:15070153181` | Lengua Combo | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070184232` | Lengua Burrito | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070309400` | Lengua Fries with Beans, Cheese, Rice, Onion, and Cilantro | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15069923427` | Lengua Fries with Guacamole and Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15069308837` | Lengua Nachos with Beans, Rice, Cheese, Onion, and Cilantro | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070184233` | Lengua Nachos with Guacamole and Cheese | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:30286215939` | Lengua Quesadilla | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070184231` | Lengua Street Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070737811` | Lengua Taco | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070184234` | Lengua Torta with Guacamole, Picó de Gallo, and Lettuce | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15070738058` | Lengua Torta with Rice and Beans – C/C Only | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:15098046416` | 3 Lengua Street Tacos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Ranchera Plate (1)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:15042953277` | Ranchera Meat Plate | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Shrimp Cocktails (1)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:198880683` | Armando's Cóctel de Camarón | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Armando's Chicken Salad (1)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:358348813` | Chicken Salad | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Kids' Meals (4)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:564136938` | Kids' #4 Cheese Quesadilla with Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880684` | Kids' #1 Five Chicken Nuggets with Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880685` | Kids' #2 Cheese Quesadilla with Rice and Beans | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880686` | Kids' #3 Bean and Cheese Burrito with Fries | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Fresh Salsas (4)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:8476865874` | Dark Green Salsa – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8476852934` | Green Salsa – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8474915738` | Red Salsa – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8474695564` | Spicy Orange Salsa – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Aguas Frescas (12)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:358345202` | Cucumber Agua Fresca – 16 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358343248` | Cucumber Agua Fresca – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880620` | Horchata – 16 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358342473` | Horchata – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880621` | Jamaica – 16 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8876267704` | Jamaica – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358349641` | Jarritos | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:358349187` | Mexican Coke – 500 mL | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:8877008484` | Mexican Sprite – 500 mL | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:198880625` | Piña – 16 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:564135101` | Piña – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:3871269059` | Watermelon Agua Fresca – 32 oz | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Bottled Drinks & Sodas (11)

| Source item ID | Item name | Classification | Required modifier group(s) | Optional modifier group(s) | Reuse/create instruction | Confidence | Implementation note |
|---|---|---|---|---|---|---|---|
| `doordash:22783650579` | Diet Coke | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22783354747` | Glass Fanta Orange | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9984296304` | Mexican Coke - 1L Glass | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784016685` | Sprite - 1L Glass | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784110276` | Topo Chico Mineral Water - 355ml Glass | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:9976528504` | Monster Energy - 16oz Can | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22783354751` | Orange Fanta | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784072256` | Plastic Coke | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22783746824` | Powerade Blue | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784016710` | Red Powerade | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |
| `doordash:22784172078` | Sprite | `ENABLE_ONLY` | - | - | None | high | Complete as listed; retain a no-modifier default. |

## Rollout notes

- `ENABLE_ONLY`: enable later with no modifier groups; the listed item is a complete default.
- `REQUIRED_CHOICE`: attach a group with active options to preserve a valid configuration. Advertised base-item choices are $0.
- `HOLD_FOR_REVIEW`: do not enable until a practical 20-piece meat mix or explicitly approved single-meat default is defined.
- Re-read live staging UUIDs and attachments before any future data change.
