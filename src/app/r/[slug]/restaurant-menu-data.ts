import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { MenuSection } from "./MenuBrowser";
import {
  createMenuModifierGroupResolverFromQueries,
  loadPaginatedModifierQuery,
  MenuModifierLoadError,
  summarizeModifierQueryFailures,
  type MenuModifierQueryResults,
} from "./restaurant-menu-modifiers";

type SourceMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  source_image_url: string | null;
  image_path: string | null;
  is_orderable: boolean;
};

type LoadedMenuSection = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  menu_section_items: Array<{
    sort_order: number;
    menu_items: SourceMenuItem | SourceMenuItem[] | null;
  }> | null;
};


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

  const typedSections = (sections || []) as LoadedMenuSection[];
  let modifierResults: MenuModifierQueryResults | null = null;
  let getItemModifierGroups: ReturnType<typeof createMenuModifierGroupResolverFromQueries> = () => [];
  if (withModifiers) {
    const [groups, options, attachments, overrides] = await Promise.all([
      loadPaginatedModifierQuery((from, to) => supabaseServer.from("modifier_groups")
        .select("id, name, description, is_active").eq("restaurant_id", restaurantId)
        .order("id", { ascending: true }).range(from, to)),
      loadPaginatedModifierQuery((from, to) => supabaseServer.from("modifier_options")
        .select("id, modifier_group_id, name, default_price_adjustment_cents, sort_order, is_default, is_active")
        .eq("restaurant_id", restaurantId).order("id", { ascending: true }).range(from, to)),
      loadPaginatedModifierQuery((from, to) => supabaseServer.from("menu_item_modifier_groups")
        .select("menu_item_id, modifier_group_id, min_selections, max_selections, sort_order, is_active")
        .eq("restaurant_id", restaurantId)
        .order("menu_item_id", { ascending: true }).order("modifier_group_id", { ascending: true })
        .range(from, to)),
      loadPaginatedModifierQuery((from, to) => supabaseServer.from("menu_item_modifier_option_overrides")
        .select("menu_item_id, modifier_group_id, modifier_option_id, price_adjustment_cents, sort_order, is_active")
        .eq("restaurant_id", restaurantId)
        .order("menu_item_id", { ascending: true }).order("modifier_option_id", { ascending: true })
        .range(from, to)),
    ]);
    modifierResults = { groups, options, attachments, overrides };
    const failures = summarizeModifierQueryFailures(modifierResults);
    if (failures.length > 0) {
      console.error("menu_modifier_query_failure", {
        restaurantId,
        menuId,
        errors: failures,
      });
      throw new MenuModifierLoadError(failures.map(({ query }) => query));
    }
    getItemModifierGroups = createMenuModifierGroupResolverFromQueries(modifierResults);
  }

  return typedSections.map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    sort_order: section.sort_order,
    items: (section.menu_section_items || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((placement) => {
        const relation = placement.menu_items;
        const items = Array.isArray(relation) ? relation : relation ? [relation] : [];
        return items.map((menuItem) => {
          const clientMenuItem = menuItem;
          const modifierGroups = withModifiers ? getItemModifierGroups(menuItem.id) : [];
          const finalItem = {
            ...clientMenuItem,
            modifierGroups,
            image_url: menuItem.image_path
              ? supabaseServer.storage.from("restaurant-assets").getPublicUrl(menuItem.image_path).data.publicUrl
              : menuItem.source_image_url,
          };
          return finalItem;
        });
      }),
  }));
}
