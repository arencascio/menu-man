import "server-only";

import { authenticatedClient, rpcError } from "@/lib/order-management/server";
import {
  notificationSettingsSchema,
  type NotificationSettings,
} from "./contracts";

export async function getRestaurantNotificationSettings(slug: string): Promise<NotificationSettings> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("get_restaurant_notification_settings_v1", {
    p_restaurant_slug: slug,
  });
  if (error) throw rpcError(error);
  return notificationSettingsSchema.parse(data);
}

export async function updateRestaurantNotificationSettings(
  slug: string,
  settings: Omit<NotificationSettings, "updatedAt">,
  clientActionId: string,
) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("update_restaurant_notification_settings_v1", {
    p_restaurant_slug: slug,
    p_settings: settings,
    p_client_action_id: clientActionId,
  });
  if (error) throw rpcError(error);
  return notificationSettingsSchema.parse(data);
}
