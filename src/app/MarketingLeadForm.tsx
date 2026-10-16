"use client";

import { useCallback, useReducer, useRef, type FormEvent } from "react";
import { createLeadSubmitter, initialLeadState, leadFallback, leadFormReducer } from "@/lib/marketing-leads/client";
import type { MarketingLead } from "@/lib/marketing-leads/contracts";
import styles from "./page.module.css";

export function useMarketingLead(type: MarketingLead["type"]) {
  const [state, dispatch] = useReducer(leadFormReducer, initialLeadState);
  const sender = useRef<ReturnType<typeof createLeadSubmitter> | null>(null);
  const resetSuccess = useCallback(() => dispatch({ type: "failed", error: "" }), []);
  function capture(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    dispatch({ type: "edit", values });
    return values;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.pending) return;
    const values = capture(event.currentTarget);
    sender.current ??= createLeadSubmitter();
    dispatch({ type: "start" });
    const result = await sender.current(values, type);
    if ("busy" in result) return;
    if ("accepted" in result) dispatch({ type: "accepted" });
    else dispatch({ type: "failed", error: result.error });
  }
  return { state, capture, submit, emailHref: leadFallback(type, state.values),
    resetSuccess };
}

export function LeadFormFeedback({ error, emailHref }: { error: string; emailHref: string }) {
  return <>
    <label className={styles.leadTrap} aria-hidden="true">
      Leave this field empty
      <input name="companyFax" tabIndex={-1} autoComplete="off" maxLength={200} />
    </label>
    {error ? <p role="alert">{error} <a href={emailHref}>Email your details to hello@getmenuman.com</a></p> : null}
    <p className={styles.formNote}>Your details are used to respond to this request. <a href={emailHref}>Prefer email?</a></p>
  </>;
}
