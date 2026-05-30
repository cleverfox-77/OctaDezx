import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CancelSubscriptionDialogProps {
  planType: string;
  children: React.ReactNode;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter ($9/mo)",
  pro: "Pro ($29/mo)",
  enterprise: "Enterprise ($99/mo)",
  appsumo_ltd: "Lifetime Deal",
};

export const CancelSubscriptionDialog = ({ planType, children }: CancelSubscriptionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");

      if (error) {
        toast({
          title: "Error",
          description: "Failed to cancel subscription. Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        toast({
          title: "Cannot Cancel",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Subscription Cancelled",
        description: data?.endsAt
          ? `Your subscription will remain active until ${new Date(data.endsAt).toLocaleDateString()}.`
          : "Your subscription has been cancelled and will remain active until the end of your billing period.",
      });

      setOpen(false);
      // navigate(0) is React Router's safe in-place reload — no setTimeout race
      navigate(0);
    } catch (err) {
      console.error("Cancel error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please contact support at kevin@octadezx.com.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Subscription
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your {PLAN_LABELS[planType] || planType} plan?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
            <p className="font-medium">What happens when you cancel:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">&#8226;</span>
                Your subscription will remain <strong className="text-foreground">active until the end of your current billing period</strong>.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">&#8226;</span>
                After that, your account will be downgraded to the free plan and your AI chat will stop responding.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">&#8226;</span>
                Your data (products, chat history, orders) will be <strong className="text-foreground">retained for 30 days</strong> after expiration.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">&#8226;</span>
                You can <strong className="text-foreground">resubscribe at any time</strong> to regain full access.
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            No prorated refund will be issued for the remaining days in your billing cycle. If you have questions, contact us at kevin@octadezx.com.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Keep Subscription
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={loading}>
            {loading ? "Cancelling..." : "Cancel Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
