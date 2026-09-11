import { z } from "zod";

const uuid = z.uuid().transform((value) => value.toLowerCase());

export const checkoutCapabilitySchema = z.string().min(32).max(200);

export const paymentSessionRequestSchema = z.strictObject({
  checkoutToken: checkoutCapabilitySchema,
});

export const paymentSubmissionRequestSchema = z.strictObject({
  checkoutToken: checkoutCapabilitySchema,
  clientAttemptKey: uuid,
  paymentMethodToken: z.string().min(1).max(500),
});

export const fakePaymentRecoveryRequestSchema = z.strictObject({
  checkoutToken: checkoutCapabilitySchema,
  resolution: z.enum(["succeeded", "failed"]),
});

const latestAttemptSchema = z.strictObject({
  attemptId: uuid,
  status: z.enum(["processing", "authorized", "succeeded", "failed", "cancelled", "unknown"]),
  failureCategory: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
}).nullable();

export const paymentStatusSchema = z.strictObject({
  paymentId: uuid,
  orderId: uuid,
  connectionId: uuid,
  provider: z.string().min(1),
  providerEnvironment: z.enum(["test", "sandbox", "production"]),
  status: z.enum([
    "requires_payment_method", "processing", "authorized", "succeeded",
    "failed", "cancelled", "partially_refunded", "refunded",
  ]),
  orderStatus: z.enum(["pending_payment", "placed", "confirmed", "preparing", "ready", "completed", "cancelled"]),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "partially_refunded", "refunded"]),
  captureMode: z.enum(["automatic", "manual"]),
  amountCents: z.int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentDueAt: z.string().datetime({ offset: true }),
  paidAt: z.string().datetime({ offset: true }).nullable(),
  latestAttempt: latestAttemptSchema,
});

export const preparedPaymentSchema = paymentStatusSchema.extend({
  sessionExpiresAt: z.string().datetime({ offset: true }),
});

export const reservedAttemptSchema = z.strictObject({
  attemptId: uuid,
  paymentId: uuid,
  connectionId: uuid,
  provider: z.string().min(1),
  providerEnvironment: z.enum(["test", "sandbox", "production"]),
  providerIdempotencyKey: z.string().min(1),
  amountCents: z.int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  captureMode: z.enum(["automatic", "manual"]),
  replayed: z.boolean(),
});

export const paymentSessionResponseSchema = z.strictObject({
  checkoutToken: checkoutCapabilitySchema,
  expiresAt: z.string().datetime({ offset: true }),
  payment: paymentStatusSchema,
  browserSession: z.strictObject({
    mode: z.literal("embedded"),
    provider: z.string().min(1),
    publicConfig: z.record(z.string(), z.unknown()),
  }),
});

export type PaymentSessionResponse = z.output<typeof paymentSessionResponseSchema>;
