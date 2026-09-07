"use client";

import { useEffect, useState } from "react";
import styles from "./menu-browser.module.css";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
};

export type MenuSection = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  items: MenuItem[];
};

type MenuBrowserProps = {
  currency: string | null;
  sections: MenuSection[];
  ariaLabel: string;
};

function formatPrice(priceCents: number, currency: string | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(priceCents / 100);
}

export default function MenuBrowser({
  currency,
  sections,
  ariaLabel,
}: MenuBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
      setExpandedItemId(null);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const visibleSections = sections
    .filter((section) => selectedCategory === "all" || section.id === selectedCategory)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!search) return true;
        return [item.name, item.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(search);
      }),
    }))
    .filter((section) => section.items.length > 0);

  function toggleExpanded(itemId: string) {
    setExpandedItemId((current) => (current === itemId ? null : itemId));
  }

  return (
    <main className={styles.page} aria-label={ariaLabel}>
      <div className={styles.controls}>
        <nav className={styles.categories} aria-label="Menu categories">
          <button
            className={selectedCategory === "all" ? styles.categoryActive : styles.category}
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setExpandedItemId(null);
            }}
            aria-pressed={selectedCategory === "all"}
          >
            Full Menu
          </button>
          {sections.map((section) => (
            <button
              className={selectedCategory === section.id ? styles.categoryActive : styles.category}
              key={section.id}
              type="button"
              onClick={() => {
                setSelectedCategory(section.id);
                setExpandedItemId(null);
              }}
              aria-pressed={selectedCategory === section.id}
            >
              {section.name}
            </button>
          ))}
        </nav>
        <label className={styles.search}>
          <span className={styles.visuallyHidden}>Search menu</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search the menu..."
          />
        </label>
      </div>

      <div className={styles.menu}>
        {visibleSections.length > 0 ? (
          visibleSections.map((section) => {
            const expandedItem = section.items.find((item) => item.id === expandedItemId);

            return (
              <section className={styles.section} key={section.id}>
                <div className={styles.sectionHeading}>
                  <h2>{section.name}</h2>
                  {section.description && <p>{section.description}</p>}
                </div>

                {expandedItem && (
                  <article className={styles.expandedItem}>
                    <div className={styles.expandedContent}>
                      <p className={styles.expandedLabel}>Selected dish</p>
                      <h3>{expandedItem.name}</h3>
                      {expandedItem.description && <p>{expandedItem.description}</p>}
                    </div>
                    <div className={styles.expandedPrice}>
                      {formatPrice(expandedItem.price_cents, currency)}
                      <button type="button" onClick={() => toggleExpanded(expandedItem.id)}>
                        Close
                      </button>
                    </div>
                  </article>
                )}

                <div className={styles.grid}>
                  {section.items.map((item) => (
                    <button
                      className={`${styles.item} ${expandedItemId === item.id ? styles.itemSelected : ""}`}
                      key={item.id}
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      aria-expanded={expandedItemId === item.id}
                    >
                      <span className={styles.image}>
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
                        ) : (
                          <span className={styles.placeholder}>{item.name.charAt(0)}</span>
                        )}
                      </span>
                      <span className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.price}>{formatPrice(item.price_cents, currency)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <p className={styles.empty}>No dishes match your search.</p>
        )}
      </div>
    </main>
  );
}