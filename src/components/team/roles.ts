// Team roles, kept in one place so the dialog, the roster and the copy that
// explains them can never drift apart. Mirrors the role CHECK constraint on
// public.team_members.
export type TeamRole = "owner" | "admin" | "agent";

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
};

/** What each role can actually reach, in the user's words rather than the schema's. */
export const ROLE_BLURB: Record<TeamRole, string> = {
  owner: "Full access, including billing and the team itself",
  admin: "Everything an agent can do, plus settings, training and invites",
  agent: "Conversations, orders, appointments and invoices",
};
