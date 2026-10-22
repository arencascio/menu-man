import { z } from "zod";
import { normalizeWebsite, websiteError } from "./website";

const short = z.string().trim().max(160);
const website = z.string().trim().max(500).transform((value, context) => {
  const normalized = normalizeWebsite(value);
  if (normalized !== null) return normalized;
  context.addIssue({ code: "custom", message: websiteError });
  return z.NEVER;
});

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

export function leadSubject(lead: MarketingLead) {
  const name = lead.restaurantName.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  // Subject context is only a restaurant label. Keep contact details in the body,
  // even if someone pasted an email, URL, or phone number into that field.
  const restaurant = /@|https?:\/\/|www\.|\d[\d\s().+-]{6,}\d/i.test(name) ? "Restaurant" : name.slice(0, 80) || "Restaurant";
  const title = lead.type === "website" ? "Website inquiry" : "Free website review";
  return `[MM-${lead.submissionId.toLowerCase()}] ${title} — ${restaurant}`;
}

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
