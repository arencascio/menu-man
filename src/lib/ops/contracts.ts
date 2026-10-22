import { z } from "zod";
import { leadSchema } from "../marketing-leads/contracts";

export const statuses = ["new", "contacted", "waiting", "won", "lost", "spam"] as const;
export const statusLabels: Record<typeof statuses[number], string> = {
  new: "New", contacted: "Contacted", waiting: "Waiting", won: "Won", lost: "Lost", spam: "Spam",
};
export const querySchema = z.object({
  view: z.enum(["open", "all", "due", "notifications"]).default("open"),
  status: z.enum(["all", ...statuses]).default("all"),
  type: z.enum(["all", "website", "review"]).default("all"),
  sort: z.enum(["newest", "oldest", "follow_up"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
export type InboxQuery = z.infer<typeof querySchema>;
const timestamp = z.iso.datetime({ offset: true });
export const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), revision: z.number().int().min(1).max(2_147_483_646),
    status: z.enum(statuses), notes: z.string().max(8000),
    followUpAt: timestamp.nullable().refine(value => !value || (value >= "1970" && value < "2101")),
  }).strict(),
  z.object({ action: z.literal("retry") }).strict(),
]);
export const notificationSchema = z.object({
  state: z.enum(["queued", "sending", "accepted", "retryable", "failed", "unknown"]),
  attemptCount: z.number().int(), lastAttemptAt: timestamp.nullable(), nextAttemptAt: timestamp,
  acceptedAt: timestamp.nullable(), errorCode: z.string().nullable(), httpStatus: z.number().nullable(),
  providerId: z.string().nullable(), retryEligible: z.boolean(),
  firstAttemptAt: timestamp.nullable(), leaseExpiresAt: timestamp.nullable(), hasSender: z.boolean(),
  retryBlock: z.enum(["accepted", "unknown", "limit", "sender", "expired", "leased", "backoff"]).nullable(),
});
export type OpsNotification = z.infer<typeof notificationSchema>;
const rowSchema = z.object({
  id: z.uuid(), restaurant: z.string(), contact: z.string(), type: z.enum(["website", "review"]),
  createdAt: timestamp, status: z.enum(statuses), followUpAt: timestamp.nullable(), overdue: z.boolean(), notification: notificationSchema,
});
export const inboxSchema = z.object({
  summary: z.object({ new: z.number().int(), due: z.number().int(), failed: z.number().int() }),
  items: z.array(rowSchema).max(26),
});
export type Inbox = z.infer<typeof inboxSchema>;
export const detailSchema = z.object({
  id: z.uuid(), submissionId: z.uuid(), type: z.enum(["website", "review"]),
  details: z.object(leadSchema.shape).omit({ type: true, submissionId: true, companyFax: true }),
  createdAt: timestamp, updatedAt: timestamp, sourcePage: z.string().nullable(), attribution: z.record(z.string(), z.string()),
  status: z.enum(statuses), notes: z.string(), followUpAt: timestamp.nullable(), lastContactedAt: timestamp.nullable(), revision: z.number().int(),
  notification: notificationSchema,
  attempts: z.array(z.object({ number: z.number().int(), state: z.string(), httpStatus: z.number().nullable(), errorCode: z.string().nullable(), startedAt: timestamp, completedAt: timestamp.nullable() })),
  activity: z.array(z.object({ id: z.uuid(), kind: z.string(), changes: z.record(z.string(), z.unknown()), created_at: timestamp })),
});
export type LeadDetail = z.infer<typeof detailSchema>;
