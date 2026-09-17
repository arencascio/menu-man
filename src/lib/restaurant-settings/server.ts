import "server-only";

import { authenticatedClient, rpcError } from "@/lib/order-management/server";
import {
  hoursSettingsSchema,
  orderingSettingsSchema,
  restaurantSettingsSchema,
  type HoursSettings,
  type OrderingSettings,
  type RestaurantSettings,
} from "./contracts";

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
  call("get_managed_hours_settings_v1", hoursSettingsSchema, { p_restaurant_slug: slug });
export const updateHoursSettings = (slug: string, days: HoursSettings["days"], clientActionId: string) =>
  call("update_managed_hours_settings_v1", hoursSettingsSchema, { p_restaurant_slug: slug, p_days: days, p_client_action_id: clientActionId });
