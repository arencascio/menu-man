import "server-only";

import { authenticatedClient, rpcError } from "@/lib/order-management/server";
import {
  featuredSettingsSchema,
  type FeaturedSettings,
  deliverySettingsSchema,
  hoursSettingsSchema,
  orderingSettingsSchema,
  restaurantSettingsSchema,
  type DeliverySettings,
  type HoursSettings,
  type OrderingSettings,
  type RestaurantSettings,
} from "./contracts";

export const getFeaturedSettings = (slug: string): Promise<FeaturedSettings> =>
  call("get_managed_featured_items_v1", featuredSettingsSchema, { p_restaurant_slug: slug });
export const updateFeaturedSettings = (slug: string, selectedItemIds: string[], clientActionId: string): Promise<FeaturedSettings> =>
  call("update_managed_featured_items_v1", featuredSettingsSchema, { p_restaurant_slug: slug, p_item_ids: selectedItemIds, p_client_action_id: clientActionId });

async function call<T>(functionName: string, schema: { parse(value: unknown): T }, args: Record<string, unknown>) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw rpcError(error);
  return schema.parse(data);
}

export const getRestaurantSettings = (slug: string): Promise<RestaurantSettings> =>
  call("get_managed_restaurant_settings_v1", restaurantSettingsSchema, { p_restaurant_slug: slug });
export const updateRestaurantSettings = (slug: string, settings: RestaurantSettings, clientActionId: string) =>
  call("update_managed_restaurant_settings_v1", restaurantSettingsSchema, { p_restaurant_slug: slug, p_settings: settings, p_client_action_id: clientActionId });
export const getOrderingSettings = (slug: string): Promise<OrderingSettings> =>
  call("get_managed_ordering_settings_v1", orderingSettingsSchema, { p_restaurant_slug: slug });
export const updateOrderingSettings = (slug: string, settings: OrderingSettings, clientActionId: string) =>
  call("update_managed_ordering_settings_v1", orderingSettingsSchema, { p_restaurant_slug: slug, p_settings: settings, p_client_action_id: clientActionId });
export const getHoursSettings = (slug: string): Promise<HoursSettings> =>
  call("get_managed_hours_settings_v2", hoursSettingsSchema, { p_restaurant_slug: slug });
export const updateHoursSettings = (slug: string, settings: Pick<HoursSettings, "days" | "specialDates">, clientActionId: string) =>
  call("update_managed_hours_settings_v2", hoursSettingsSchema, { p_restaurant_slug: slug, p_days: settings.days, p_special_dates: settings.specialDates, p_client_action_id: clientActionId });
export const getDeliverySettings = (slug: string): Promise<DeliverySettings> =>
  call("get_managed_delivery_settings_v1", deliverySettingsSchema, { p_restaurant_slug: slug });
export const updateDeliverySettings = (slug: string, settings: DeliverySettings, clientActionId: string) =>
  call("update_managed_delivery_settings_v1", deliverySettingsSchema, { p_restaurant_slug: slug, p_providers: settings.providers, p_client_action_id: clientActionId });
