// Only a known absent optional relation may degrade to an empty capability.
// Other database errors must remain visible to the caller.
export function isMissingOptionalRelation(
  error: { code?: string; message?: string } | null,
  relation: string,
) {
  if (!error || !["PGRST205", "42P01"].includes(error.code ?? "")) return false;
  return Boolean(error.message?.includes(`public.${relation}`) || error.message?.includes(`"${relation}"`));
}
