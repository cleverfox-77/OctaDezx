import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { ROLE_BLURB, type TeamRole } from "./roles";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  businessName: string;
  /** Only the owner may create other admins, matching create_team_invitation. */
  canInviteAdmins: boolean;
  seatsLeft: number;
  onInvited: () => void;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1`;

/** Where an invited teammate lands. Dashboard reads the token off this URL. */
export const inviteUrl = (token: string) =>
  `${window.location.origin}/dashboard?invite=${encodeURIComponent(token)}`;

const InviteMemberDialog = ({
  open, onOpenChange, businessId, businessName, canInviteAdmins, seatsLeft, onInvited,
}: InviteMemberDialogProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<TeamRole, "owner">>("agent");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail(""); setRole("agent"); setLink(null); setEmailed(false); setCopied(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleInvite = async () => {
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      // Preferred path: the edge function creates the invitation with the
      // caller's own JWT (so every server-side check still applies) and then
      // sends the email with a credential the browser must never hold.
      let url: string | null = null;
      let didEmail = false;

      if (accessToken) {
        try {
          const res = await fetch(`${FUNCTIONS_BASE}/team-invite`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
            body: JSON.stringify({ business_id: businessId, email, role }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.error || "Could not send the invitation");
          url = body.invite_url ?? null;
          didEmail = !!body.emailed;
        } catch (fnErr) {
          // The function may not be deployed yet. Fall through to the RPC so
          // inviting still works, just with a link the manager sends manually.
          console.warn("team-invite function unavailable, using the RPC:", fnErr);
        }
      }

      if (!url) {
        const db = supabase as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) =>
            Promise<{ data: unknown; error: { message: string } | null }>;
        };
        const { data, error } = await db.rpc("create_team_invitation", {
          p_business_id: businessId, p_email: email, p_role: role,
        });
        if (error) throw new Error(error.message);
        const row = (data as { token: string }[])?.[0];
        if (!row?.token) throw new Error("Could not create the invitation");
        url = inviteUrl(row.token);
      }

      setLink(url);
      setEmailed(didEmail);
      onInvited();
      toast({
        title: "Invitation created",
        description: didEmail
          ? `We emailed ${email} a link to join ${businessName}.`
          : "Copy the link below and send it to them yourself.",
      });
    } catch (err) {
      toast({ title: "Could not invite", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />Invite someone to {businessName}
          </DialogTitle>
          <DialogDescription>
            They will get a link to join. The link works once, expires in 7 days, and only opens
            for the address you send it to.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3 py-2">
            <div className="p-3 rounded-lg bg-muted border">
              <p className="text-sm font-medium mb-2">
                {emailed ? "Sent. Here is the link as well." : "Send them this link."}
              </p>
              <code className="block text-xs break-all text-muted-foreground">{link}</code>
            </div>
            <Button variant="outline" className="w-full press" onClick={copy}>
              {copied
                ? <><Check className="h-4 w-4 mr-2" />Copied</>
                : <><Copy className="h-4 w-4 mr-2" />Copy link</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              If they do not have an OctaDezx account yet, they should sign up with this exact
              address first, then open the link.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Their email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">What they can do</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Exclude<TeamRole, "owner">)}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  {canInviteAdmins && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_BLURB[role]}</p>
              {!canInviteAdmins && (
                <p className="text-xs text-muted-foreground">
                  Only the account owner can add another admin.
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              This uses one of your {seatsLeft} remaining {seatsLeft === 1 ? "seat" : "seats"},
              held from the moment you invite them.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {link ? (
            <Button onClick={() => close(false)} className="press">Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => close(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleInvite} disabled={sending || !email.trim()} className="press">
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sending ? "Sending" : "Send invitation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberDialog;
