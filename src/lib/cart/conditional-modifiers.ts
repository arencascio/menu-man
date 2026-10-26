import type { CartModifierSelection, MenuModifierGroup } from "./types";

export function activeCartModifiers(selections: readonly CartModifierSelection[]) {
  return selections.filter((selection) => !selection.visibleWhen || selections.some((parent) =>
    !parent.visibleWhen && parent.modifierGroupId === selection.visibleWhen!.groupId
    && parent.modifierOptionId === selection.visibleWhen!.optionId));
}

/** Invalid relationships fail closed rather than silently becoming flat groups. */
export function assertModifierConditions(groups: readonly MenuModifierGroup[]) {
  for (const group of groups) {
    if (!group.visibleWhen) continue;
    const parent = groups.find((candidate) => candidate.id === group.visibleWhen!.groupId);
    if (!parent || parent === group || parent.visibleWhen
      || !parent.options.some((option) => option.id === group.visibleWhen!.optionId)) {
      throw new Error("Conditional modifiers require an available root option on the same item.");
    }
  }
}

export function isModifierGroupActive(group: MenuModifierGroup, selected: ReadonlySet<string>) {
  return !group.visibleWhen || selected.has(group.visibleWhen.optionId);
}

export function activeModifierOptionIds(groups: readonly MenuModifierGroup[], selected: ReadonlySet<string>) {
  assertModifierConditions(groups);
  return new Set(groups.filter((group) => isModifierGroupActive(group, selected))
    .flatMap((group) => group.options.filter((option) => selected.has(option.id)).map((option) => option.id)));
}

/** Apply valid explicit child defaults only on activation, never on cart restoration. */
export function transitionModifierOptionIds(
  groups: readonly MenuModifierGroup[], previous: ReadonlySet<string>, next: ReadonlySet<string>,
) {
  const active = activeModifierOptionIds(groups, next);
  for (const group of groups) {
    if (!group.visibleWhen || !isModifierGroupActive(group, active) || isModifierGroupActive(group, previous)) continue;
    const defaults = group.options.filter((option) => option.isDefault);
    if (defaults.length >= group.minSelections && defaults.length <= group.maxSelections) {
      for (const option of defaults) active.add(option.id);
    }
  }
  return active;
}
