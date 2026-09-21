import "server-only";

import { isMenuModifierOptionAvailable, resolveModifierPriceCents } from "@/lib/cart/cart";
import type { MenuModifierGroup } from "@/lib/cart/types";
import { supabaseServer } from "@/lib/supabase/server";
import type { MenuSection } from "./MenuBrowser";

export async function getRestaurantMenuSections(restaurantId: string, menuId: string, withModifiers = false): Promise<MenuSection[] | null> {
  const { data: sections, error: sectionsError } = await supabaseServer
    .from("menu_sections")
    .select(`
      id,
      name,
      description,
      sort_order,
      menu_section_items (
        sort_order,
        menu_items (
          id,
          name,
          description,
          price_cents,
          source_image_url,
          image_path,
          is_orderable
        )
      )
    `)
    .eq("menu_id", menuId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (sectionsError) {
    console.error(sectionsError);
    return null;
  }

  const [modifierGroupsResult, modifierOptionsResult, modifierAttachmentsResult, modifierOverridesResult] = withModifiers
    ? await Promise.all([
        supabaseServer.from("modifier_groups")
          .select("id, name, description, is_active").eq("restaurant_id", restaurantId),
        supabaseServer.from("modifier_options")
          .select("id, modifier_group_id, name, default_price_adjustment_cents, sort_order, is_default, is_active")
          .eq("restaurant_id", restaurantId),
        supabaseServer.from("menu_item_modifier_groups")
          .select("menu_item_id, modifier_group_id, min_selections, max_selections, sort_order, is_active")
          .eq("restaurant_id", restaurantId),
        supabaseServer.from("menu_item_modifier_option_overrides")
          .select("menu_item_id, modifier_option_id, price_adjustment_cents, sort_order, is_active")
          .eq("restaurant_id", restaurantId),
      ])
    : [null, null, null, null] as const;

  const modifierErrors = [
    modifierGroupsResult?.error,
    modifierOptionsResult?.error,
    modifierAttachmentsResult?.error,
    modifierOverridesResult?.error,
  ].filter(Boolean);
  if (modifierErrors.length > 0) {
    console.error("There was a problem loading menu modifiers.", modifierErrors);
  }

  const modifierGroupsById = new Map(
    (modifierGroupsResult?.data || []).map((group) => [group.id, group]),
  );
  const modifierOptionsByGroupId = new Map<string, NonNullable<typeof modifierOptionsResult> extends { data: infer Data } ? NonNullable<Data> : never>();
  for (const option of modifierOptionsResult?.data || []) {
    const options = modifierOptionsByGroupId.get(option.modifier_group_id) || [];
    options.push(option);
    modifierOptionsByGroupId.set(option.modifier_group_id, options);
  }
  const modifierOverridesByItemAndOption = new Map(
    (modifierOverridesResult?.data || []).map((override) => [
      `${override.menu_item_id}:${override.modifier_option_id}`,
      override,
    ]),
  );
  const modifierAttachmentsByItemId = new Map<string, NonNullable<typeof modifierAttachmentsResult> extends { data: infer Data } ? NonNullable<Data> : never>();
  for (const attachment of modifierAttachmentsResult?.data || []) {
    const attachments = modifierAttachmentsByItemId.get(attachment.menu_item_id) || [];
    attachments.push(attachment);
    modifierAttachmentsByItemId.set(attachment.menu_item_id, attachments);
  }

  function getItemModifierGroups(menuItemId: string): MenuModifierGroup[] {
    return (modifierAttachmentsByItemId.get(menuItemId) || [])
      .flatMap((attachment) => {
        const group = modifierGroupsById.get(attachment.modifier_group_id);
        if (!group || !group.is_active || !attachment.is_active) return [];
        const options = (modifierOptionsByGroupId.get(group.id) || [])
          .flatMap((option) => {
            const override = modifierOverridesByItemAndOption.get(`${menuItemId}:${option.id}`);
            if (!isMenuModifierOptionAvailable(
              group.is_active,
              option.is_active,
              attachment.is_active,
              override?.is_active,
            )) return [];
            return [{
              id: option.id,
              name: option.name,
              priceAdjustmentCents: resolveModifierPriceCents(
                override?.price_adjustment_cents,
                option.default_price_adjustment_cents,
              ),
              sortOrder: override?.sort_order ?? option.sort_order,
              isDefault: option.is_default,
            }];
          })
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

        return [{
          id: group.id,
          name: group.name,
          description: group.description,
          minSelections: attachment.min_selections,
          maxSelections: attachment.max_selections,
          sortOrder: attachment.sort_order,
          options,
        }];
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  return (sections || []).map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    sort_order: section.sort_order,
    items: (section.menu_section_items || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((placement) => {
        const item = placement.menu_items;
        const items = Array.isArray(item) ? item : item ? [item] : [];
        return items.map((menuItem) => ({
          ...menuItem,
          modifierGroups: withModifiers ? getItemModifierGroups(menuItem.id) : [],
          image_url: menuItem.image_path
            ? supabaseServer.storage.from("restaurant-assets").getPublicUrl(menuItem.image_path).data.publicUrl
            : menuItem.source_image_url,
        }));
      }),
  }));
}
