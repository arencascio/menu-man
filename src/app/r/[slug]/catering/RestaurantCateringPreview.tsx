"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { getCateringChoiceValue, getCateringRequestSelections, type CateringPreviewChoice } from "@/lib/demo/catering-preview";
import RestaurantHero from "../RestaurantHero";
import styles from "./restaurant-catering-preview.module.css";

type PackageChoice = CateringPreviewChoice;
export type RestaurantCateringPreviewContent = {
  heading: string; description: string; imageUrl: string; imageAlt: string;
  packages: readonly { id: string; name: string; priceCents: number; serves: string; description: string; includes: readonly string[]; choices: readonly PackageChoice[]; imageUrl: string; imageAlt: string }[];
  steps: readonly { title: string; description: string }[];
};

// All request details stay in this component. No action, storage, or network submission.
export default function RestaurantCateringPreview({ content, restaurantId, name, menuHref }: {
  content: RestaurantCateringPreviewContent; restaurantId: string; name: string; menuHref: string;
}) {
  const [selectedId, setSelectedId] = useState(content.packages[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, Record<string, string>>>({});
  const requestHeading = useRef<HTMLHeadingElement>(null);
  const selected = content.packages.find((item) => item.id === selectedId);
  const price = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

  function selectChoice(packageId: string, label: string, value: string) {
    setChoices((current) => ({ ...current, [packageId]: { ...current[packageId], [label]: value } }));
  }
  function requestPackage(packageId: string) {
    setSelectedId(packageId);
    const headerHeight = document.querySelector("[data-restaurant-header]")?.getBoundingClientRect().height ?? 0;
    requestHeading.current?.style.setProperty("--catering-header-offset", `${headerHeight}px`);
    requestHeading.current?.focus({ preventScroll: true });
    requestHeading.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function choiceFields(packageId: string, fields: readonly PackageChoice[]) {
    return fields.map((choice) => <label key={choice.label}>{choice.label}<select aria-label={choice.label} value={getCateringChoiceValue(choice, choices[packageId]?.[choice.label])} onChange={(event) => selectChoice(packageId, choice.label, event.target.value)}>{choice.options.map((option) => <option key={option}>{option}</option>)}</select></label>);
  }

  return <main className={styles.page}>
    <RestaurantHero name={name} restaurantId={restaurantId} logoUrl={null} imageUrl={content.imageUrl} presentation={{
      layout: "photo-split", eyebrow: "Catering showcase", eyebrowIcon: "handPlatter", headline: content.heading, supportingText: content.description,
      imageAlt: content.imageAlt, primaryAction: { label: "Explore the sample spreads", href: "#sample-spreads" },
    }} />
    <section className={styles.packages} id="sample-spreads" aria-labelledby="catering-spreads-title">
      <div className={styles.heading}><p className={styles.eyebrow}>Made for the middle of the table</p><h2 id="catering-spreads-title">A spread for every kind of get-together.</h2>
        <p>Sample packages and prices for this fictional showcase. Not available to book or order. Taxes, delivery and service are not included in these examples.</p></div>
      {content.packages.map((item) => <article className={styles.package} key={item.id}>
        <div className={styles.photo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.imageAlt} loading="lazy" width={800} height={600} />
        </div>
        <div className={styles.packageCopy}><p className={styles.number}>{item.serves}</p><h3>{item.name}</h3><p className={styles.price}>{price(item.priceCents)} <small>sample package price</small></p><p>{item.description}</p><ul>{item.includes.map((line) => <li key={line}>{line}</li>)}</ul>
          <fieldset className={styles.selections}><legend>Make it yours — all choices included in the sample price</legend>{choiceFields(item.id, item.choices)}</fieldset>
          <button className={styles.requestButton} type="button" onClick={() => requestPackage(item.id)} aria-label={`Request catering: ${item.name}`}>Request catering <span aria-hidden="true">&#8599;</span></button>
        </div>
      </article>)}
    </section>
    <section className={styles.request} aria-labelledby="catering-request-title">
      <div className={styles.heading}><p className={styles.eyebrow}>Plan something delicious</p><h2 id="catering-request-title" ref={requestHeading} tabIndex={-1}>Your gathering, your way.</h2><p>Try the request experience. Details stay on this page and cannot be sent. This preview does not create an inquiry or confirm a booking.</p></div>
      <form onSubmit={(event) => event.preventDefault()} className={styles.requestForm} aria-label="Illustrative catering request">
        <div className={styles.context} aria-live="polite"><strong>{selected?.name}</strong><p>{selected ? `${price(selected.priceCents)} sample package · ${selected.serves}` : "Choose a package"}</p><p>{selected ? getCateringRequestSelections(selected.choices, choices[selected.id]) : null}</p></div>
        <label className={styles.wide}>Package<select aria-label="Package" name="package" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{content.packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {selected ? choiceFields(selected.id, selected.choices) : null}
        <label>Your name<input name="name" autoComplete="name" /></label><label>Email<input name="email" type="email" autoComplete="email" /></label>
        <label>Event date<input name="eventDate" type="date" /></label><label>Guest count<input name="guests" type="number" min="1" max="500" inputMode="numeric" /></label>
        <label className={styles.wide}>Anything else?<textarea name="notes" rows={3} placeholder="Occasion, dietary preferences, or questions" /></label>
        <div className={styles.wide}><button className={styles.requestButton} type="submit" disabled aria-describedby="catering-send-note">Send request — unavailable in preview</button><p className={styles.formNote} id="catering-send-note">Nothing is submitted or saved. No booking is made.</p></div>
      </form>
    </section>
    <section className={styles.process} aria-labelledby="catering-process-title">
      <p className={styles.eyebrow}>An example of the experience</p><h2 id="catering-process-title">From a good idea to a great gathering.</h2>
      <ol>{content.steps.map((step) => <li key={step.title}><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
      <aside className={styles.unavailable} aria-labelledby="catering-unavailable-title"><div><h3 id="catering-unavailable-title">Just a taste of what&apos;s possible.</h3><p>Catering is not available in this showcase. Inquiries, reservations, and catering orders cannot be submitted here.</p></div><Link href={menuHref}>Browse the restaurant menu <span aria-hidden="true">&#8599;</span></Link></aside>
    </section>
  </main>;
}
