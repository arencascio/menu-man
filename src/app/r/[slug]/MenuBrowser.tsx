"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { formatPrice } from "@/lib/cart/cart";
import type { CartLine, MenuModifierGroup } from "@/lib/cart/types";
import CartPanel from "./CartPanel";
import CheckoutPanel from "./CheckoutPanel";
import type { ActivePaymentOrderSummary } from "./CheckoutPanel";
import OrderItemPanel from "./OrderItemPanel";
import useRestaurantCart from "./useRestaurantCart";
import styles from "./menu-browser.module.css";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_orderable: boolean;
  modifierGroups: MenuModifierGroup[];
};

export type MenuSection = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  items: MenuItem[];
};

type MenuBrowserProps = {
  restaurantId: string;
  restaurantSlug: string;
  menuId: string;
  currency: string | null;
  sections: MenuSection[];
  ariaLabel: string;
};

export default function MenuBrowser({
  restaurantId,
  restaurantSlug,
  menuId,
  currency,
  sections,
  ariaLabel,
}: MenuBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [hasStoredPaymentSession, setHasStoredPaymentSession] = useState(false);
  const [activePayment, setActivePayment] = useState<ActivePaymentOrderSummary | null>(null);
  const resolvedCurrency = currency || "USD";
  const cart = useRestaurantCart(restaurantId, resolvedCurrency);
  const paymentStorageKey = `menu-man:payment-session:v1:${restaurantId}`;
  const cartLocked = hasStoredPaymentSession ? activePayment?.locksCart ?? true : false;

  useEffect(() => {
    let hasStoredSession = false;
    try {
      hasStoredSession = Boolean(window.sessionStorage.getItem(paymentStorageKey));
    } catch {
      // Checkout can still start when session storage is unavailable.
    }
    void Promise.resolve().then(() => setHasStoredPaymentSession(hasStoredSession));
  }, [paymentStorageKey]);

  const handleActivePaymentChange = useCallback((nextPayment: ActivePaymentOrderSummary | null) => {
    setActivePayment(nextPayment);
    setHasStoredPaymentSession(Boolean(nextPayment));
    if (nextPayment?.locksCart) {
      setIsCartOpen(false);
      setExpandedItemId(null);
      setEditingLineId(null);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchInput.trim().toLowerCase();
      setSearch(nextSearch);
      if (nextSearch) {
        const resultCount = sections
          .filter((section) => selectedCategory === "all" || section.id === selectedCategory)
          .reduce((count, section) => count + section.items.filter((item) => [item.name, item.description || ""].join(" ").toLowerCase().includes(nextSearch)).length, 0);
        trackEvent({ name: "menu_search", restaurantId, query: nextSearch, queryLength: nextSearch.length, resultCount });
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [restaurantId, searchInput, sections, selectedCategory]);

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

  function closeExpandedItem(item: MenuItem, section: MenuSection) {
    setExpandedItemId(null);
    setEditingLineId(null);
    trackEvent({
      name: "menu_item_collapsed",
      restaurantId,
      itemId: item.id,
      itemName: item.name,
      priceCents: item.price_cents,
      sectionId: section.id,
      sectionName: section.name,
    });
  }

  function saveCartLine(line: CartLine) {
    if (cartLocked) return;
    if (editingLineId) cart.replaceLine(line);
    else cart.addLine(line);
    setExpandedItemId(null);
    setEditingLineId(null);
  }

  function editCartLine(line: CartLine) {
    if (cartLocked) return;
    const section = sections.find((candidate) => (
      candidate.id === line.sectionId
      && candidate.items.some((item) => item.id === line.menuItemId)
    )) || sections.find((candidate) => candidate.items.some((item) => item.id === line.menuItemId));
    if (!section) return;

    setIsCartOpen(false);
    setSearchInput("");
    setSearch("");
    setSelectedCategory(section.id);
    setExpandedItemId(line.menuItemId);
    setEditingLineId(line.lineId);
  }

  function openCheckout() {
    if (cartLocked) {
      setIsCheckoutOpen(true);
      setIsCartOpen(false);
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
    trackEvent({
      name: "checkout_started",
      restaurantId,
      currency: resolvedCurrency,
      valueCents: cart.subtotalCents,
      items: cart.lines.map((line) => ({
        itemId: line.menuItemId,
        itemName: line.itemName,
        priceCents: line.basePriceCents + line.selectedModifiers.reduce(
          (total, modifier) => total + modifier.priceAdjustmentCents,
          0,
        ),
        quantity: line.quantity,
      })),
    });
  }

  return (
    <main className={styles.page} aria-label={ariaLabel}>
      {activePayment && (
        <aside className={styles.activePaymentBanner} aria-live="polite">
          <div>
            <strong>Active order #{activePayment.orderNumber}</strong>
            <span>{activePayment.statusLabel} · {formatPrice(activePayment.totalCents, activePayment.currency)}</span>
            {activePayment.locksCart && <small>Menu and cart changes are paused while this order total is locked.</small>}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCheckoutOpen(true);
              setIsCartOpen(false);
            }}
          >
            Resume Payment
          </button>
        </aside>
      )}
      <div className={styles.controls}>
        <nav className={styles.categories} aria-label="Menu categories">
          <button
            className={selectedCategory === "all" ? styles.categoryActive : styles.category}
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setExpandedItemId(null);
              setEditingLineId(null);
              trackEvent({ name: "category_selected", restaurantId, sectionId: null, sectionName: "Full Menu" });
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
                setEditingLineId(null);
                trackEvent({ name: "category_selected", restaurantId, sectionId: section.id, sectionName: section.name });
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
            onChange={(event) => {
              setSearchInput(event.target.value);
              setExpandedItemId(null);
              setEditingLineId(null);
            }}
            placeholder="Search the menu..."
          />
        </label>
        <button
          className={styles.cartButton}
          type="button"
          aria-expanded={isCartOpen}
          disabled={cartLocked}
          onClick={() => {
            const willOpen = !isCartOpen;
            setIsCartOpen(willOpen);
            setIsCheckoutOpen(false);
            if (willOpen) cart.trackCartViewed();
          }}
        >
          Cart ({cart.totalQuantity}) · {formatPrice(cart.subtotalCents, resolvedCurrency)}
        </button>
      </div>

      {isCartOpen && (
        <CartPanel
          lines={cart.lines}
          currency={resolvedCurrency}
          subtotalCents={cart.subtotalCents}
          onClose={() => setIsCartOpen(false)}
          onEdit={editCartLine}
          onRemove={cart.removeLine}
          onQuantityChange={cart.setLineQuantity}
          onClear={cart.clearCart}
          onCheckout={openCheckout}
        />
      )}

      {(isCheckoutOpen || hasStoredPaymentSession) && (
        <div hidden={!isCheckoutOpen}>
          <CheckoutPanel
            restaurantId={restaurantId}
            restaurantSlug={restaurantSlug}
            menuId={menuId}
            currency={resolvedCurrency}
            lines={cart.lines}
            onBack={() => {
              setIsCheckoutOpen(false);
              setIsCartOpen(!cartLocked && cart.lines.length > 0);
            }}
            onPaymentConfirmed={cart.clearAfterOrderCreated}
            onActivePaymentChange={handleActivePaymentChange}
          />
        </div>
      )}

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

                {expandedItem && !cartLocked && (
                  <OrderItemPanel
                    key={`${expandedItem.id}:${editingLineId || "new"}`}
                    item={expandedItem}
                    sectionId={section.id}
                    sectionName={section.name}
                    currency={resolvedCurrency}
                    editingLine={cart.lines.find((line) => line.lineId === editingLineId) || null}
                    onSave={saveCartLine}
                    onClose={() => closeExpandedItem(expandedItem, section)}
                  />
                )}

                <div className={styles.grid}>
                  {section.items.map((item) => (
                    <button
                      className={`${styles.item} ${expandedItemId === item.id ? styles.itemSelected : ""}`}
                      key={item.id}
                      type="button"
                      disabled={cartLocked}
                      onClick={() => {
                        const isExpanded = expandedItemId === item.id;
                        toggleExpanded(item.id);
                        setEditingLineId(null);
                        trackEvent({
                          name: isExpanded ? "menu_item_collapsed" : "menu_item_expanded",
                          restaurantId,
                          itemId: item.id,
                          itemName: item.name,
                          priceCents: item.price_cents,
                          sectionId: section.id,
                          sectionName: section.name,
                        });
                      }}
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
                        <span className={styles.price}>{formatPrice(item.price_cents, resolvedCurrency)}</span>
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
