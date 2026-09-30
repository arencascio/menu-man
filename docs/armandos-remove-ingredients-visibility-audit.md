# Armando's Remove Ingredients Effective Visibility Audit

Read-only snapshot of Armando's staging data queried from Supabase on 2026-09-30. No staging writes were performed. Grain: one active attachment to the restaurant-scoped Remove ingredients group.

## Finding

The reported Cabeza Taco leakage could not be reproduced from live staging rows plus the checked-in menu loader. The group has 14 active, zero-price, non-default options. There are 192 active item attachments and 2,688 item-option override rows (14 per item). Cabeza Taco (source ID 198880597, Tacos) has 14 overrides; exactly No Onion and No Cilantro are active. Those are the only removal options that the checked-in loader supplies to its modal.

A batch-1 control, Bacon and Sausage Burrito (source ID 5333328467), likewise has exactly the planned No Cheese and No Homestyle Potatoes options effective. Across all 192 attached items, live effective options exactly match the corresponding batch manifest: zero unexpected options, zero expected options missing, and complete overrides.

This conflicts with the manual browser observation. The likely remaining cause is a deployed/cached frontend using a loader version that omits or ignores item overrides, or a UI view populated from a different or stale data path. The repository data and loader evidence does not identify which browser deployment produced the observed modal. Verify the deployed menu payload for source ID 198880597 before changing tenant data.

## Effective-option path

- modifier_groups defines restaurant ownership and group active state.
- modifier_options defines the globally available restaurant-owned choices. All 14 current Remove ingredients options are active, zero-price, and non-default.
- menu_item_modifier_groups attaches the group to an item. The group and attachment must both be active.
- menu_item_modifier_option_overrides controls per-item availability. An active override exposes that option; an inactive override hides it. With no override, the loader defaults to active availability.
- src/app/r/[slug]/restaurant-menu-data.ts fetches all four tables, keys overrides by item and option, applies isMenuModifierOptionAvailable, and returns only effective options. OrderItemPanel renders the returned array.

## Live batch and section counts

| Batch | Section | Active attached items | Unexpected visible options | Expected options missing |
|---:|---|---:|---:|---:|
| 1 | Burritos | 33 | 0 | 0 |
| 1 | Breakfast Burritos | 18 | 0 | 0 |
| 1 | Wet Burritos | 9 | 0 | 0 |
| 2 | Tortas | 10 | 0 | 0 |
| 2 | Sopes | 8 | 0 | 0 |
| 2 | Street Tacos | 9 | 0 | 0 |
| 2 | Tacos | 22 | 0 | 0 |
| 2 | Tostadas | 7 | 0 | 0 |
| 3 | Carne Asada Fries, Nachos, Quesadillas & Sides | 37 | 0 | 0 |
| 4 | Combination Plates | 39 | 0 | 0 |

Totals of active removal attachments: batch 1, 60; batch 2, 56; batch 3, 37; batch 4, 39. Seed manifests contain 60, 57, 42, and 40 rows respectively. Batch 2's section count is 59 because it also includes the two held party packs outside its 57-row plan. Items with no removal list intentionally have no removal-group attachment.

## Item audit

Included/inferred ingredients are the per-item removal IDs declared by the batch plan and checked against source copy by the SQL contracts. Effective options are calculated from live global option, attachment, and override rows with the application availability rule.

| Batch | Source item ID | Item | Section | Included/inferred (removal choices) | Effective visible choices | Unexpected | Missing |
|---:|---|---|---|---|---|---|---|
| 1 | 759912295 | Asada Burrito with Cheese | Burritos | No Guacamole, No Pico de Gallo, No Cheese | No Cheese, No Pico de Gallo, No Guacamole | - | - |
| 1 | 5333328467 | Bacon and Sausage Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 1165791286 | Chicken Breakfast Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 198880674 | Chorizo Burrito | Breakfast Burritos | No Cheese | No Cheese | - | - |
| 1 | 5772874081 | Chorizo Burrito with Beans | Breakfast Burritos | No Cheese, No Beans | No Cheese, No Beans | - | - |
| 1 | 1165788874 | Chorizo Burrito with Potato | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 5333326965 | Egg and Cheese Burrito | Breakfast Burritos | No Cheese | No Cheese | - | - |
| 1 | 5334803698 | Ham and Bacon Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 198880676 | Ham Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 5772977560 | Ham, Egg, and Cheese Burrito | Breakfast Burritos | No Cheese | No Cheese | - | - |
| 1 | 198880675 | Machaca Burrito | Breakfast Burritos | No Cheese, No Onion, No Bell Peppers | No Cheese, No Bell Peppers, No Onion | - | - |
| 1 | 198880673 | Original Breakfast Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 1165790039 | Original Breakfast Burrito with Beans | Breakfast Burritos | No Cheese, No Beans, No Homestyle Potatoes | No Cheese, No Beans, No Homestyle Potatoes | - | - |
| 1 | 198880679 | Sausage Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 5766331847 | Sausage Burrito with Beans | Breakfast Burritos | No Cheese, No Beans, No Homestyle Potatoes | No Cheese, No Beans, No Homestyle Potatoes | - | - |
| 1 | 8476042131 | Sausage, Chorizo, Egg, Cheese, and Potatoes Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 16994295879 | Steak Breakfast Burrito with Beans | Breakfast Burritos | No Cheese, No Beans | No Cheese, No Beans | - | - |
| 1 | 198880678 | Steak Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 418346709 | Super Breakfast Burrito | Breakfast Burritos | No Cheese, No Homestyle Potatoes | No Cheese, No Homestyle Potatoes | - | - |
| 1 | 198880628 | Adobada Burrito | Burritos | No Guacamole, No Pico de Gallo | No Pico de Gallo, No Guacamole | - | - |
| 1 | 11825834217 | Asada Burrito Combo | Burritos | No Guacamole, No Pico de Gallo, No Beans, No Rice | No Rice, No Beans, No Pico de Gallo, No Guacamole | - | - |
| 1 | 2989351384 | Asada Burrito with Cheese and Sour Cream | Burritos | No Cheese, No Sour Cream | No Sour Cream, No Cheese | - | - |
| 1 | 759912198 | Asada Burrito with Sour Cream | Burritos | No Guacamole, No Pico de Gallo, No Sour Cream | No Sour Cream, No Pico de Gallo, No Guacamole | - | - |
| 1 | 759911357 | Asada Wet Burrito with Green Sauce | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 425682195 | Asada Wet Burrito with Red Sauce | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 198880664 | Beans and Cheese Burrito | Burritos | No Cheese | No Cheese | - | - |
| 1 | 3343947796 | Birria Burrito | Burritos | No Beans, No Rice, No Onion, No Cilantro | No Rice, No Beans, No Cilantro, No Onion | - | - |
| 1 | 198880663 | Cabeza Burrito | Burritos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 1 | 198880632 | California Burrito | Burritos | No Guacamole, No Pico de Gallo, No Cheese, No Sour Cream, No Fries | No Sour Cream, No Cheese, No Pico de Gallo, No Fries, No Guacamole | - | - |
| 1 | 198880626 | Carne Asada Burrito with guacamole and pico | Burritos | No Guacamole, No Pico de Gallo | No Pico de Gallo, No Guacamole | - | - |
| 1 | 1169949037 | Carne Asada Burrito with Rice and Beans Only | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 16994292882 | Carne Asada Burrito with Cheese, Sour Cream, and Fries | Burritos | No Cheese, No Sour Cream, No Fries | No Sour Cream, No Cheese, No Fries | - | - |
| 1 | 23721922361 | Carne Asada Burrito with Guacamole, Pico, Cheese, Sour Cream, Rice, and Beans | Burritos | No Guacamole, No Pico de Gallo, No Cheese, No Sour Cream, No Beans, No Rice | No Rice, No Sour Cream, No Cheese, No Beans, No Pico de Gallo, No Guacamole | - | - |
| 1 | 198880629 | Carnitas Burrito | Burritos | No Guacamole, No Pico de Gallo | No Pico de Gallo, No Guacamole | - | - |
| 1 | 16994291329 | Chicken Burrito with Beans and Rice | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 1145493274 | Chicken California Burrito | Burritos | No Guacamole, No Pico de Gallo, No Cheese, No Sour Cream, No Fries | No Sour Cream, No Cheese, No Pico de Gallo, No Fries, No Guacamole | - | - |
| 1 | 198880671 | Chicken Chipotle | Burritos | No Cheese, No Lettuce, No Avocado | No Cheese, No Lettuce, No Avocado | - | - |
| 1 | 198880666 | Chile Relleno Burrito | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 198880670 | Chile Verde Burrito | Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 198880659 | Del Mar Burrito | Burritos | No Sour Cream, No Rice, No Cabbage | No Cabbage, No Rice, No Sour Cream | - | - |
| 1 | 22783650552 | Diabla Burrito | Burritos | No Pico de Gallo, No Rice, No Avocado | No Rice, No Pico de Gallo, No Avocado | - | - |
| 1 | 198880635 | Fish Burrito | Burritos | No Pico de Gallo, No Sour Cream, No Cabbage | No Cabbage, No Sour Cream, No Pico de Gallo | - | - |
| 1 | 198880667 | Ground Beef Burrito | Burritos | No Cheese, No Sour Cream, No Lettuce | No Sour Cream, No Cheese, No Lettuce | - | - |
| 1 | 198880672 | Mixed Burrito | Burritos | No Beans, No Onion, No Bell Peppers | No Beans, No Bell Peppers, No Onion | - | - |
| 1 | 198880627 | Pollo Asado Burrito | Burritos | No Guacamole, No Pico de Gallo | No Pico de Gallo, No Guacamole | - | - |
| 1 | 198880662 | Shredded Beef Burrito | Burritos | No Onion, No Bell Peppers | No Bell Peppers, No Onion | - | - |
| 1 | 198880656 | Shrimp Burrito | Burritos | No Pico de Gallo, No Sour Cream, No Rice, No Cabbage | No Cabbage, No Rice, No Sour Cream, No Pico de Gallo | - | - |
| 1 | 2843786809 | Supreme Burrito | Burritos | No Sour Cream, No Beans, No Rice, No Onion, No Cilantro | No Rice, No Sour Cream, No Beans, No Cilantro, No Onion | - | - |
| 1 | 17056986042 | Surf and Turf Burrito | Burritos | No Rice | No Rice | - | - |
| 1 | 198880668 | Veggie Burrito | Burritos | No Rice | No Rice | - | - |
| 1 | 198880681 | Surf and Turf Burrito | Burritos | No Cheese, No Sour Cream, No Rice, No Avocado | No Rice, No Sour Cream, No Cheese, No Avocado | - | - |
| 1 | 24579992217 | Adobada Wet Burrito with Red Sauce | Wet Burritos | No Guacamole, No Pico de Gallo, No Beans, No Rice | No Rice, No Beans, No Pico de Gallo, No Guacamole | - | - |
| 1 | 30381328433 | Cabeza Wet Burrito with Red Sauce | Wet Burritos | No Beans, No Rice, No Onion, No Cilantro | No Rice, No Beans, No Cilantro, No Onion | - | - |
| 1 | 24580195808 | California Wet Burrito / Red Sauce / Guacamole / Pico / Cheese / Sour Cream / Fries / Only | Wet Burritos | No Guacamole, No Pico de Gallo, No Cheese, No Sour Cream, No Beans, No Rice, No Fries | No Rice, No Sour Cream, No Cheese, No Beans, No Pico de Gallo, No Fries, No Guacamole | - | - |
| 1 | 9871951347 | Carne Asada Wet Burrito with Green Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 9872697488 | Carne Asada Wet Burrito with Red and Green Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 9872697486 | Carne Asada Wet Burrito Red Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 9871525714 | Carnitas Wet Burrito with Red Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 30381107207 | Lengua Wet Burrito with Green Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 1 | 30381246062 | Lengua Wet Burrito with Red Sauce | Wet Burritos | No Beans, No Rice | No Rice, No Beans | - | - |
| 2 | 198880586 | Beef Torta | Tortas | No Guacamole, No Onion, No Bell Peppers, No Lettuce | No Lettuce, No Bell Peppers, No Guacamole, No Onion | - | - |
| 2 | 564138455 | Veggie Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 44177153503 | 5 Carnitas Street Tacos Special | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 769016784 | 10 Hard Shell Potato Tacos with Lettuce and Cheese | Street Tacos | No Lettuce, No Cheese | No Cheese, No Lettuce | - | - |
| 2 | 198880534 | Adobada Mini Taco | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880535 | Cabeza Mini Taco | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880530 | Carne Asada Mini Taco | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880532 | Carnitas Mini Taco | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880536 | Ceviche Tostada | Street Tacos | No Onion, No Cilantro, No Avocado | No Avocado, No Cilantro, No Onion | - | - |
| 2 | 198880533 | Pollo Asado Mini Taco | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 7995395228 | 5 Carne Asada Street Tacos Special | Street Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 11651480977 | 3 Fish Tacos Special | Tacos | No Cabbage | No Cabbage | - | - |
| 2 | 17056986048 | 3 Quesabirria Tacos with Consome (8oz) | Tacos | No Cheese, No Onion, No Cilantro | No Cheese, No Cilantro, No Onion | - | - |
| 2 | 198880593 | Adobada Taco | Tacos | No Guacamole, No Onion, No Cilantro | No Guacamole, No Cilantro, No Onion | - | - |
| 2 | 198880594 | Beef Taco | Tacos | No Lettuce, No Cheese | No Cheese, No Lettuce | - | - |
| 2 | 8139021260 | Birria Taco Salad | Tacos | No Rice, No Sour Cream, No Avocado, No Cheese, No Lettuce, No Pico de Gallo | No Rice, No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Avocado | - | - |
| 2 | 198880597 | Cabeza Taco | Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880589 | Carne Asada Taco | Tacos | No Guacamole, No Pico de Gallo, No Onion, No Cilantro | No Pico de Gallo, No Guacamole, No Cilantro, No Onion | - | - |
| 2 | 198880609 | Carne Asada Taco Salad | Tacos | No Avocado, No Sour Cream, No Cheese, No Pico de Gallo, No Rice, No Lettuce | No Rice, No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Avocado | - | - |
| 2 | 198880592 | Carnitas Taco | Tacos | No Avocado, No Onion, No Cilantro | No Avocado, No Cilantro, No Onion | - | - |
| 2 | 8139021259 | Carnitas Taco Salad | Tacos | No Avocado, No Sour Cream, No Cheese, No Pico de Gallo, No Rice, No Lettuce | No Rice, No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Avocado | - | - |
| 2 | 564140620 | Chicken Taco Salad | Tacos | No Avocado, No Sour Cream, No Cheese, No Pico de Gallo, No Rice, No Lettuce | No Rice, No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Avocado | - | - |
| 2 | 564140375 | Del Mar Taco Salad Shrimp and Crab Meat | Tacos | No Sour Cream, No Cheese, No Rice, No Lettuce | No Rice, No Sour Cream, No Cheese, No Lettuce | - | - |
| 2 | 198880595 | Fish Taco | Tacos | No Cabbage, No Cilantro | No Cabbage, No Cilantro | - | - |
| 2 | 198880603 | Ground Beef Taco | Tacos | No Sour Cream, No Cheese, No Lettuce | No Sour Cream, No Cheese, No Lettuce | - | - |
| 2 | 198880590 | Pollo Asado Taco | Tacos | No Guacamole, No Onion, No Cilantro | No Guacamole, No Cilantro, No Onion | - | - |
| 2 | 7176579097 | Quesabirria Taco | Tacos | No Cheese, No Onion, No Cilantro | No Cheese, No Cilantro, No Onion | - | - |
| 2 | 359798143 | Shredded Chicken Taco | Tacos | No Cheese, No Lettuce | No Cheese, No Lettuce | - | - |
| 2 | 198880596 | Shrimp Taco | Tacos | No Cabbage, No Cilantro | No Cabbage, No Cilantro | - | - |
| 2 | 28128242562 | Shrimp Taco Salad | Tacos | No Cheese, No Pico de Gallo, No Avocado | No Cheese, No Pico de Gallo, No Avocado | - | - |
| 2 | 7172256177 | Birria Taco | Tacos | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 2 | 198880604 | Del Mar Taco | Tacos | No Rice, No Cabbage, No Pico de Gallo, No Sour Cream | No Cabbage, No Rice, No Sour Cream, No Pico de Gallo | - | - |
| 2 | 198880682 | Shredded Chicken Taco | Tacos | No Lettuce, No Cheese | No Cheese, No Lettuce | - | - |
| 2 | 198880582 | Adobada Torta | Tortas | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 2 | 198880580 | Asada Torta | Tortas | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 2 | 3736422304 | Birria Torta | Tortas | No Rice, No Beans, No Onion, No Cilantro | No Rice, No Beans, No Cilantro, No Onion | - | - |
| 2 | 198880583 | Carnitas Torta | Tortas | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 2 | 198880584 | Chorizo Torta | Tortas | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 2 | 198880588 | Ham Torta | Tortas | No Avocado, No Lettuce | No Lettuce, No Avocado | - | - |
| 2 | 198880585 | Machaca Torta | Tortas | No Guacamole, No Bell Peppers, No Onion, No Lettuce | No Lettuce, No Bell Peppers, No Guacamole, No Onion | - | - |
| 2 | 198880581 | Pollo Asado Torta | Tortas | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 2 | 445069647 | Torta with Fries | Tortas | No Fries | No Fries | - | - |
| 2 | 198880540 | Adobada Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880537 | Asada Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880541 | Beef Sope | Sopes | No Beans, No Lettuce, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Beans, No Lettuce | - | - |
| 2 | 6416075485 | Birria Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 564138398 | Cabeza Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880542 | Carnitas Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880539 | Pollo Sope | Sopes | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880574 | Bean Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880573 | Beef Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880570 | Carne Asada Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 3827669440 | Carnitas Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 198880572 | Chicken Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 22783650559 | Lengua Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 2 | 6929631873 | Al Pastor Tostada | Tostadas | No Beans, No Lettuce, No Cheese | No Cheese, No Beans, No Lettuce | - | - |
| 3 | 759911924 | Super Nachos | Carne Asada Fries, Nachos, Quesadillas & Sides | No Beans, No Guacamole, No Cheese, No Sour Cream, No Pico de Gallo | No Sour Cream, No Cheese, No Beans, No Pico de Gallo, No Guacamole | - | - |
| 3 | 421785797 | Adobada Chips | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 10770317768 | Adobada Fries with Sour Cream | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 198880554 | Adobada Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 10608873268 | Birria Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Beans, No Cheese, No Onion, No Cilantro | No Cheese, No Beans, No Cilantro, No Onion | - | - |
| 3 | 10609047987 | Birria Nachos | Carne Asada Fries, Nachos, Quesadillas & Sides | No Cheese, No Onion, No Cilantro | No Cheese, No Cilantro, No Onion | - | - |
| 3 | 9813230337 | Cabeza Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 198880523 | Carne Asada Chips | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 198880524 | Carne Asada Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 8570438359 | Carne Asada Fries with Beans | Carne Asada Fries, Nachos, Quesadillas & Sides | No Beans, No Guacamole, No Cheese | No Cheese, No Beans, No Guacamole | - | - |
| 3 | 8286200667 | Carne Asada Fries with Beans and Sour Cream – No Guacamole | Carne Asada Fries, Nachos, Quesadillas & Sides | No Beans, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Beans | - | - |
| 3 | 10891185528 | Carne Asada Fries with Picó de Gallo | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Pico de Gallo | No Cheese, No Pico de Gallo, No Guacamole | - | - |
| 3 | 759912715 | Carne Asada Fries with Sour Cream | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 8286730317 | Carne Asada Fries with Sour Cream – No Guacamole | Carne Asada Fries, Nachos, Quesadillas & Sides | No Cheese, No Sour Cream | No Sour Cream, No Cheese | - | - |
| 3 | 8287922962 | Carne Asada Fries with Sour Cream, Rice, and Beans | Carne Asada Fries, Nachos, Quesadillas & Sides | No Cheese, No Sour Cream, No Rice, No Beans | No Rice, No Sour Cream, No Cheese, No Beans | - | - |
| 3 | 5995006478 | Carne Asada Nachos with Beans, Onion, and Cilantro | Carne Asada Fries, Nachos, Quesadillas & Sides | No Beans, No Cheese, No Onion, No Cilantro | No Cheese, No Beans, No Cilantro, No Onion | - | - |
| 3 | 1169941272 | Carne Asada Nachos with Sour Cream | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 198880556 | Carne Asada Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 5336575300 | Carnitas Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 198880553 | Chicken Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Pico de Gallo, No Lettuce | No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 6917687049 | Chile Verde Nachos | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 198880562 | Half-Order Carne Asada Chips | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 198880563 | Half-Order Carne Asada Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 759912532 | Half-Order Carne Asada Fries with Sour Cream | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 2222103720 | Large Chicken Nachos | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese | No Cheese, No Guacamole | - | - |
| 3 | 5347103892 | Large Ground Beef Fries with Rice, Cheese, and Sour Cream | Carne Asada Fries, Nachos, Quesadillas & Sides | No Rice, No Cheese, No Sour Cream | No Rice, No Sour Cream, No Cheese | - | - |
| 3 | 27634029237 | Large Veggie Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream, No Pico de Gallo, No Lettuce | No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 5613241909 | Quesabirria | Carne Asada Fries, Nachos, Quesadillas & Sides | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 3 | 44177153501 | Shredded Beef Nachos Bell Peppers Onion | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Onion, No Bell Peppers | No Cheese, No Bell Peppers, No Guacamole, No Onion | - | - |
| 3 | 198880552 | Shrimp Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Cabbage, No Lettuce | No Cabbage, No Lettuce | - | - |
| 3 | 358347767 | Small Surf and Turf Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 27631629582 | Small Veggie Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream, No Pico de Gallo, No Lettuce | No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 5337571594 | Super Rolled Tacos | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream, No Pico de Gallo, No Lettuce | No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 3 | 358347340 | Surf and Turf Fries | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 3871320158 | Surf and Turf Quesadilla | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Sour Cream, No Pico de Gallo | No Sour Cream, No Pico de Gallo, No Guacamole | - | - |
| 3 | 4921379008 | Trio Fries with Shrimp, Chicken, and Carne Asada | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Cheese, No Sour Cream | No Sour Cream, No Cheese, No Guacamole | - | - |
| 3 | 9830707325 | Two Chiles Rellenos A la Carte | Carne Asada Fries, Nachos, Quesadillas & Sides | No Guacamole, No Sour Cream, No Pico de Gallo, No Lettuce | No Sour Cream, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 10770381235 | Chile Relleno and Cheese Enchilada Combo | Combination Plates | No Guacamole, No Sour Cream, No Lettuce, No Rice, No Beans | No Rice, No Sour Cream, No Beans, No Lettuce, No Guacamole | - | - |
| 4 | 1206365534 | Two Sopes Combo – Choice of Meat | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 14833449100 | Ranchera Plate | Combination Plates | No Avocado, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Avocado | - | - |
| 4 | 198880491 | #1. Tostada and Taco | Combination Plates | No Rice | No Rice | - | - |
| 4 | 198880495 | #2. Two Beef Tacos | Combination Plates | No Cheese, No Lettuce, No Rice, No Beans | No Rice, No Cheese, No Beans, No Lettuce | - | - |
| 4 | 198880497 | #3. Two Cheese Enchiladas | Combination Plates | No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce | - | - |
| 4 | 198880499 | #4. Bean Tostada and Cheese Enchilada | Combination Plates | No Lettuce, No Rice | No Rice, No Lettuce | - | - |
| 4 | 198880500 | #5. Beef Taco and Cheese Enchilada | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 198880503 | #6. Cheese Enchilada and Beef Burrito | Combination Plates | No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce | - | - |
| 4 | 198880504 | #7. Two Beef Burritos | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 198880505 | #8. Two Tostadas – Choice of Meat | Combination Plates | No Cheese, No Lettuce, No Rice | No Rice, No Cheese, No Lettuce | - | - |
| 4 | 198880507 | #9. Two Pollo Asado Tacos | Combination Plates | No Guacamole, No Onion, No Cilantro, No Rice, No Beans | No Rice, No Beans, No Guacamole, No Cilantro, No Onion | - | - |
| 4 | 198880508 | #10. Two Chicken Enchiladas | Combination Plates | No Cheese, No Lettuce, No Rice, No Beans | No Rice, No Cheese, No Beans, No Lettuce | - | - |
| 4 | 198880509 | #11. Beef Taco and Beef Burrito | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 198880510 | #12. Carne Asada Plate | Combination Plates | No Guacamole, No Pico de Gallo, No Rice, No Beans | No Rice, No Beans, No Pico de Gallo, No Guacamole | - | - |
| 4 | 198880511 | #13. Machaca Plate | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 198880512 | #14. Chorizo Plate | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 198880513 | #15. Carnitas Plate | Combination Plates | No Guacamole, No Pico de Gallo, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 198880514 | #16. Two Carne Asada Tacos | Combination Plates | No Guacamole, No Onion, No Cilantro, No Rice, No Beans | No Rice, No Beans, No Guacamole, No Cilantro, No Onion | - | - |
| 4 | 198880515 | #17. Two Chiles Rellenos Plate | Combination Plates | No Guacamole, No Sour Cream, No Pico de Gallo, No Lettuce, No Rice, No Beans | No Rice, No Sour Cream, No Beans, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 198880518 | #18. Two Fish Tacos | Combination Plates | No Cabbage, No Cilantro, No Rice, No Beans | No Cabbage, No Rice, No Beans, No Cilantro | - | - |
| 4 | 198880519 | #19. Pollo Asado Plate | Combination Plates | No Guacamole, No Pico de Gallo, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 198880520 | #20. Three Rolled Tacos | Combination Plates | No Guacamole, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Guacamole | - | - |
| 4 | 198880521 | Camarones a la Diabla | Combination Plates | No Avocado, No Rice, No Beans | No Rice, No Beans, No Avocado | - | - |
| 4 | 198880522 | Enchiladas del Mar | Combination Plates | No Pico de Gallo, No Sour Cream | No Sour Cream, No Pico de Gallo | - | - |
| 4 | 198880695 | #21. Super Rolled Tacos | Combination Plates | No Guacamole, No Cheese, No Sour Cream, No Pico de Gallo, No Lettuce | No Sour Cream, No Cheese, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 198880697 | #23. Two Shredded Chicken Tacos | Combination Plates | No Cheese, No Lettuce, No Rice, No Beans | No Rice, No Cheese, No Beans, No Lettuce | - | - |
| 4 | 198880699 | #24. Chicken Fajita Burrito | Combination Plates | No Rice, No Avocado, No Onion, No Bell Peppers | No Rice, No Bell Peppers, No Avocado, No Onion | - | - |
| 4 | 376154181 | Birria Combo | Combination Plates | No Onion, No Cilantro, No Rice, No Beans | No Rice, No Beans, No Cilantro, No Onion | - | - |
| 4 | 376154282 | Birria Bowl | Combination Plates | No Onion, No Cilantro | No Cilantro, No Onion | - | - |
| 4 | 5337696094 | #23. Two Shredded Chicken Tacos | Combination Plates | No Cheese, No Lettuce, No Rice, No Beans | No Rice, No Cheese, No Beans, No Lettuce | - | - |
| 4 | 5732068679 | Two Birria Tacos with Rice, Beans, and Consommé | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 5765626765 | Two Chicken Enchiladas with Rice and Beans | Combination Plates | No Cheese, No Rice, No Beans | No Rice, No Cheese, No Beans | - | - |
| 4 | 6416059090 | Two Birria Sopes Combo | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 6912796879 | Two Chicken Enchiladas with Green Sauce | Combination Plates | No Cheese, No Rice, No Beans | No Rice, No Cheese, No Beans | - | - |
| 4 | 7949201301 | Chile Verde Plate with Rice and Beans | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |
| 4 | 7949242446 | Adobada Plate with Rice and Beans | Combination Plates | No Guacamole, No Pico de Gallo, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 7995077785 | Cabeza Plate with Rice and Beans | Combination Plates | No Guacamole, No Pico de Gallo, No Lettuce, No Rice, No Beans | No Rice, No Beans, No Lettuce, No Pico de Gallo, No Guacamole | - | - |
| 4 | 8880117979 | Two-Enchilada Combo – Chicken and Cheese | Combination Plates | No Rice, No Beans | No Rice, No Beans | - | - |

## Why contracts passed and proposed correction

Contracts 015?018 compare coalesce(override.is_active, true) against each plan's option IDs, which is equivalent to the current loader's item-option availability rule. The current staging snapshot satisfies those checks, so an identical contract run now would pass. The contracts inspect database rows; they do not execute the deployed server loader, serialized menu payload, or rendered item modal. They therefore cannot catch a deployment that ignores otherwise correct overrides.

No tenant-data change is supported by this snapshot. Preserve the shared Armando Remove ingredients group and current overrides. First inspect the deployed menu payload for Cabeza Taco. If it contains all 14 choices, redeploy the code with the override-aware loader or apply the smallest shared loader correction if deployed code lacks it. Add an application-path regression test for the menu-data builder or route payload: Cabeza Taco must return exactly No Onion and No Cilantro, and a batch-1 burrito control must return exactly its manifest set. It will fail if the loader returns the full 14-option group. A SQL effective-visibility contract remains useful but does not replace this test.

No staging seed or application fix was applied.
