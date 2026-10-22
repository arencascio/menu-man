const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function pacificInput(instant: string | null): string {
  if (!instant) return "";
  const parts = Object.fromEntries(pacific.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function pacificToUtc(value: string, original: string | null = null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Enter a valid Pacific date and time.");
  // Keep an unchanged instant during the repeated hour when daylight saving ends.
  if (original && pacificInput(original) === value) return original;
  const matches = ["-07:00", "-08:00"].map(offset => new Date(`${value}:00${offset}`))
    .filter(date => Number.isFinite(date.getTime()) && pacificInput(date.toISOString()) === value);
  if (matches.length !== 1) throw new Error(matches.length ? "This Pacific time occurs twice. Choose another time." : "This Pacific time does not exist. Choose another time.");
  return matches[0].toISOString();
}
