import { z } from "zod";

const uuid = z.uuid().transform((value) => value.toLowerCase());

export const checkoutCapabilitySchema = z.string().min(32).max(200);

export const paymentSessionRequestSchema = z.strictObject({});

export const paymentSubmissionRequestSchema = z.strictObject({
  clientAttemptKey: uuid,
  paymentMethodToken: z.string().min(1).max(500),
});

export const fakePaymentRecoveryRequestSchema = z.strictObject({
  resolution: z.enum(["succeeded", "failed"]),
});

export const fakeAuthorizationActionRequestSchema = z.strictObject({
  action: z.enum(["capture", "void"]),
  clientActionKey: uuid,
});

export const fakeLateSuccessResolutionRequestSchema = z.strictObject({
  resolution: z.enum(["accepted", "refunded"]),
  clientActionKey: uuid,
});

export const reservedAuthorizationActionSchema = z.strictObject({
  action: z.enum(["capture", "void"]),
  attemptId: uuid,
  paymentId: uuid,
  orderId: uuid,
  connectionId: uuid,
  provider: z.literal("fake"),
  providerEnvironment: z.literal("test"),
  providerIdempotencyKey: z.string().min(1),
  providerPaymentReference: z.string().min(1),
  amountCents: z.int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  attemptStatus: z.enum(["authorized", "succeeded", "failed", "cancelled"]),
  replayed: z.boolean(),
});

export const reservedLateSuccessResolutionSchema = z.strictObject({
  resolution: z.enum(["accepted", "refunded"]),
  resolutionKey: uuid,
  attemptId: uuid,
  paymentId: uuid,
  orderId: uuid,
  connectionId: uuid,
  provider: z.literal("fake"),
  providerEnvironment: z.literal("test"),
  providerPaymentReference: z.string().min(1),
  amountCents: z.int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  replayed: z.boolean(),
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
  expiresAt: z.string().datetime({ offset: true }),
  payment: paymentStatusSchema,
  browserSession: z.strictObject({
    mode: z.literal("embedded"),
    provider: z.string().min(1),
    publicConfig: z.record(z.string(), z.unknown()),
  }),
});

export type PaymentSessionResponse = z.output<typeof paymentSessionResponseSchema>;
