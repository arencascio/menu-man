// Existing MenuBrowser consumes ?item= on load, using the normal order dialog.
export function getGalleryPickupHref(menuHref: string, itemId: string) {
  return `${menuHref}?item=${encodeURIComponent(itemId)}`;
}
