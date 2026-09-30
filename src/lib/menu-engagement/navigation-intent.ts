export type MenuNavigationIntent =
  | { kind: "idle" }
  | { kind: "search" }
  | { kind: "menu-start" }
  | { kind: "section"; sectionId: string };

export function searchIntent(): MenuNavigationIntent { return { kind: "search" }; }
export function clearSearchIntent(sectionId?: string): MenuNavigationIntent {
  return sectionId ? { kind: "section", sectionId } : { kind: "menu-start" };
}
export function consumeNavigationIntent(): MenuNavigationIntent {
  return { kind: "idle" };
}
