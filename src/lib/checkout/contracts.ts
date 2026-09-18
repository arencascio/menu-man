import { z } from "zod";
import { paymentSessionResponseSchema } from "@/lib/payments/contracts";
import {
  isValidCustomerEmail,
  isValidCustomerName,
  isValidCustomerNotes,
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerNotes,
  normalizeUsPhone,
} from "./customer-details";

const uuidSchema = z.uuid().transform((value) => value.toLowerCase());

function optionalTrimmedText(maxLength: number) {
  return z.union([z.string().max(maxLength), z.null()])
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });
}

const checkoutLineSchema = z.strictObject({
  menuItemId: uuidSchema,
  quantity: z.int().min(1).max(99),
  modifierOptionIds: z.array(uuidSchema).max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Modifier option IDs must be unique."),
  specialInstructions: optionalTrimmedText(500),
});

const customerNameSchema = z.union([z.string().max(500), z.null()]).optional()
  .transform(normalizeCustomerName)
  .refine((value) => value == null || isValidCustomerName(value, false), {
    message: "Enter a valid name with at least one letter and no more than 100 characters. When a name is required, Latin-script names must be at least 2 characters; single-character non-Latin names are allowed.",
  });

const customerEmailSchema = z.union([z.string().max(500), z.null()]).optional()
  .transform(normalizeCustomerEmail)
  .refine((value) => value == null || isValidCustomerEmail(value), {
    message: "Enter a valid email address.",
  });

const customerPhoneSchema = z.union([z.string().max(100), z.null()]).optional()
  .transform((value, context) => {
    if (!value?.trim()) return null;
    const normalized = normalizeUsPhone(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "Enter a valid 10-digit US phone number." });
      return z.NEVER;
    }
    return normalized;
  });

const customerSchema = z.strictObject({
  name: customerNameSchema,
  phone: customerPhoneSchema,
  email: customerEmailSchema,
});

const customerNotesSchema = z.union([z.string().max(2_000), z.null()]).optional()
  .transform(normalizeCustomerNotes)
  .refine((value) => value == null || isValidCustomerNotes(value), {
    message: "Order notes must be 500 characters or fewer and contain only normal text.",
  });

const pickupSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("asap") }),
  z.strictObject({
    mode: z.literal("scheduled"),
    pickupAt: z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  }),
]);

const checkoutInputSchema = z.strictObject({
  menuId: uuidSchema,
  items: z.array(checkoutLineSchema).min(1).max(50),
  customer: customerSchema,
  pickup: pickupSchema,
  tipChoice: z.enum(["none", "10_percent", "15_percent", "20_percent", "custom"]),
  customTipCents: z.union([z.int().nonnegative().max(2_147_483_647), z.null()]).optional(),
  largeTipConfirmed: z.boolean().optional().default(false),
  largeTipConfirmedSubtotalCents: z.union([
    z.int().nonnegative().max(2_147_483_647),
    z.null(),
  ]).optional(),
  orderNotes: customerNotesSchema,
}).superRefine((request, context) => {
  if (request.tipChoice === "custom" && request.customTipCents == null) {
    context.addIssue({
      code: "custom",
      path: ["customTipCents"],
      message: "Enter a valid custom tip with no more than two decimal places.",
    });
  }
  if (
    request.tipChoice === "custom"
    && request.largeTipConfirmed
    && request.largeTipConfirmedSubtotalCents == null
  ) {
    context.addIssue({
      code: "custom",
      path: ["largeTipConfirmedSubtotalCents"],
      message: "The confirmed subtotal is required for a large custom tip.",
    });
  }
});

function canonicalLineKey(line: z.output<typeof checkoutLineSchema>) {
  return JSON.stringify([
    line.menuItemId,
    line.modifierOptionIds,
    line.specialInstructions,
    line.quantity,
  ]);
}

export const checkoutRequestSchema = checkoutInputSchema.transform((request) => ({
  menuId: request.menuId,
  items: request.items
    .map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      modifierOptionIds: [...line.modifierOptionIds].sort(),
      specialInstructions: line.specialInstructions,
    }))
    .sort((left, right) => canonicalLineKey(left).localeCompare(canonicalLineKey(right))),
  customer: request.customer,
  pickup: request.pickup,
  tipChoice: request.tipChoice,
  customTipCents: request.tipChoice === "custom" ? request.customTipCents! : null,
  largeTipConfirmed: request.tipChoice === "custom" && request.largeTipConfirmed,
  largeTipConfirmedSubtotalCents: request.tipChoice === "custom" && request.largeTipConfirmed
    ? request.largeTipConfirmedSubtotalCents!
    : null,
  orderNotes: request.orderNotes,
}));

export const idempotencyKeySchema = z.uuid().transform((value) => value.toLowerCase());

const authoritativeOrderItemSchema = z.strictObject({
  menuItemId: uuidSchema,
  itemName: z.string(),
  quantity: z.int().positive(),
  unitPriceCents: z.int().nonnegative(),
  lineTotalCents: z.int().nonnegative(),
});

export const checkoutResponseSchema = z.strictObject({
  orderId: uuidSchema,
  orderNumber: z.string().regex(/^\d+$/),
  orderStatus: z.literal("pending_payment"),
  paymentStatus: z.literal("unpaid"),
  currency: z.string().regex(/^[A-Z]{3}$/),
  subtotalCents: z.int().nonnegative(),
  taxCents: z.int().nonnegative(),
  tipCents: z.int().nonnegative(),
  totalCents: z.int().nonnegative(),
  pickup: z.strictObject({
    mode: z.enum(["asap", "scheduled"]),
    pickupAt: z.string().datetime({ offset: true }),
    timezone: z.string().min(1),
  }),
  items: z.array(authoritativeOrderItemSchema),
  replayed: z.boolean(),
  paymentSession: paymentSessionResponseSchema.nullable().optional(),
});

const rawPickupAvailabilitySchema = z.strictObject({
  timezone: z.string().nullable(),
  generatedAt: z.string().datetime({ offset: true }),
  currentlyOpen: z.boolean(),
  asap: z.strictObject({
    enabled: z.boolean(),
    available: z.boolean(),
    estimatedPickupAt: z.string().datetime({ offset: true }).nullable(),
  }),
  scheduled: z.strictObject({
    enabled: z.boolean(),
    slots: z.array(z.strictObject({ pickupAt: z.string().datetime({ offset: true }) })),
  }),
});

export const pickupAvailabilitySchema = rawPickupAvailabilitySchema.transform((availability) => {
  const slotTimes = [...new Set(availability.scheduled.slots.map((slot) => (
    new Date(slot.pickupAt).toISOString()
  )))].sort();
  let formatter: Intl.DateTimeFormat | null = null;

  if (availability.timezone) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: availability.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      formatter = null;
    }
  }

  return {
    timezone: availability.timezone,
    generatedAt: new Date(availability.generatedAt).toISOString(),
    currentlyOpen: availability.currentlyOpen,
    asap: {
      ...availability.asap,
      estimatedPickupAt: availability.asap.estimatedPickupAt
        ? new Date(availability.asap.estimatedPickupAt).toISOString()
        : null,
    },
    scheduled: {
      enabled: availability.scheduled.enabled,
      slots: slotTimes.map((pickupAt) => ({
        pickupAt,
        label: formatter?.format(new Date(pickupAt)) || pickupAt,
      })),
    },
  };
});

export type CheckoutRequest = z.output<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.output<typeof checkoutResponseSchema>;
export type PickupAvailability = z.output<typeof pickupAvailabilitySchema>;
export type TipChoice = CheckoutRequest["tipChoice"];

export type CheckoutErrorCode =
  | "INVALID_REQUEST"
  | "RESTAURANT_NOT_FOUND"
  | "ORDERING_DISABLED"
  | "TAX_NOT_CONFIGURED"
  | "MENU_UNAVAILABLE"
  | "ITEM_NOT_ORDERABLE"
  | "ITEM_NOT_ON_MENU"
  | "INVALID_MODIFIERS"
  | "PICKUP_UNAVAILABLE"
  | "LARGE_TIP_CONFIRMATION_REQUIRED"
  | "TOTAL_TOO_LARGE"
  | "IDEMPOTENCY_CONFLICT"
  | "CHECKOUT_FAILED";

export type CheckoutErrorResponse = {
  error: {
    code: CheckoutErrorCode;
    message: string;
    authoritativeSubtotalCents?: number;
    issues?: Array<{ path: string; message: string }>;
  };
};
