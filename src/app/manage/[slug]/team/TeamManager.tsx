"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { describeRestaurantAccessEvent, type ManagementCapability, type RestaurantAccessEvent, type RestaurantTeamMember } from "@/lib/order-management/contracts";
import AccessRevoked from "../AccessRevoked";
import styles from "./team.module.css";

const capabilityInfo: Record<ManagementCapability, { label: string; description: string; sensitive?: boolean }> = {
  view_orders: { label: "View orders", description: "See the restaurant order queue and details." },
  advance_fulfillment: { label: "Advance fulfillment", description: "Move orders through preparing, ready, and completed." },
  view_customer_contact: { label: "View customer contact", description: "See customer phone numbers and email addresses.", sensitive: true },
  export_order_history: { label: "Export order history", description: "Export restaurant orders and customer data.", sensitive: true },
  issue_refunds: { label: "Issue refunds", description: "Issue provider-backed refunds from order details.", sensitive: true },
  correct_fulfillment: { label: "Correct fulfillment", description: "Reserved for audited fulfillment corrections.", sensitive: true },
  manage_memberships: { label: "Manage team", description: "Invite, edit, revoke, and reinstate non-owner team members.", sensitive: true },
  manage_restaurant_settings: { label: "Manage restaurant settings", description: "Configure the restaurant profile, ordering rules, and weekly hours.", sensitive: true },
  manage_notifications: { label: "Manage notifications", description: "Configure customer and restaurant operational emails.", sensitive: true },
};
const allCapabilities = Object.keys(capabilityInfo) as ManagementCapability[];
// Reserved for the future reason-required, append-only correction workflow.
// Keep it in role payloads, but do not present it as editable until that workflow exists.
const editableCapabilities = allCapabilities.filter((capability) => capability !== "correct_fulfillment");
const roleDefaults: Record<"owner" | "manager" | "staff", ManagementCapability[]> = {
  owner: allCapabilities,
  manager: ["view_orders", "advance_fulfillment", "view_customer_contact", "export_order_history", "manage_restaurant_settings", "manage_notifications"],
  staff: ["view_orders", "advance_fulfillment", "view_customer_contact"],
};
type Role = "owner" | "manager" | "staff";
type Draft = { email: string; displayName: string; role: Role; capabilities: ManagementCapability[] };
const blankDraft: Draft = { email: "", displayName: "", role: "staff", capabilities: roleDefaults.staff };

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
function statusLabel(status: RestaurantTeamMember["status"]) {
  return status === "invited" ? "Invitation pending" : status === "active" ? "Active" : "Revoked";
}

export default function TeamManager({ slug, restaurantName, actorMembershipId, actorRole, actorCapabilities, initialMembers, initialEvents }: {
  slug: string;
  restaurantName: string;
  actorMembershipId: string;
  actorRole: Role;
  actorCapabilities: ManagementCapability[];
  initialMembers: RestaurantTeamMember[];
  initialEvents: RestaurantAccessEvent[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [events, setEvents] = useState(initialEvents);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [accessLost, setAccessLost] = useState<"revoked" | "signed-out" | null>(null);
  const active = useMemo(() => members.filter((member) => member.status !== "revoked"), [members]);
  const revoked = useMemo(() => members.filter((member) => member.status === "revoked"), [members]);

  const refresh = useCallback(async () => {
    if (accessLost) return;
    const response = await fetch(`/api/manage/restaurants/${encodeURIComponent(slug)}/team`, { cache: "no-store" });
    if (response.status === 403 || response.status === 401) {
      setMembers([]); setEvents([]);
      setAccessLost(response.status === 403 ? "revoked" : "signed-out");
      return;
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "The team could not be refreshed.");
    setMembers(body.members); setEvents(body.events);
  }, [accessLost, slug]);

  useEffect(() => {
    if (accessLost) return;
    const verify = () => { void refresh().catch(() => undefined); };
    const poll = window.setInterval(verify, 15_000);
    window.addEventListener("focus", verify);
    return () => { window.clearInterval(poll); window.removeEventListener("focus", verify); };
  }, [accessLost, refresh]);
  function setRole(role: Role) {
    setDraft((current) => ({ ...current, role, capabilities: roleDefaults[role].filter((capability) => actorCapabilities.includes(capability)) }));
  }
  function toggleCapability(capability: ManagementCapability) {
    setDraft((current) => ({ ...current, capabilities: current.capabilities.includes(capability) ? current.capabilities.filter((value) => value !== capability) : [...current.capabilities, capability] }));
  }
  function beginEdit(member: RestaurantTeamMember) {
    setEditingId(member.membershipId);
    setDraft({ email: member.email, displayName: member.displayName, role: member.role, capabilities: member.capabilities });
    setMessage(null);
  }
  function resetForm() { setEditingId(null); setDraft(blankDraft); }
  async function request(path: string, method: string, body: object, success: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (response.status === 403 || response.status === 401) {
        setMembers([]); setEvents([]);
        setAccessLost(response.status === 403 ? "revoked" : "signed-out");
        return;
      }
      if (!response.ok) throw new Error(result.error || "The request could not be completed.");
      await refresh(); resetForm(); setMessage({ tone: "success", text: success });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "The request could not be completed." }); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = { ...draft, clientActionId: crypto.randomUUID() };
    if (editingId) await request(`/api/manage/restaurants/${encodeURIComponent(slug)}/team/${editingId}`, "PATCH", body, "Team member updated.");
    else await request(`/api/manage/restaurants/${encodeURIComponent(slug)}/team`, "POST", body, "Invitation processed. Existing Menu Man users can sign in immediately; new users receive an invitation email.");
  }
  async function revoke(member: RestaurantTeamMember) {
    const warning = member.role === "owner" ? "Revoking an owner removes their restaurant access. The final active owner cannot be revoked. Continue?" : `Revoke access for ${member.displayName}?`;
    if (!window.confirm(warning)) return;
    const reason = window.prompt("Optional audit reason for revocation:", "") ?? "";
    await request(`/api/manage/restaurants/${encodeURIComponent(slug)}/team/${member.membershipId}/revoke`, "POST", { reason, clientActionId: crypto.randomUUID() }, "Team member access revoked.");
  }
  async function simpleAction(member: RestaurantTeamMember, action: "reinstate" | "resend-invitation") {
    await request(`/api/manage/restaurants/${encodeURIComponent(slug)}/team/${member.membershipId}/${action}`, "POST", { clientActionId: crypto.randomUUID() }, action === "reinstate" ? "Team member reinstated." : "Invitation resent.");
  }

  const target = editingId ? members.find((member) => member.membershipId === editingId) : null;
  const canChooseOwner = actorRole === "owner";
  const cannotEditOwner = Boolean(target?.role === "owner" && actorRole !== "owner");

  if (accessLost) return <AccessRevoked restaurantName={restaurantName} slug={slug} signedOut={accessLost === "signed-out"} />;

  return <div className={styles.workspace}>
    <section className={styles.editor} aria-label={editingId ? "Edit team member" : "Invite team member"}>
      <div className={styles.sectionHeading}><div><h2>{editingId ? "Edit team member" : "Invite team member"}</h2><p>Role presets establish a starting point. The checked permissions below are the final access this person will receive.</p></div>{editingId ? <button className={styles.textButton} onClick={resetForm}>Cancel edit</button> : null}</div>
      {message ? <p className={message.tone === "error" ? styles.error : styles.success}>{message.text}</p> : null}
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fields}>
          {!editingId ? <label>Email<input required type="email" autoComplete="off" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label> : <label>Email<input disabled value={draft.email} /></label>}
          <label>Display name<input required maxLength={200} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
          <label>Role<select value={draft.role} disabled={cannotEditOwner} onChange={(event) => setRole(event.target.value as Role)}>{canChooseOwner ? <option value="owner">Owner</option> : null}<option value="manager">Manager</option><option value="staff">Staff</option></select></label>
        </div>
        {draft.role === "owner" ? <p className={styles.warning}>Owners receive full restaurant access, including team management and sensitive permissions.</p> : null}
        <fieldset className={styles.permissions} disabled={cannotEditOwner}><legend>Final permissions</legend>{editableCapabilities.map((capability) => { const info = capabilityInfo[capability]; const grantable = actorCapabilities.includes(capability); const checked = draft.capabilities.includes(capability); return <label className={styles.permission} key={capability}><input type="checkbox" checked={checked} disabled={(!grantable && !checked) || cannotEditOwner} onChange={() => toggleCapability(capability)} /><span><strong>{info.label}{info.sensitive ? <em>Sensitive</em> : null}</strong><small>{info.description}{!grantable ? checked ? " You may remove, but cannot re-grant, this permission." : " You cannot grant this permission." : ""}</small></span></label>; })}</fieldset>
        <button className={styles.primaryButton} disabled={busy || cannotEditOwner}>{busy ? "Saving…" : editingId ? "Save changes" : "Send invitation"}</button>
      </form>
    </section>

    <section className={styles.listSection}><h2>Active team</h2><div className={styles.memberList}>{active.map((member) => <article className={styles.member} key={member.membershipId}><div className={styles.memberIdentity}><div><strong>{member.displayName}{member.membershipId === actorMembershipId ? " (you)" : ""}</strong><span>{member.email}</span></div><span className={`${styles.status} ${member.status === "invited" ? styles.pending : ""}`}>{statusLabel(member.status)}</span></div><div className={styles.memberMeta}><span className={styles.roleBadge}>{member.role}</span><span>{member.capabilities.filter((capability) => capability !== "correct_fulfillment").length} permissions</span><span>{member.status === "invited" ? `Invited ${date(member.invitedAt ?? member.membershipCreatedAt)}` : `Joined ${date(member.joinedAt ?? member.membershipCreatedAt)}`}</span></div><p className={styles.capabilitySummary}>{member.capabilities.filter((capability) => capability !== "correct_fulfillment").map((capability) => capabilityInfo[capability].label).join(" · ") || "No permissions"}</p><div className={styles.memberActions}><button disabled={busy || (member.role === "owner" && actorRole !== "owner")} onClick={() => beginEdit(member)}>Edit</button>{member.status === "invited" ? <button disabled={busy || (member.role === "owner" && actorRole !== "owner")} onClick={() => simpleAction(member, "resend-invitation")}>Resend invite</button> : null}<button className={styles.dangerButton} disabled={busy || (member.role === "owner" && actorRole !== "owner")} onClick={() => revoke(member)}>Revoke</button></div></article>)}</div></section>
    {revoked.length ? <section className={styles.listSection}><h2>Revoked</h2><div className={styles.memberList}>{revoked.map((member) => <article className={`${styles.member} ${styles.revoked}`} key={member.membershipId}><div className={styles.memberIdentity}><div><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={styles.status}>Revoked</span></div><div className={styles.memberMeta}><span className={styles.roleBadge}>{member.role}</span><span>Revoked {date(member.revokedAt)}</span></div><div className={styles.memberActions}><button disabled={busy || (member.role === "owner" && actorRole !== "owner")} onClick={() => simpleAction(member, "reinstate")}>Reinstate</button></div></article>)}</div></section> : null}
    <section className={styles.audit}><h2>Recent access activity</h2><ol>{events.map((event) => { const presentation = describeRestaurantAccessEvent(event); return <li key={event.eventId}><div><strong>{presentation.title}</strong><span>{event.targetDisplayName}{event.actorDisplayName ? ` · by ${event.actorDisplayName}` : " · system"}</span>{presentation.details.map((detail) => <span className={styles.auditDetail} key={detail}>{detail}</span>)}</div><time>{date(event.createdAt)}</time>{event.reason ? <p>{event.reason}</p> : null}</li>; })}</ol></section>
  </div>;
}
