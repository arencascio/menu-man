"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/client";
import { formatPrice } from "@/lib/cart/cart";
import type { CartLine, MenuModifierGroup } from "@/lib/cart/types";
import { paymentStatusSchema } from "@/lib/payments/contracts";
import {
  activeOrderStorageKey,
  checkoutBroadcastChannelName,
  loadActiveOrderMarker,
  removeActiveOrderMarker,
  saveActiveOrderMarker,
} from "@/lib/payments/browser-session";
import { getCustomerPaymentStatusLabel, paymentLocksCart } from "@/lib/payments/state";
import CartPanel from "./CartPanel";
import { getMenuSectionAnchorId } from "./menu-section-anchor";
import { canAddMenuItemDirectly, createDirectCartLine } from "./menu-card-ordering";
import MenuCardImage from "./MenuCardImage";
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
  currency: string | null;
  sections: MenuSection[];
  initialHeartCounts: Record<string, number>;
  ariaLabel: string;
  initialActivePayment: {
    orderId: string;
    orderNumber: string;
    statusLabel: string;
    locksCart: true;
  } | null;
};

export default function MenuBrowser({
  restaurantId,
  restaurantSlug,
  currency,
  sections,
  initialHeartCounts,
  ariaLabel,
  initialActivePayment,
}: MenuBrowserProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [visibleCategory, setVisibleCategory] = useState("all");
  const [compactControls, setCompactControls] = useState(false);
  const [categoryEdges, setCategoryEdges] = useState({ left: false, right: false });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedItem, setExpandedItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(84);
  const [controlsHeight, setControlsHeight] = useState(120);
  const controlsRef = useRef<HTMLDivElement>(null);
  const controlsAnchorRef = useRef<HTMLSpanElement>(null);
  const categoriesRef = useRef<HTMLElement>(null);
  const categoryButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const followActiveCategoryRef = useRef(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const restorePositionRef = useRef<{ sectionId: string; itemId: string; top: number; scrollY: number } | null>(null);
  const searchId = useId();
  const detailRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [likedItemIds, setLikedItemIds] = useState<string[]>([]);
  const [heartCounts, setHeartCounts] = useState(initialHeartCounts);
  const [pendingHearts, setPendingHearts] = useState<string[]>([]);
  const [activePayment, setActivePayment] = useState<{
    orderId: string;
    orderNumber: string;
    statusLabel: string;
    locksCart: boolean;
  } | null>(initialActivePayment);
  const resolvedCurrency = currency || "USD";
  const cart = useRestaurantCart(restaurantId, resolvedCurrency);
  const cartLocked = Boolean(activePayment?.locksCart);
  const hasActiveSurface = Boolean(expandedItem || isCartOpen);
  const activeCategory = selectedCategory === "all" ? visibleCategory : selectedCategory;
  const activeCategoryRef = useRef(activeCategory);
  useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);
  const ensureActiveCategoryVisible = useCallback((categoryId: string, behavior: ScrollBehavior) => {
    const categories = categoriesRef.current;
    const button = categoryButtonsRef.current.get(categoryId);
    if (!categories || !button) return;
    const strip = categories.getBoundingClientRect();
    const active = button.getBoundingClientRect();
    const inset = window.innerWidth > 760 ? 42 : 12;
    const delta = active.left < strip.left + inset
      ? active.left - strip.left - inset
      : active.right > strip.right - inset ? active.right - strip.right + inset : 0;
    if (delta) categories.scrollBy({ left: delta, behavior });
  }, []);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-restaurant-header]");
    const controls = controlsRef.current;
    if (!header || !controls) return;
    const measure = () => {
      setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
      if (controls.getBoundingClientRect().height > 0) setControlsHeight(Math.ceil(controls.getBoundingClientRect().height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    const anchor = controlsAnchorRef.current;
    const header = document.querySelector<HTMLElement>("[data-restaurant-header]");
    if (!controls || !anchor) return;
    const controlsTop = anchor.getBoundingClientRect().top + window.scrollY;
    const compactAt = Math.max(0, controlsTop + controls.offsetHeight - (header?.offsetHeight ?? 0) - 24);
    const update = () => setCompactControls(window.scrollY > compactAt);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const categories = categoriesRef.current;
    if (!categories) return;
    const update = () => {
      const lastScroll = categories.scrollWidth - categories.clientWidth;
      const left = categories.scrollLeft > 2;
      const right = categories.scrollLeft < lastScroll - 2;
      setCategoryEdges((current) => current.left === left && current.right === right ? current : { left, right });
      if (followActiveCategoryRef.current && categories.clientWidth > 0) {
        ensureActiveCategoryVisible(activeCategoryRef.current, "auto");
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(categories);
    window.addEventListener("resize", update);
    categories.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      categories.removeEventListener("scroll", update);
    };
  }, [sections, ensureActiveCategoryVisible]);

  useEffect(() => {
    ensureActiveCategoryVisible(activeCategory, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  }, [activeCategory, compactControls, ensureActiveCategoryVisible]);

  useLayoutEffect(() => {
    const target = isCartOpen ? cartRef.current : expandedItem ? detailRef.current : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [expandedItem, isCartOpen]);

  useLayoutEffect(() => {
    if (expandedItem || !restorePositionRef.current) return;
    const origin = restorePositionRef.current;
    restorePositionRef.current = null;
    const card = cardRefs.current.get(`${origin.sectionId}:${origin.itemId}`);
    if (!card) return;
    window.scrollTo({ top: origin.scrollY, behavior: "instant" });
    window.scrollBy({ top: card.getBoundingClientRect().top - origin.top, behavior: "instant" });
    card.focus({ preventScroll: true });
  }, [expandedItem]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/hearts`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { likedItemIds?: string[] } | null) => { if (active && data?.likedItemIds) setLikedItemIds(data.likedItemIds); });
    return () => { active = false; };
  }, [restaurantSlug]);

  async function toggleHeart(itemId: string) {
    if (pendingHearts.includes(itemId)) return;
    const liked = !likedItemIds.includes(itemId);
    setPendingHearts((current) => [...current, itemId]);
    try {
      const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantSlug)}/hearts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, liked }),
      });
      if (!response.ok) return;
      const result = await response.json() as { count: number };
      setLikedItemIds((current) => liked ? [...current.filter((id) => id !== itemId), itemId] : current.filter((id) => id !== itemId));
      setHeartCounts((current) => ({ ...current, [itemId]: result.count }));
      router.refresh();
    } catch {
      // Keep the last confirmed state; a later click can retry.
    } finally {
      setPendingHearts((current) => current.filter((id) => id !== itemId));
    }
  }

  useEffect(() => {
    if (!initialActivePayment || loadActiveOrderMarker(window.localStorage, restaurantId)) return;
    saveActiveOrderMarker(window.localStorage, {
      version: 1,
      restaurantId,
      restaurantSlug,
      orderId: initialActivePayment.orderId,
      orderNumber: initialActivePayment.orderNumber,
      cartFingerprint: "",
    });
  }, [initialActivePayment, restaurantId, restaurantSlug]);

  const refreshActivePayment = useCallback(async () => {
    const marker = loadActiveOrderMarker(window.localStorage, restaurantId);
    if (!marker || marker.restaurantSlug !== restaurantSlug) {
      setActivePayment(null);
      return;
    }
    setActivePayment({
      orderId: marker.orderId,
      orderNumber: marker.orderNumber,
      statusLabel: "Checking payment status",
      locksCart: true,
    });
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(marker.orderId)}/payment-status`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          removeActiveOrderMarker(window.localStorage, restaurantId);
          setActivePayment(null);
        }
        return;
      }
      const payment = paymentStatusSchema.parse(await response.json());
      if (!paymentLocksCart(payment)) {
        if (payment.orderStatus === "placed" && ["paid", "partially_refunded", "refunded"].includes(payment.paymentStatus)) {
          await cart.clearIfFingerprintMatches(marker.cartFingerprint);
        }
        removeActiveOrderMarker(window.localStorage, restaurantId);
        setActivePayment(null);
        return;
      }
      setActivePayment({
        orderId: marker.orderId,
        orderNumber: marker.orderNumber,
        statusLabel: getCustomerPaymentStatusLabel(payment),
        locksCart: true,
      });
      setIsCartOpen(false);
      setExpandedItem(null);
      setEditingLineId(null);
    } catch {
      // Keep the conservative lock until an authoritative refresh succeeds.
    }
  }, [cart, restaurantId, restaurantSlug]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshActivePayment(), 0);
    function handleStorage(event: StorageEvent) {
      if (event.key === activeOrderStorageKey(restaurantId)) void refreshActivePayment();
    }
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(checkoutBroadcastChannelName(restaurantId));
    const handleMessage = () => void refreshActivePayment();
    const interval = window.setInterval(() => void refreshActivePayment(), 5_000);
    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleMessage);
      channel?.close();
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refreshActivePayment, restaurantId]);

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

  const visibleSections = useMemo(() => sections
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
    .filter((section) => section.items.length > 0), [sections, selectedCategory, search]);
  const visibleItemCount = visibleSections.reduce((total, section) => total + section.items.length, 0);
  const showResultCount = Boolean(search || selectedCategory !== "all");

  useEffect(() => {
    if (selectedCategory !== "all" || hasActiveSurface) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const cutoff = headerHeight + (controlsRef.current?.getBoundingClientRect().height || controlsHeight) + 20;
      let current = "all";
      for (const section of visibleSections) {
        const heading = document.getElementById(getMenuSectionAnchorId(section.id));
        if (heading && heading.getBoundingClientRect().top <= cutoff) current = section.id;
      }
      setVisibleCategory(current);
      ensureActiveCategoryVisible(current, "auto");
    };
    const schedule = () => {
      followActiveCategoryRef.current = true;
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [selectedCategory, hasActiveSurface, headerHeight, controlsHeight, visibleSections, compactControls, ensureActiveCategoryVisible]);

  function rememberItemPosition(sectionId: string, itemId: string) {
    const card = cardRefs.current.get(`${sectionId}:${itemId}`);
    if (card) restorePositionRef.current = { sectionId, itemId, top: card.getBoundingClientRect().top, scrollY: window.scrollY };
  }

  function openItem(item: MenuItem, section: MenuSection) {
    const isExpanded = expandedItem?.itemId === item.id && expandedItem.sectionId === section.id;
    if (!isExpanded) rememberItemPosition(section.id, item.id);
    setExpandedItem(isExpanded ? null : { sectionId: section.id, itemId: item.id });
    setIsCartOpen(false);
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
  }

  function addFromCard(item: MenuItem, section: MenuSection) {
    if (cartLocked || !item.is_orderable) return;
    if (!canAddMenuItemDirectly(item)) {
      openItem(item, section);
      return;
    }
    cart.addLine(createDirectCartLine(item, section, crypto.randomUUID()));
  }

  function selectCategory(section: MenuSection | null) {
    restorePositionRef.current = null;
    followActiveCategoryRef.current = true;
    setSelectedCategory(section?.id ?? "all");
    setExpandedItem(null);
    setEditingLineId(null);
    setIsCartOpen(false);
    trackEvent({ name: "category_selected", restaurantId, sectionId: section?.id ?? null, sectionName: section?.name ?? "Full Menu" });
  }

  function closeExpandedItem(item: MenuItem, section: MenuSection) {
    setExpandedItem(null);
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
    setExpandedItem(null);
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
    setExpandedItem({ sectionId: section.id, itemId: line.menuItemId });
    setEditingLineId(line.lineId);
  }

  function openCheckout() {
    if (cartLocked) {
      setIsCartOpen(false);
      if (activePayment) {
        router.push(`/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(activePayment.orderId)}/payment`);
      }
      return;
    }
    setIsCartOpen(false);
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
    router.push(`/r/${encodeURIComponent(restaurantSlug)}/checkout`);
  }

  function scrollCategories(direction: -1 | 1) {
    const categories = categoriesRef.current;
    if (!categories) return;
    followActiveCategoryRef.current = false;
    categories.scrollBy({
      left: direction * Math.max(180, Math.round(categories.clientWidth * .65)),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <main className={styles.page} aria-label={ariaLabel} style={{
      "--menu-header-height": `${headerHeight}px`,
      "--menu-controls-height": `${controlsHeight}px`,
    } as CSSProperties}>
      {activePayment && (
        <aside className={styles.activePaymentBanner} aria-live="polite">
          <div>
            <strong>Active order #{activePayment.orderNumber}</strong>
            <span>{activePayment.statusLabel}</span>
            {activePayment.locksCart && <small>Menu and cart changes are paused while this order total is locked.</small>}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCartOpen(false);
              router.push(`/r/${encodeURIComponent(restaurantSlug)}/order/${encodeURIComponent(activePayment.orderId)}/payment`);
            }}
          >
            Resume Payment
          </button>
        </aside>
      )}
      <span ref={controlsAnchorRef} className={styles.controlsAnchor} aria-hidden="true" />
      <div ref={controlsRef} className={`${styles.controls} ${compactControls ? styles.controlsCompact : ""} ${hasActiveSurface ? styles.controlsInactive : ""}`}>
        <div className={styles.categoryNav}>
          {categoryEdges.left && <button className={`${styles.categoryArrow} ${styles.categoryArrowLeft}`} type="button" aria-label="Scroll categories left" onClick={() => scrollCategories(-1)}>‹</button>}
          <nav ref={categoriesRef} className={styles.categories} aria-label="Menu categories" onPointerDown={() => { followActiveCategoryRef.current = false; }} onTouchStart={() => { followActiveCategoryRef.current = false; }} onWheel={(event) => { if (event.deltaX) followActiveCategoryRef.current = false; }}>
          <button
            className={activeCategory === "all" ? styles.categoryActive : styles.category}
            ref={(node) => { if (node) categoryButtonsRef.current.set("all", node); else categoryButtonsRef.current.delete("all"); }}
            type="button"
            onClick={() => selectCategory(null)}
            aria-pressed={activeCategory === "all"}
          >
            Full Menu
          </button>
          {sections.map((section) => (
            <button
              className={activeCategory === section.id ? styles.categoryActive : styles.category}
              ref={(node) => { if (node) categoryButtonsRef.current.set(section.id, node); else categoryButtonsRef.current.delete(section.id); }}
              key={section.id}
              type="button"
              onClick={() => selectCategory(section)}
              aria-pressed={activeCategory === section.id}
            >
              {section.name}
            </button>
          ))}
          </nav>
          {categoryEdges.right && <button className={`${styles.categoryArrow} ${styles.categoryArrowRight}`} type="button" aria-label="Scroll categories right" onClick={() => scrollCategories(1)}>›</button>}
        </div>
        <div className={styles.search}>
          <label className={styles.visuallyHidden} htmlFor={searchId}>Search menu</label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={searchInput}
            onChange={(event) => {
              restorePositionRef.current = null;
              setSearchInput(event.target.value);
              setExpandedItem(null);
              setEditingLineId(null);
            }}
            placeholder="Search the menu..."
          />
          {searchInput && <button className={styles.searchClear} type="button" aria-label="Clear search" onClick={() => {
            restorePositionRef.current = null;
            setSearchInput("");
            setSearch("");
            searchRef.current?.focus();
          }}>×</button>}
        </div>
        <button
          className={styles.cartButton}
          type="button"
          aria-expanded={isCartOpen}
          disabled={cartLocked}
          onClick={() => {
            const willOpen = !isCartOpen;
            setIsCartOpen(willOpen);
            if (willOpen) {
              restorePositionRef.current = null;
              setExpandedItem(null);
              setEditingLineId(null);
              cart.trackCartViewed();
            }
          }}
        >
          Cart ({cart.totalQuantity}) · {formatPrice(cart.subtotalCents, resolvedCurrency)}
        </button>
        {showResultCount && <p className={styles.resultCount} aria-live="polite">{visibleItemCount === 0 ? "No results" : `${visibleItemCount} ${visibleItemCount === 1 ? "result" : "results"}`}</p>}
      </div>

      <div className={styles.menu}>
        {isCartOpen && <div ref={cartRef} className={styles.cartSlot}>
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
        </div>}
        {visibleSections.length > 0 ? (
          visibleSections.map((section) => {
            return (
              <section className={styles.section} key={section.id}>
                <div id={getMenuSectionAnchorId(section.id)} className={`${styles.sectionHeading} ${section.id === "featured" ? styles.sectionHeadingFeatured : section.id === "favorites" ? styles.sectionHeadingFavorites : ""}`}>
                  <h2>{section.name}</h2>
                  {section.description && <p>{section.description}</p>}
                </div>

                <div className={styles.grid}>
                  {section.items.map((item, index) => {
                    const isExpanded = expandedItem?.sectionId === section.id && expandedItem.itemId === item.id;
                    const priorityImage = section === visibleSections[0] && index < 2;
                    return <div className={styles.itemUnit} key={item.id}>
                    <div className={styles.itemCard}>
                    <button
                      className={`${styles.item} ${isExpanded ? styles.itemSelected : ""}`}
                      ref={(node) => {
                        const key = `${section.id}:${item.id}`;
                        if (node) cardRefs.current.set(key, node);
                        else cardRefs.current.delete(key);
                      }}
                      type="button"
                      disabled={cartLocked}
                      onClick={() => openItem(item, section)}
                      aria-expanded={isExpanded}
                    >
                      <MenuCardImage name={item.name} url={item.image_url} priority={priorityImage} />
                      <span className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.price}>{formatPrice(item.price_cents, resolvedCurrency)}</span>
                        {item.description && <span className={styles.itemDescription}>{item.description}</span>}
                        {!item.is_orderable && <span className={styles.cardAvailability}>Not available for online ordering</span>}
                      </span>
                    </button>
                    <button
                      className={styles.heartButton}
                      type="button"
                      aria-label={`${likedItemIds.includes(item.id) ? "Unlike" : "Like"} ${item.name}`}
                      aria-pressed={likedItemIds.includes(item.id)}
                      disabled={pendingHearts.includes(item.id)}
                      onClick={() => void toggleHeart(item.id)}
                    >
                      <span aria-hidden="true">{likedItemIds.includes(item.id) ? "♥" : "♡"}</span>
                      {heartCounts[item.id] ? <span>{heartCounts[item.id]}</span> : null}
                    </button>
                    {item.is_orderable && <button className={styles.cardAddButton} type="button" aria-label={`Add ${item.name} to cart`} disabled={cartLocked} onClick={() => addFromCard(item, section)}><span aria-hidden="true">+</span></button>}
                    </div>
                    {isExpanded && !cartLocked && <div ref={detailRef} className={styles.detailSlot}>
                      <OrderItemPanel
                        key={`${item.id}:${editingLineId || "new"}`}
                        item={item}
                        sectionId={section.id}
                        sectionName={section.name}
                        currency={resolvedCurrency}
                        editingLine={cart.lines.find((line) => line.lineId === editingLineId) || null}
                        onSave={saveCartLine}
                        onClose={() => closeExpandedItem(item, section)}
                        liked={likedItemIds.includes(item.id)}
                        heartCount={heartCounts[item.id] ?? 0}
                        heartPending={pendingHearts.includes(item.id)}
                        onHeart={() => void toggleHeart(item.id)}
                      />
                    </div>}
                    </div>;
                  })}
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
