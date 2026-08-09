import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  UsersRound, UserPlus, Trash2, Loader2, MailCheck, ShieldCheck, ArrowUpRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { teamSeatsFor, type PlanType } from "@/hooks/useSubscription";
import InviteMemberDialog from "./InviteMemberDialog";
import { ROLE_LABEL, ROLE_BLURB, type TeamRole } from "./roles";

interface TeamMemberRow {
  id: string;
  user_id: string;
  email: string;
  role: TeamRole;
  created_at: string;
  is_me: boolean;
}

interface InvitationRow {
  id: string;
  email: string;
  role: TeamRole;
  expires_at: string;
  created_at: string;
}

interface TeamOverview {
  seat_limit: number;
  seats_used: number;
  my_role: TeamRole;
  plan: string;
}

interface TeamSectionProps {
  businessId: string;
  businessName: string;
  /** The signed-in user's plan, used only for the upgrade copy. */
  planType: PlanType;
  onNavigate: (section: "billing") => void;
}

// The RPCs are newer than the generated Supabase types, so calls go through a
// narrowed cast rather than `any` scattered at every call site.
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const TeamSection = ({ businessId, businessName, planType, onNavigate }: TeamSectionProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TeamMemberRow | null>(null);

  const db = supabase as unknown as RpcClient;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, membersRes] = await Promise.all([
        db.rpc("team_overview", { p_business_id: businessId }),
        db.rpc("list_team_members", { p_business_id: businessId }),
      ]);
      if (overviewRes.error) throw overviewRes.error;
      if (membersRes.error) throw membersRes.error;

      const ov = (overviewRes.data as TeamOverview[])?.[0] ?? null;
      setOverview(ov);
      setMembers((membersRes.data as TeamMemberRow[]) ?? []);

      // Pending invitations are readable by managers only, so agents simply get
      // an empty list back rather than an error.
      if (ov && (ov.my_role === "owner" || ov.my_role === "admin")) {
        const { data } = await supabase
          .from("team_invitations")
          .select("id, email, role, expires_at, created_at")
          .eq("business_id", businessId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });
        setInvitations((data as InvitationRow[]) ?? []);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error("Failed to load team:", err);
      toast({ title: "Error", description: "Could not load your team. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [businessId, db, toast]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (member: TeamMemberRow) => {
    setBusyId(member.id);
    try {
      const { error } = await db.rpc("remove_team_member", { p_member_id: member.id });
      if (error) throw error;
      toast({
        title: member.is_me ? "You left the team" : "Member removed",
        description: member.is_me
          ? `You no longer have access to ${businessName}.`
          : `${member.email} can no longer access ${businessName}.`,
      });
      await load();
    } catch (err) {
      toast({ title: "Could not remove", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setConfirmRemove(null);
    }
  };

  const handleRoleChange = async (member: TeamMemberRow, role: TeamRole) => {
    setBusyId(member.id);
    try {
      const { error } = await db.rpc("set_team_member_role", { p_member_id: member.id, p_role: role });
      if (error) throw error;
      toast({ title: "Role updated", description: `${member.email} is now ${ROLE_LABEL[role].toLowerCase()}.` });
      await load();
    } catch (err) {
      toast({ title: "Could not change role", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invitation: InvitationRow) => {
    setBusyId(invitation.id);
    try {
      const { error } = await db.rpc("revoke_team_invitation", { p_invitation_id: invitation.id });
      if (error) throw error;
      toast({ title: "Invitation revoked", description: `The seat held for ${invitation.email} is free again.` });
      await load();
    } catch (err) {
      toast({ title: "Could not revoke", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  // Fall back to the client-side plan map if the overview call came back empty,
  // so the panel still renders something honest.
  const seatLimit = overview?.seat_limit ?? teamSeatsFor(planType);
  const seatsUsed = overview?.seats_used ?? members.length;
  const myRole = overview?.my_role ?? "agent";
  const isOwner = myRole === "owner";
  const isManager = isOwner || myRole === "admin";
  const seatsLeft = Math.max(0, seatLimit - seatsUsed);
  const isFull = seatsLeft === 0;
  // A downgrade never evicts anyone, so a team can legitimately sit above its
  // plan. Say so plainly instead of rendering a negative number.
  const overLimit = seatsUsed > seatLimit;
  const pct = Math.min(100, Math.round((seatsUsed / Math.max(1, seatLimit)) * 100));

  return (
    <div className="space-y-6">
      {/* ── Seats ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5" />Your team
              </CardTitle>
              <CardDescription>
                Everyone here can work the {businessName} inbox. Your plan includes{" "}
                {seatLimit === 1 ? "a single seat" : `${seatLimit} seats`}, and the owner takes one of them.
              </CardDescription>
            </div>
            {isManager && (
              <Button
                onClick={() => setInviteOpen(true)}
                disabled={isFull}
                className="press flex-shrink-0"
                size="sm"
              >
                <UserPlus className="h-4 w-4 mr-2" />Invite someone
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium">
                {seatsUsed} of {seatLimit} {seatLimit === 1 ? "seat" : "seats"} used
              </span>
              <span className="text-xs text-muted-foreground">
                {overLimit
                  ? "Over your plan limit"
                  : isFull ? "All seats taken" : `${seatsLeft} free`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overLimit || isFull ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Pending invitations hold a seat until they are accepted or revoked.
            </p>
          </div>

          {overLimit && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Your team is larger than your current plan allows.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nobody has been removed and everyone keeps working as normal. You just cannot add
                anyone else until you upgrade or remove someone.
              </p>
            </div>
          )}

          {isFull && !overLimit && isManager && (
            <div className="p-4 rounded-lg bg-muted border">
              <p className="text-sm font-medium">
                {seatLimit === 1
                  ? "Your plan is built for working solo."
                  : "Every seat on your plan is taken."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {seatLimit === 1
                  ? "Move up to Starter for 3 seats, Pro for 10, or Advanced for 20."
                  : "Upgrade for more seats, or remove someone to free one up."}
              </p>
              {isOwner && (
                <Button variant="outline" size="sm" className="mt-3 press" onClick={() => onNavigate("billing")}>
                  See plans<ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Members ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {isOwner
              ? "You decide what each person can reach."
              : "Roles are set by the account owner."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y border-t">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{m.email}</span>
                    {m.is_me && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                    {m.role === "owner" && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ShieldCheck className="h-3 w-3" />Owner
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ROLE_BLURB[m.role]} · joined {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* The owner row is fixed: ownership moves through billing, not here. */}
                  {isOwner && m.role !== "owner" ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => handleRoleChange(m, v as TeamRole)}
                      disabled={busyId === m.id}
                    >
                      <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    m.role !== "owner" && (
                      <Badge variant="secondary" className="text-[10px]">{ROLE_LABEL[m.role]}</Badge>
                    )
                  )}

                  {m.role !== "owner" && (isManager || m.is_me) && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={busyId === m.id}
                      onClick={() => setConfirmRemove(m)}
                      aria-label={m.is_me ? "Leave this team" : `Remove ${m.email}`}
                    >
                      {busyId === m.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ── Pending invitations ── */}
      {isManager && invitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MailCheck className="h-4 w-4" />Waiting to accept
            </CardTitle>
            <CardDescription>
              Each of these holds a seat. Revoke one to get the seat back straight away.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{inv.email}</span>
                      <Badge variant="secondary" className="text-[10px]">{ROLE_LABEL[inv.role]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    disabled={busyId === inv.id}
                    onClick={() => handleRevoke(inv)}
                  >
                    {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revoke"}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        businessId={businessId}
        businessName={businessName}
        canInviteAdmins={isOwner}
        seatsLeft={seatsLeft}
        onInvited={load}
      />

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmRemove?.is_me ? "Leave this team?" : "Remove this person?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.is_me
                ? `You will lose access to ${businessName} immediately. Only an owner or admin can invite you back.`
                : `${confirmRemove?.email} loses access to ${businessName} immediately, and the seat is freed. Conversations they handled stay where they are.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
            >
              {confirmRemove?.is_me ? "Leave" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamSection;
