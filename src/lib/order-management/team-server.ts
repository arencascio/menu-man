import "server-only";

import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import {
  restaurantAccessEventSchema,
  restaurantTeamMemberSchema,
  type ManagementCapability,
  type RestaurantAccessEvent,
  type RestaurantTeamMember,
} from "./contracts";
import { authenticatedClient, ManagementError, rpcError } from "./server";

type Assignment = {
  displayName: string;
  role: "owner" | "manager" | "staff";
  capabilities: ManagementCapability[];
  clientActionId: string;
};

function mapTeamMember(row: Record<string, unknown>) {
  return restaurantTeamMemberSchema.parse({
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.member_role,
    status: row.member_status,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
    membershipCreatedAt: row.membership_created_at,
    revokedAt: row.revoked_at,
    capabilities: row.capabilities,
    roleDefaultCapabilities: row.role_default_capabilities,
  });
}

export async function listRestaurantTeam(slug: string): Promise<RestaurantTeamMember[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("list_restaurant_team_v1", {
    p_restaurant_slug: slug,
  });
  if (error) throw rpcError(error);
  return (data ?? []).map((row: Record<string, unknown>) => mapTeamMember(row));
}

export async function listRestaurantAccessEvents(slug: string): Promise<RestaurantAccessEvent[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("list_restaurant_access_events_v1", {
    p_restaurant_slug: slug,
    p_limit: 50,
  });
  if (error) throw rpcError(error);
  return (data ?? []).map((row: Record<string, unknown>) => restaurantAccessEventSchema.parse({
    eventId: row.event_id,
    targetMembershipId: row.target_membership_id,
    targetDisplayName: row.target_display_name,
    actorDisplayName: row.actor_display_name,
    action: row.action,
    previousState: row.previous_state,
    nextState: row.next_state,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[team-auth]", { stage: "list_users_failed", name: error.name, message: error.message });
      throw new ManagementError("UNAVAILABLE", "Restaurant invitations are temporarily unavailable.");
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new ManagementError("UNAVAILABLE", "The Auth directory is too large for this invitation lookup.");
}

export async function inviteRestaurantMember(
  slug: string,
  input: Assignment & { email: string },
  origin: string,
) {
  const client = await authenticatedClient();
  const preflight = await client.rpc("authorize_restaurant_member_invite_v1", {
    p_restaurant_slug: slug,
    p_role: input.role,
    p_capabilities: input.capabilities,
  });
  if (preflight.error) throw rpcError(preflight.error);

  let user = await findAuthUserByEmail(input.email);
  let existingAuthUser = Boolean(user);
  let invitationSent = false;
  if (!user) {
    const { data, error } = await supabaseServer.auth.admin.inviteUserByEmail(input.email, {
      data: { display_name: input.displayName },
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/manage/reset-password")}`,
    });
    if (error || !data.user) {
      // A concurrent request may have created the same Auth user after our
      // directory lookup. Recover that identity and let the DB idempotency and
      // unique restaurant membership decide the result.
      const concurrentUser = await findAuthUserByEmail(input.email);
      if (!concurrentUser) {
        console.error("[team-auth]", { stage: "invite_failed", name: error?.name ?? null, message: error?.message ?? "No Auth user returned" });
        throw new ManagementError("UNAVAILABLE", "The invitation email could not be sent.");
      }
      user = concurrentUser;
      existingAuthUser = true;
    } else {
      user = data.user;
      invitationSent = true;
    }
  }

  const { data, error } = await client.rpc("provision_restaurant_member_v1", {
    p_restaurant_slug: slug,
    p_user_id: user.id,
    p_display_name: input.displayName,
    p_role: input.role,
    p_capabilities: input.capabilities,
    p_client_action_id: input.clientActionId,
    p_existing_auth_user: existingAuthUser,
  });
  if (error) throw rpcError(error);
  return { ...data, invitationSent, existingAuthUser };
}

export async function updateRestaurantMember(slug: string, membershipId: string, input: Assignment) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("update_restaurant_member_v1", {
    p_restaurant_slug: slug,
    p_membership_id: membershipId,
    p_display_name: input.displayName,
    p_role: input.role,
    p_capabilities: input.capabilities,
    p_client_action_id: input.clientActionId,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function revokeRestaurantMember(slug: string, membershipId: string, input: { reason: string; clientActionId: string }) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("revoke_restaurant_member_v1", {
    p_restaurant_slug: slug,
    p_membership_id: membershipId,
    p_reason: input.reason,
    p_client_action_id: input.clientActionId,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function reinstateRestaurantMember(slug: string, membershipId: string, clientActionId: string) {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc("reinstate_restaurant_member_v1", {
    p_restaurant_slug: slug,
    p_membership_id: membershipId,
    p_client_action_id: clientActionId,
  });
  if (error) throw rpcError(error);
  return data;
}

export async function resendRestaurantInvitation(slug: string, membershipId: string, clientActionId: string, origin: string) {
  const team = await listRestaurantTeam(slug);
  const member = team.find((entry) => entry.membershipId === membershipId);
  if (!member) throw new ManagementError("NOT_FOUND", "Team member not found.");
  if (member.status !== "invited") throw new ManagementError("CONFLICT", "Only pending invitations can be resent.");

  const client = await authenticatedClient();
  const reservation = await client.rpc("reserve_restaurant_invitation_resend_v1", {
    p_restaurant_slug: slug,
    p_membership_id: membershipId,
    p_client_action_id: clientActionId,
  });
  if (reservation.error) throw rpcError(reservation.error);
  if (!reservation.data?.shouldSend) return reservation.data;

  const { error } = await supabaseServer.auth.admin.inviteUserByEmail(member.email, {
    data: { display_name: member.displayName },
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/manage/reset-password")}`,
  });
  if (error) {
    const recorded = await client.rpc("record_restaurant_invitation_resend_result_v1", {
      p_restaurant_slug: slug,
      p_membership_id: membershipId,
      p_client_action_id: clientActionId,
      p_succeeded: false,
      p_error_code: error.code ?? error.name,
    });
    if (recorded.error) console.error("[team-auth]", { stage: "resend_failure_audit_failed", code: recorded.error.code, message: recorded.error.message });
    console.error("[team-auth]", { stage: "resend_failed", name: error.name, message: error.message });
    throw new ManagementError("UNAVAILABLE", "The invitation email could not be resent.");
  }
  const result = await client.rpc("record_restaurant_invitation_resend_result_v1", {
    p_restaurant_slug: slug,
    p_membership_id: membershipId,
    p_client_action_id: clientActionId,
    p_succeeded: true,
    p_error_code: null,
  });
  if (result.error) throw rpcError(result.error);
  return result.data;
}
