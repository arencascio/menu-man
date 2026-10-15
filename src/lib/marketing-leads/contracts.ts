import { z } from "zod";

const short = z.string().trim().max(160);
const website = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Enter a full http:// or https:// website address.");

export const leadSchema = z.object({
  type: z.enum(["website", "review"]),
  submissionId: z.uuid(),
  restaurantName: short.min(1),
  email: z.email().max(254),
  name: short.default(""),
  phone: z.string().trim().max(50).default(""),
  city: short.default(""),
  website: website.default(""),
  noWebsite: z.boolean().default(false),
  onlineOrdering: z.enum(["", "yes", "no", "unsure"]).default(""),
  orderingProviders: z.string().trim().max(300).default(""),
  help: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(2000).default(""),
  companyFax: z.string().max(200).default(""),
}).strict().superRefine((lead, context) => {
  if (lead.type === "review" && !lead.noWebsite && !lead.website) {
    context.addIssue({ code: "custom", path: ["website"], message: "Provide a website or select no website." });
  }
  if (lead.type === "website" && !lead.help) {
    context.addIssue({ code: "custom", path: ["help"], message: "Select the help you need." });
  }
});

export type MarketingLead = z.infer<typeof leadSchema>;
export const leadRecipient = "hello@getmenuman.com";
export const leadTitles = { website: "Build My Website inquiry", review: "Free Website Review request" };

export function leadText(lead: MarketingLead) {
  return [
    leadTitles[lead.type],
    `Restaurant: ${lead.restaurantName}`, `Contact email: ${lead.email}`,
    `Name: ${lead.name}`, `Phone: ${lead.phone}`, `City: ${lead.city}`,
    `Website: ${lead.noWebsite ? "No website" : lead.website}`,
    `Online ordering: ${lead.onlineOrdering}`, `Providers: ${lead.orderingProviders}`,
    `Help requested: ${lead.help}`, `Notes: ${lead.notes}`,
  ].join("\n");
}
