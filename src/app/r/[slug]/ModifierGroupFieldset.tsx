import { formatPrice, shouldShowMaxSelectionGuidance } from "@/lib/cart/cart";
import type { MenuModifierGroup } from "@/lib/cart/types";
import styles from "./menu-browser.module.css";

type ModifierGroupFieldsetProps = {
  group: MenuModifierGroup;
  currency: string;
  selectedOptionIds: ReadonlySet<string>;
  onChange: (selectedOptionIds: Set<string>) => void;
};

export default function ModifierGroupFieldset({
  group,
  currency,
  selectedOptionIds,
  onChange,
}: ModifierGroupFieldsetProps) {
  const selectedCount = group.options.filter((option) => selectedOptionIds.has(option.id)).length;
  const exactlyOne = group.minSelections === 1 && group.maxSelections === 1;
  const showMaxGuidance = shouldShowMaxSelectionGuidance(group);

  function chooseSingle(optionId: string | null) {
    const next = new Set(selectedOptionIds);
    for (const option of group.options) next.delete(option.id);
    if (optionId) next.add(optionId);
    onChange(next);
  }

  function toggleMultiple(optionId: string, checked: boolean) {
    const next = new Set(selectedOptionIds);
    if (checked) next.add(optionId);
    else next.delete(optionId);
    onChange(next);
  }

  return (
    <fieldset className={styles.modifierGroup}>
      <legend>
        <span>{group.name}</span>
        <small>
          {exactlyOne ? "Required · Choose 1" : group.minSelections > 0 ? "Required" : "Optional"}
          {showMaxGuidance ? ` · Choose up to ${group.maxSelections}` : ""}
        </small>
      </legend>
      {group.description && <p>{group.description}</p>}
      {!exactlyOne && group.maxSelections === 1 && group.minSelections === 0 && (
        <label className={styles.modifierOption}>
          <input
            type="radio"
            name={`modifier-${group.id}`}
            checked={selectedCount === 0}
            onChange={() => chooseSingle(null)}
          />
          <span>No selection</span>
        </label>
      )}
      {group.options.map((option) => {
        const selected = selectedOptionIds.has(option.id);
        const multiple = group.maxSelections > 1;
        return (
          <label className={styles.modifierOption} key={option.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={`modifier-${group.id}`}
              checked={selected}
              disabled={multiple && !selected && selectedCount >= group.maxSelections}
              onChange={(event) => {
                if (multiple) toggleMultiple(option.id, event.target.checked);
                else chooseSingle(option.id);
              }}
            />
            <span>{option.name}</span>
            <strong>{option.priceAdjustmentCents > 0 ? `+${formatPrice(option.priceAdjustmentCents, currency)}` : "Included"}</strong>
          </label>
        );
      })}
    </fieldset>
  );
}
