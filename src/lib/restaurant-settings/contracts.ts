import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable()
  .transform((value) => value === null || value === "" ? null : value);
const optionalHttpsUrl = z.string().trim().max(2048).nullable().transform((value, context) => {
  if (value === null || value === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid https:// URL." });
    return z.NEVER;
  }
});

export const restaurantSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: optionalText(180),
  description: optionalText(2000),
  phone: optionalText(40),
  addressLine1: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  googleMapsUrl: optionalHttpsUrl,
  instagramUrl: optionalHttpsUrl,
  facebookUrl: optionalHttpsUrl,
});

export const orderingSettingsSchema = z.object({
  pickupEnabled: z.boolean(),
  asapEnabled: z.boolean(),
  scheduledPickupEnabled: z.boolean(),
  pickupLeadTimeMinutes: z.number().int().min(0).max(1440),
  pickupSlotIntervalMinutes: z.number().int().min(5).max(1440),
  advanceOrderDays: z.number().int().min(0).max(30),
  customerNameRequired: z.boolean(),
  customerEmailRequired: z.boolean(),
  customerPhoneRequired: z.boolean(),
  customTipAdditiveCapCents: z.number().int().min(0).max(2147483647),
  refundWindowDays: z.number().int().min(0).max(365),
}).refine((value) => value.pickupEnabled || (!value.asapEnabled && !value.scheduledPickupEnabled), {
  message: "ASAP and scheduled pickup must be disabled when pickup is disabled.",
  path: ["pickupEnabled"],
});

export const businessHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).superRefine((value, context) => {
  if (!value.isClosed && (!value.openTime || !value.closeTime)) {
    context.addIssue({ code: "custom", message: "Open days require opening and closing times." });
  }
  if (!value.isClosed && value.openTime && value.closeTime && value.openTime >= value.closeTime) {
    context.addIssue({ code: "custom", message: "Closing time must be later than opening time." });
  }
});

export const specialHourSchema = z.object({
  id: z.uuid(),
  serviceDate: z.iso.date(),
  label: optionalText(100),
  isClosed: z.boolean(),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).superRefine((value, context) => {
  if (!value.isClosed && (!value.openTime || !value.closeTime)) {
    context.addIssue({ code: "custom", message: "Open special dates require opening and closing times." });
  }
  if (!value.isClosed && value.openTime && value.closeTime && value.openTime >= value.closeTime) {
    context.addIssue({ code: "custom", message: "Special-hours closing time must be later than opening time." });
  }
});

export const hoursSettingsSchema = z.object({
  timezone: z.string().min(1),
  days: z.array(businessHourSchema).length(7).superRefine((days, context) => {
    if (new Set(days.map((day) => day.dayOfWeek)).size !== 7) {
      context.addIssue({ code: "custom", message: "Include each day of the week exactly once." });
    }
  }),
  specialDates: z.array(specialHourSchema).max(100).superRefine((dates, context) => {
    if (new Set(dates.map((entry) => entry.serviceDate)).size !== dates.length) {
      context.addIssue({ code: "custom", message: "Only one special-hours entry is allowed per date." });
    }
  }),
  hadMultipleIntervals: z.boolean().default(false),
});

export const updateRestaurantSettingsRequestSchema = restaurantSettingsSchema.extend({ clientActionId: z.uuid() });
export const updateOrderingSettingsRequestSchema = orderingSettingsSchema.extend({ clientActionId: z.uuid() });
export const updateHoursSettingsRequestSchema = hoursSettingsSchema.omit({ timezone: true, hadMultipleIntervals: true })
  .extend({ clientActionId: z.uuid() });

export type RestaurantSettings = z.infer<typeof restaurantSettingsSchema>;
export type OrderingSettings = z.infer<typeof orderingSettingsSchema>;
export type HoursSettings = z.infer<typeof hoursSettingsSchema>;
