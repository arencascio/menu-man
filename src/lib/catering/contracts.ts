import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const email = text(320).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address.");
const phone = text(40).refine((value) => !value || (/^[+()\d .-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7), "Enter a valid phone number.");
export const inquirySchema = z.object({
  submissionId: z.uuid(),
  name: text(120).min(1, "Enter your name."),
  email, phone,
  eventDate: z.iso.date(),
  guestCount: z.number().int().min(1).max(100000),
  eventDetails: text(1000),
  notes: text(2000),
  companyFax: text(200).default(""),
}).strict().refine((value) => Boolean(value.email || value.phone), {
  path: ["email"], message: "Enter an email address or phone number so the restaurant can reply.",
});
export type InquiryInput = z.infer<typeof inquirySchema>;
export const cateringSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  heading: text(120).min(1).default("Catering inquiries"),
  description: text(2000).default("Tell us about your event. We will contact you to discuss your request."),
  imageUrl: z.union([z.literal(""), z.string().max(2048).refine((value) => /^\/[^/]/.test(value) && !/[?#\\]/.test(value) || /^https:\/\//.test(value) && z.url().safeParse(value).success, "Use an HTTPS image URL or a local image path.")]).default(""),
  imageAlt: text(200).default(""),
  ctaLabel: text(60).min(1).default("Request catering"),
  notifyOwner: z.boolean().default(false),
}).strict().refine((settings) => !settings.imageUrl || Boolean(settings.imageAlt), { path: ["imageAlt"], message: "Describe the image for accessibility." });
export type CateringSettings = z.infer<typeof cateringSettingsSchema>;
export const defaultCateringSettings = cateringSettingsSchema.parse({});
export const leadStatusSchema = z.enum(["new", "contacted", "closed"]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export const leadSchema = z.object({
  id: z.uuid(), created_at: z.iso.datetime({ offset: true }),
  name: z.string(), email: z.string(), phone: z.string(), event_date: z.iso.date(),
  guest_count: z.number().int(), event_details: z.string(), notes: z.string(),
  status: leadStatusSchema,
  notification_status: z.enum(["disabled", "not_configured", "pending", "sent", "failed"]),
});
export type CateringLead = z.infer<typeof leadSchema>;
export const updateLeadSchema = z.object({ id: z.uuid(), expectedStatus: leadStatusSchema, status: leadStatusSchema }).strict();
export const deleteLeadSchema = z.object({ id: z.uuid(), expectedStatus: leadStatusSchema, confirm: z.literal("DELETE") }).strict();

export function eventDateAllowed(date: string, timezone: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return date >= today;
}
