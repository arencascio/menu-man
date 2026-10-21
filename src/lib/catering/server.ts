import "server-only";
import { cache } from "react";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { isMissingOptionalRelation } from "@/lib/supabase/optional-relation";
import { authenticatedClient, ManagementError } from "@/lib/order-management/server";
import { isRestaurantPublicationRestricted } from "@/lib/public-restaurant-access";
import { sendResendEmail } from "@/lib/notifications/resend";
import { cateringSettingsSchema, defaultCateringSettings, leadSchema, type CateringSettings, type InquiryInput, type LeadStatus } from "./contracts";
import { CateringError, cateringSource } from "./handler";

// Missing migration/configuration disables the public feature; no fixture writes.
export const getPublicCateringSettings = cache(async (restaurantId: string): Promise<CateringSettings> => {
  const { data, error } = await supabaseServer.from("restaurant_catering_settings").select("settings").eq("restaurant_id", restaurantId).abortSignal(AbortSignal.timeout(2000)).maybeSingle();
  if (error) {
    if (isMissingOptionalRelation(error, "restaurant_catering_settings")) return defaultCateringSettings;
    throw error;
  }
  if (!data) return defaultCateringSettings;
  const result = cateringSettingsSchema.safeParse(data.settings);
  return result.success ? result.data : defaultCateringSettings;
});

export async function submitCateringInquiry(slug: string, input: InquiryInput, request: Request) {
  if (isRestaurantPublicationRestricted(slug)) throw new CateringError(404, "Catering inquiries are unavailable.");
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new CateringError(503, "Catering inquiries are temporarily unavailable.");
  const { submissionId } = input;
  const payload = { name: input.name, email: input.email, phone: input.phone, eventDate: input.eventDate,
    guestCount: input.guestCount, eventDetails: input.eventDetails, notes: input.notes };
  const { data, error } = await supabaseServer.rpc("submit_catering_inquiry_v1", {
    p_restaurant_slug: slug, p_submission_id: submissionId, p_request: payload,
    p_source_hash: cateringSource(request, slug, secret, process.env.VERCEL_ENV),
  }).abortSignal(AbortSignal.timeout(8000));
  if (error) {
    const known = [
      ["MM_CATERING_NOT_FOUND", 404, "Catering inquiries are unavailable."],
      ["MM_CATERING_CONFLICT", 409, "This request was already received with different details. Refresh to send a new request."],
      ["MM_CATERING_DELETED", 410, "This request was removed by the restaurant. Refresh to start a new inquiry."],
      ["MM_CATERING_RATE_LIMITED", 429, "Too many requests. Please wait 15 minutes."],
      ["MM_CATERING_DATE", 400, "Choose today or a future event date in the restaurant's timezone."],
      ["MM_CATERING_INVALID", 400, "Check your request details."],
    ] as const;
    for (const [code, status, message] of known) if (error.message.includes(code)) throw new CateringError(status, message);
    throw new CateringError(503, "We could not confirm your request. Retry with the same details.");
  }
  const result = z.object({ id: z.uuid(), replayed: z.boolean(), notificationRecipient: z.unknown().optional() }).parse(data);
  if (!result.replayed && result.notificationRecipient != null) {
    // Notification is secondary to durable storage. No customer data enters email
    // or logs. The authenticated inbox is the source of truth, including failures.
    let notificationStatus = "not_configured";
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MENU_MAN_ORDER_EMAIL_FROM;
    const recipient = z.email().safeParse(result.notificationRecipient);
    try { if (recipient.success && apiKey && from && !/[\r\n]/.test(from)) {
      const url = new URL(`/manage/${encodeURIComponent(slug)}/catering`, process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).href;
      const sent = await sendResendEmail(apiKey, {
        from, to: recipient.data, subject: "New catering inquiry",
        text: `A new catering request is in your restaurant inbox. Sign in to review it: ${url}`,
        html: "<p>A new catering request is in your restaurant inbox. Sign in to Menu Man to review it.</p>",
        idempotencyKey: `catering/${result.id}`,
      }, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) }));
      notificationStatus = sent.succeeded && sent.providerMessageId?.trim() ? "sent" : "failed";
    } } catch { notificationStatus = "failed"; }
    // Do not turn an already stored inquiry into an apparent submission failure.
    try { await supabaseServer.rpc("complete_catering_notification_v1", { p_inquiry_id: result.id, p_status: notificationStatus }).abortSignal(AbortSignal.timeout(2000)); }
    catch { /* A pending badge prompts manual inbox review if completion failed. */ }
  }
  return { replayed: result.replayed };
}

async function managedCall(name: string, args: Record<string, unknown>) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(8000));
  if (error) {
    const match = error.message.match(/^MM_MANAGEMENT_(UNAUTHENTICATED|FORBIDDEN|INVALID_REQUEST|CONFLICT)\|/);
    throw new ManagementError(match ? match[1] as "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_REQUEST" | "CONFLICT" : "UNAVAILABLE", "Catering management is unavailable. Refresh and try again.");
  }
  return data;
}
export async function getManagedCateringSettings(slug: string) {
  return cateringSettingsSchema.parse(await managedCall("get_managed_catering_settings_v1", { p_restaurant_slug: slug }));
}
export async function updateManagedCateringSettings(slug: string, settings: CateringSettings) {
  return cateringSettingsSchema.parse(await managedCall("update_managed_catering_settings_v1", { p_restaurant_slug: slug, p_settings: settings }));
}
export async function listCateringInquiries(slug: string, before?: string, beforeId?: string) {
  const rows = z.array(leadSchema).parse(await managedCall("list_managed_catering_inquiries_v1", { p_restaurant_slug: slug, p_before: before ?? null, p_before_id: beforeId ?? null }));
  return { leads: rows.slice(0, 50), hasMore: rows.length > 50 };
}
export async function updateCateringInquiry(slug: string, id: string, status: LeadStatus, expectedStatus: LeadStatus) {
  await managedCall("update_managed_catering_inquiry_v1", { p_restaurant_slug: slug, p_inquiry_id: id, p_status: status, p_expected_status: expectedStatus });
}

export async function deleteCateringInquiry(slug: string, id: string, expectedStatus: LeadStatus) {
  await managedCall("delete_managed_catering_inquiry_v1", { p_restaurant_slug: slug, p_inquiry_id: id, p_expected_status: expectedStatus });
}
