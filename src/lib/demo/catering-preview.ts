export type CateringPreviewChoice = { label: string; options: readonly string[]; defaultValue?: string };

export function getCateringChoiceValue(choice: CateringPreviewChoice, selection?: string) {
  if (selection && choice.options.includes(selection)) return selection;
  return choice.defaultValue && choice.options.includes(choice.defaultValue) ? choice.defaultValue : choice.options[0] ?? "";
}

export function getCateringRequestSelections(choices: readonly CateringPreviewChoice[], selections: Record<string, string> = {}) {
  return choices.map((choice) => `${choice.label}: ${getCateringChoiceValue(choice, selections[choice.label])}`).join(" · ");
}
