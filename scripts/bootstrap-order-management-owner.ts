import { createClient } from "@supabase/supabase-js";
import { assertStagingSupabaseTarget } from "./staging-safety";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const target = assertStagingSupabaseTarget(process.env);
  const email = argument("email")?.toLowerCase();
  const displayName = argument("display-name");
  const restaurantSlug = argument("restaurant") ?? "armandos";
  const appOrigin = argument("app-origin");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Provide --email <owner-email>.");
  if (!displayName) throw new Error("Provide --display-name <owner-name>.");
  if (!appOrigin || !/^https:\/\//.test(appOrigin)) throw new Error("Provide an HTTPS --app-origin.");

  const admin = createClient(target.url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", restaurantSlug)
    .eq("is_active", true)
    .single();
  if (restaurantError || !restaurant) throw new Error(`Active restaurant not found: ${restaurantSlug}`);

  const redirectTo = `${appOrigin.replace(/\/$/, "")}/auth/callback?next=/manage/reset-password`;
  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invitationError || !invitation.user) {
    throw new Error(`Owner invitation failed: ${invitationError?.message ?? "No auth user returned"}`);
  }

  const { error: bootstrapError } = await admin.rpc("bootstrap_first_restaurant_owner_v1", {
    p_restaurant_id: restaurant.id,
    p_user_id: invitation.user.id,
    p_display_name: displayName,
  });
  if (bootstrapError) throw new Error(`Owner membership bootstrap failed: ${bootstrapError.message}`);
  console.info(`Invited the first owner for ${restaurantSlug} in staging.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Owner bootstrap failed.");
  process.exitCode = 1;
});
