// Cart and item dialogs can be stacked. Restore the page only after the last
// surface releases its lock, including when surfaces unmount together.
let lockCount = 0;
let snapshot: {
  scrollY: number;
  body: Pick<CSSStyleDeclaration, "position" | "top" | "width" | "overflow">;
  rootOverflow: string;
} | null = null;

export function getMenuPageScrollY() {
  return snapshot?.scrollY ?? window.scrollY;
}

export function lockMenuPageScroll(scrollY = window.scrollY) {
  if (lockCount === 0) {
    const body = document.body;
    snapshot = {
      scrollY,
      body: { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow },
      rootOverflow: document.documentElement.style.overflow,
    };
    const width = body.getBoundingClientRect().width;
    body.style.position = "fixed";
    body.style.top = `-${snapshot.scrollY}px`;
    body.style.width = `${width}px`;
    body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount || !snapshot) return;
    const saved = snapshot;
    snapshot = null;
    Object.assign(document.body.style, saved.body);
    document.documentElement.style.overflow = saved.rootOverflow;
    window.scrollTo({ top: saved.scrollY, behavior: "instant" });
  };
}
