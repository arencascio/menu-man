// Title and description share four text lines on desktop, three on mobile.
export function descriptionLineBudget(titleLines: number, mobile: boolean) {
  return Math.max(0, (mobile ? 3 : 4) - Math.max(1, Math.ceil(titleLines)));
}
