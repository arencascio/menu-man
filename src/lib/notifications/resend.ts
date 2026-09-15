export type ResendEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type ResendDeliveryResult = {
  succeeded: boolean;
  retryable: boolean;
  httpStatus: number | null;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export function isRetryableResendFailure(status: number | null, code: string | null) {
  if (status === null || status === 408 || status === 425 || status === 429 || status >= 500) return true;
  return status === 409 && code === "concurrent_idempotent_requests";
}

export async function sendResendEmail(
  apiKey: string,
  email: ResendEmail,
  fetcher: typeof fetch = fetch,
): Promise<ResendDeliveryResult> {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.ok && typeof body.id === "string") {
      return { succeeded: true, retryable: false, httpStatus: response.status,
        providerMessageId: body.id, errorCode: null, errorMessage: null };
    }
    const code = typeof body.name === "string" ? body.name
      : typeof body.code === "string" ? body.code : "resend_request_failed";
    return { succeeded: false, retryable: isRetryableResendFailure(response.status, code),
      httpStatus: response.status, providerMessageId: null, errorCode: code,
      errorMessage: `Resend returned HTTP ${response.status}.` };
  } catch (error) {
    return { succeeded: false, retryable: true, httpStatus: null,
      providerMessageId: null, errorCode: "network_error",
      errorMessage: error instanceof Error ? "The Resend request failed before a response." : "Email delivery failed." };
  }
}
