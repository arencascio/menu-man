"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import styles from "./menu-browser.module.css";

type SquareTokenResult = {
  status: string;
  token?: string;
};

type SquareCard = {
  attach(selector: string): Promise<void>;
  destroy(): Promise<void>;
  tokenize(verificationDetails: {
    amount: string;
    billingContact: { countryCode: "US" };
    currencyCode: string;
    intent: "CHARGE";
    customerInitiated: boolean;
    sellerKeyedIn: boolean;
  }): Promise<SquareTokenResult>;
};

type SquareNamespace = {
  payments(applicationId: string, locationId: string): Promise<{
    card(): Promise<SquareCard>;
  }>;
};

type SquarePaymentFormProps = {
  orderId: string;
  amountCents: number;
  currency: string;
  publicConfig: Record<string, unknown>;
  submitting: boolean;
  onToken: (token: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function SquarePaymentForm({
  orderId,
  amountCents,
  currency,
  publicConfig,
  submitting,
  onToken,
  onError,
}: SquarePaymentFormProps) {
  const applicationId = typeof publicConfig.applicationId === "string" ? publicConfig.applicationId : "";
  const locationId = typeof publicConfig.locationId === "string" ? publicConfig.locationId : "";
  const scriptUrl = typeof publicConfig.scriptUrl === "string" ? publicConfig.scriptUrl : "";
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const card = useRef<SquareCard | null>(null);
  const cardContainerId = `square-card-${orderId.replaceAll("-", "")}`;

  useEffect(() => {
    if (!sdkReady || card.current || !applicationId || !locationId) return;
    let active = true;
    void (async () => {
      try {
        if (!window.isSecureContext) throw new Error("Secure checkout requires HTTPS.");
        const square = (window as Window & { Square?: SquareNamespace }).Square;
        if (!square) throw new Error("Square payment fields could not be loaded.");
        const payments = await square.payments(applicationId, locationId);
        const nextCard = await payments.card();
        await nextCard.attach(`#${cardContainerId}`);
        if (!active) {
          await nextCard.destroy();
          return;
        }
        card.current = nextCard;
        setCardReady(true);
      } catch {
        onError("Secure card entry could not be loaded. Please refresh and try again.");
      }
    })();
    return () => {
      active = false;
      const mountedCard = card.current;
      card.current = null;
      if (mountedCard) void mountedCard.destroy();
    };
  }, [applicationId, cardContainerId, locationId, onError, sdkReady]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card.current || submitting) return;
    onError("");
    try {
      const tokenResult = await card.current.tokenize({
        amount: (amountCents / 100).toFixed(2),
        billingContact: { countryCode: "US" },
        currencyCode: currency,
        intent: "CHARGE",
        customerInitiated: true,
        sellerKeyedIn: false,
      });
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error("Card information could not be verified.");
      }
      await onToken(tokenResult.token);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Card information could not be verified.");
    }
  }

  if (!applicationId || !locationId || !scriptUrl) {
    return <p className={styles.formError}>Square payment configuration is unavailable.</p>;
  }

  return (
    <>
      <Script
        id="square-web-payments-sdk"
        src={scriptUrl}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() => onError("Secure card entry could not be loaded. Please refresh and try again.")}
      />
      <form className={styles.squarePaymentForm} onSubmit={(event) => void submit(event)}>
        <h2>Card details</h2>
        <p>Card information is entered securely with Square and is never sent directly to Menu Man.</p>
        <div id={cardContainerId} className={styles.squareCardContainer} aria-label="Secure card details" />
        <button className={styles.checkoutButton} type="submit" disabled={!cardReady || submitting}>
          {submitting ? "Submitting Payment…" : "Pay with Card"}
        </button>
      </form>
    </>
  );
}
