import "server-only";

import type { MenuModifierGroup } from "@/lib/cart/types";
import { supabaseServer } from "@/lib/supabase/server";
import type { MenuSection } from "./MenuBrowser";
import {
  createMenuModifierGroupResolverFromQueries,
  MenuModifierLoadError,
  summarizeModifierQueryFailures,
  type MenuModifierQueryResults,
  type ModifierQueryError,
} from "./restaurant-menu-modifiers";

const cabezaSourceItemId = "198880597";
const cabezaSourceSystem = "doordash";

type SourceMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  source_image_url: string | null;
  image_path: string | null;
  is_orderable: boolean;
  source_system: string | null;
  source_item_id: string | null;
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

type QueryCapture<T> = {
  data: readonly T[] | null;
  error: ModifierQueryError | null;
};

async function captureModifierQuery<T>(
  query: PromiseLike<{ data: T[] | null; error: ModifierQueryError | null }>,
): Promise<QueryCapture<T>> {
  try {
    const result = await query;
    return { data: result.data, error: result.error };
  } catch (error) {
    return {
      data: null,
      error: {
        code: "QUERY_REJECTED",
        message: error instanceof Error ? error.message : "Modifier query rejected without an Error instance.",
      },
    };
  }
}

function getSupabaseProjectRef() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
}

function shouldLogStagingModifierDiagnostics() {
  return process.env.MENU_MAN_ENV === "staging" && process.env.VERCEL_ENV !== "production";
}

function deploymentContext() {
  return {
    environment: process.env.VERCEL_ENV || process.env.MENU_MAN_ENV || "local",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    supabaseProjectRef: getSupabaseProjectRef(),
  };
}

function findCabezaMenuItem(sections: readonly LoadedMenuSection[]) {
  for (const section of sections) {
    for (const placement of section.menu_section_items || []) {
      const relation = placement.menu_items;
      const items = Array.isArray(relation) ? relation : relation ? [relation] : [];
      const item = items.find((candidate) =>
        candidate.source_system === cabezaSourceSystem && candidate.source_item_id === cabezaSourceItemId,
      );
      if (item) return item;
    }
  }
  return null;
}

function logCabezaModifierFailure(
  restaurantId: string,
  menuId: string,
  sections: readonly LoadedMenuSection[],
  results: MenuModifierQueryResults,
) {
  if (!shouldLogStagingModifierDiagnostics()) return;
  const item = findCabezaMenuItem(sections);
  if (!item) return;
  const attachments = results.attachments.data?.filter((row) => row.menu_item_id === item.id) || [];
  const targetGroups = attachments.map((attachment) => {
    const group = results.groups.data?.find((row) => row.id === attachment.modifier_group_id);
    const options = results.options.data?.filter((row) => row.modifier_group_id === attachment.modifier_group_id) ?? null;
    const overrides = results.overrides.data?.filter((row) =>
      row.menu_item_id === item.id && row.modifier_group_id === attachment.modifier_group_id,
    ) ?? null;
    return {
      groupId: attachment.modifier_group_id,
      groupName: group?.name || null,
      optionCountLoaded: options?.length ?? null,
      overrideRowCountLoaded: overrides?.length ?? null,
      activeOverrideCount: overrides?.filter((row) => row.is_active).length ?? null,
      inactiveOverrideCount: overrides?.filter((row) => !row.is_active).length ?? null,
      finalEffectiveOptionNames: null,
    };
  });
  console.error("menu_modifier_load_failed", {
    ...deploymentContext(),
    restaurantId,
    menuId,
    itemId: item.id,
    sourceSystem: item.source_system,
    sourceItemId: item.source_item_id,
    queryRowCounts: {
      groups: results.groups.data?.length ?? null,
      options: results.options.data?.length ?? null,
      attachments: results.attachments.data?.length ?? null,
      overrides: results.overrides.data?.length ?? null,
    },
    groups: targetGroups,
    errors: summarizeModifierQueryFailures(results),
  });
}

function logCabezaModifierVisibility(
  restaurantId: string,
  menuId: string,
  item: { id: string; source_system: string; source_item_id: string },
  groups: MenuModifierGroup[],
  results: MenuModifierQueryResults,
) {
  if (!shouldLogStagingModifierDiagnostics()) return;
  console.info("menu_modifier_visibility", {
    ...deploymentContext(),
    restaurantId,
    menuId,
    itemId: item.id,
    sourceSystem: item.source_system,
    sourceItemId: item.source_item_id,
    queryRowCounts: {
      groups: results.groups.data?.length ?? null,
      options: results.options.data?.length ?? null,
      attachments: results.attachments.data?.length ?? null,
      overrides: results.overrides.data?.length ?? null,
    },
    groups: groups.map((effectiveGroup) => {
      const options = results.options.data?.filter((row) => row.modifier_group_id === effectiveGroup.id) || [];
      const overrides = results.overrides.data?.filter((row) =>
        row.menu_item_id === item.id && row.modifier_group_id === effectiveGroup.id,
      ) || [];
      return {
        groupId: effectiveGroup.id,
        groupName: effectiveGroup.name,
        optionCountLoaded: options.length,
        overrideRowCountLoaded: overrides.length,
        activeOverrideCount: overrides.filter((row) => row.is_active).length,
        inactiveOverrideCount: overrides.filter((row) => !row.is_active).length,
        finalEffectiveOptionNames: effectiveGroup.options.map((option) => option.name),
      };
    }),
  });
}

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
          is_orderable,
          source_system,
          source_item_id
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
      captureModifierQuery(supabaseServer.from("modifier_groups")
        .select("id, name, description, is_active").eq("restaurant_id", restaurantId)),
      captureModifierQuery(supabaseServer.from("modifier_options")
        .select("id, modifier_group_id, name, default_price_adjustment_cents, sort_order, is_default, is_active")
        .eq("restaurant_id", restaurantId)),
      captureModifierQuery(supabaseServer.from("menu_item_modifier_groups")
        .select("menu_item_id, modifier_group_id, min_selections, max_selections, sort_order, is_active")
        .eq("restaurant_id", restaurantId)),
      captureModifierQuery(supabaseServer.from("menu_item_modifier_option_overrides")
        .select("menu_item_id, modifier_group_id, modifier_option_id, price_adjustment_cents, sort_order, is_active")
        .eq("restaurant_id", restaurantId)),
    ]);
    modifierResults = { groups, options, attachments, overrides };
    const failures = summarizeModifierQueryFailures(modifierResults);
    if (failures.length > 0) {
      logCabezaModifierFailure(restaurantId, menuId, typedSections, modifierResults);
      console.error("menu_modifier_query_failure", {
        ...deploymentContext(),
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
          const { source_system, source_item_id, ...clientMenuItem } = menuItem;
          const modifierGroups = withModifiers ? getItemModifierGroups(menuItem.id) : [];
          if (source_system === cabezaSourceSystem && source_item_id === cabezaSourceItemId && modifierResults) {
            logCabezaModifierVisibility(
              restaurantId,
              menuId,
              { id: menuItem.id, source_system, source_item_id },
              modifierGroups,
              modifierResults,
            );
          }
          return {
            ...clientMenuItem,
            modifierGroups,
            image_url: menuItem.image_path
              ? supabaseServer.storage.from("restaurant-assets").getPublicUrl(menuItem.image_path).data.publicUrl
              : menuItem.source_image_url,
          };
        });
      }),
  }));
}
