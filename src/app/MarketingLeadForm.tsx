"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { createLeadSubmitter, initialLeadState, leadFallback, leadFormReducer } from "@/lib/marketing-leads/client";
import type { MarketingLead } from "@/lib/marketing-leads/contracts";
import styles from "./page.module.css";
import { createMarketingFormAnalytics } from "@/lib/analytics/marketing";
import { trackMarketing } from "@/lib/analytics/marketing-client";

export function useMarketingLead(type: MarketingLead["type"]) {
  const form_type = type === "website" ? "website_inquiry" : "website_review";
  const [analytics] = useState(() => createMarketingFormAnalytics(form_type, trackMarketing));
  const open = useCallback(() => analytics.open(), [analytics]);
  const close = useCallback(() => analytics.close(), [analytics]);
  useEffect(() => { if (type === "website") open(); }, [type, open]);
  const [state, dispatch] = useReducer(leadFormReducer, initialLeadState);
  const sender = useRef<ReturnType<typeof createLeadSubmitter> | null>(null);
  const resetSuccess = useCallback(() => dispatch({ type: "failed", error: "" }), []);
  function capture(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    dispatch({ type: "edit", values });
    if (Object.entries(values).some(([key, value]) => key !== "companyFax" && value.trim())) analytics.start();
    return values;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.pending) return;
    const values = capture(event.currentTarget);
    sender.current ??= createLeadSubmitter(undefined, undefined, (outcome) => {
      if (outcome.status === "accepted") trackMarketing({ name: "marketing_lead_accepted", form_type });
      else trackMarketing({ name: "marketing_lead_failed", form_type, failure_category: outcome.category });
    });
    dispatch({ type: "start" });
    const result = await sender.current(values, type);
    if ("busy" in result) return;
    if ("accepted" in result) dispatch({ type: "accepted" });
    else dispatch({ type: "failed", error: result.error });
  }
  return { state, capture, submit, emailHref: leadFallback(type, state.values),
    resetSuccess, open, close, form_type };
}

export function LeadFormFeedback({ error, emailHref, formType }: { error: string; emailHref: string; formType: "website_inquiry" | "website_review" }) {
  return <>
    <label className={styles.leadTrap} aria-hidden="true">
      Leave this field empty
      <input name="companyFax" tabIndex={-1} autoComplete="off" maxLength={200} />
    </label>
    {error ? <p role="alert">{error} <a href={emailHref} data-marketing-email={formType} data-marketing-placement="form">Email your details to hello@getmenuman.com</a></p> : null}
    <p className={styles.formNote}>Your details are used to respond to this request. <a href={emailHref} data-marketing-email={formType} data-marketing-placement="form">Prefer email?</a></p>
  </>;
}
