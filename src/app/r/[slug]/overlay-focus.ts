import type { KeyboardEvent } from "react";

export function containOverlayFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  event.stopPropagation();
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']")]
    .filter((element) => element.getClientRects().length > 0);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
