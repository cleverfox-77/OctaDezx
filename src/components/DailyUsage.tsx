import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap, PhoneCall } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PLAN_LABELS, upgradeFor, voiceMinutesFor, PAYG_RATES } from "@/lib/plans";

/**
 * What this account has used this month, against what it bought.
 *
 * The headline meter used to be unique customers PER DAY, which nobody could
 * reconcile with a monthly bill and which punished a business for a busy
 * Saturday. The August 2026 repricing made a month of AI messages the thing you
 * buy, so that is the thing this shows. Voice minutes sit beside it because
 * they are the other meter that can actually run out.
 */

interface Usage {
  plan: string;
  monthly_usage: number;
  monthly_limit: number;
  voice_minutes_used: number;
  voice_minutes_limit: number;
}

export const DailyUsage = ({ businessId }: { businessId: string }) => {
    const { user } = useAuth();
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const { data } = await supabase.rpc("check_daily_limit", { p_business_id: businessId });
                if (data) {
                    const r = data as Record<string, number | string>;
                    setUsage({
                        plan: String(r.plan ?? "free"),
                        monthly_usage: Number(r.monthly_usage ?? 0),
                        monthly_limit: Number(r.monthly_limit ?? 0),
                        voice_minutes_used: Number(r.voice_minutes_used ?? 0),
                        voice_minutes_limit: Number(r.voice_minutes_limit ?? 0),
                    });
                }
            } catch (error) {
                console.error("Error fetching usage:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [businessId]);

    // Append the buyer's user_id so the Lemon Squeezy webhook can attribute the
    // purchase and actually upgrade this profile. Preserves the ?enabled= param.
    const openCheckout = (url: string) => {
        const u = new URL(url);
        if (user?.id) u.searchParams.set("checkout[custom][user_id]", user.id);
        window.open(u.toString(), "_blank");
    };

    if (loading) return <div className="h-24 bg-muted rounded-lg animate-pulse" />;
    if (!usage) return null;

    const { plan, monthly_usage, monthly_limit, voice_minutes_used } = usage;
    // A metered plan reports no ceiling. Showing a progress bar against zero
    // would read as "you are at 100%", so metered plans get a count instead.
    const metered = monthly_limit <= 0 && plan === "enterprise";
    const planLabel = PLAN_LABELS[plan] || plan;
    const upgrade = upgradeFor(plan);

    const voiceLimit = usage.voice_minutes_limit || voiceMinutesFor(plan) || 0;
    const pct = (used: number, limit: number) => (limit > 0 ? Math.min(100, (used / limit) * 100) : 0);
    const messagePct = pct(monthly_usage, monthly_limit);
    const voicePct = pct(voice_minutes_used, voiceLimit);
    const outOfMessages = !metered && monthly_limit > 0 && monthly_usage >= monthly_limit;
    const outOfMinutes = !metered && voiceLimit > 0 && voice_minutes_used >= voiceLimit;

    return (
        <Card className="mb-6 border-blue-900/20 shadow-sm bg-card">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        This month
                        <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{planLabel}</span>
                    </CardTitle>
                    <span className="text-sm font-medium text-muted-foreground">
                        {metered
                            ? `${monthly_usage.toLocaleString()} messages`
                            : `${monthly_usage.toLocaleString()} / ${monthly_limit.toLocaleString()}`}
                    </span>
                </div>
                <CardDescription>
                    {metered
                        ? `Metered at $${PAYG_RATES.perMessage} a message and $${PAYG_RATES.perVoiceMinute} a minute, billed monthly.`
                        : "AI messages included in your plan. Resets on the first of the month."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!metered && (
                    <Progress value={messagePct} className={`h-3 ${outOfMessages ? "bg-red-100" : "bg-secondary"}`} />
                )}

                {(voiceLimit > 0 || metered) && (
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <PhoneCall className="h-3.5 w-3.5" /> Phone minutes
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                                {metered
                                    ? `${voice_minutes_used.toLocaleString()} used`
                                    : `${voice_minutes_used.toLocaleString()} / ${voiceLimit.toLocaleString()}`}
                            </span>
                        </div>
                        {!metered && (
                            <Progress value={voicePct} className={`h-2 ${outOfMinutes ? "bg-red-100" : "bg-secondary"}`} />
                        )}
                    </div>
                )}

                {(outOfMessages || outOfMinutes) && (
                    <Alert variant="destructive" className="bg-red-900/10 border-red-900/20 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{outOfMessages ? "Out of messages" : "Out of phone minutes"}</AlertTitle>
                        <AlertDescription className="mt-2 flex flex-col gap-2">
                            <p>
                                {outOfMessages
                                    ? `You have used all ${monthly_limit.toLocaleString()} AI messages in your plan this month.`
                                    : `You have used all ${voiceLimit.toLocaleString()} phone minutes this month. Calls go to voicemail until they reset.`}
                            </p>
                            {upgrade && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => upgrade.external ? openCheckout(upgrade.url) : window.location.assign(upgrade.url)}
                                >
                                    {upgrade.label}
                                </Button>
                            )}
                            {!upgrade && (
                                <p className="text-xs text-muted-foreground">
                                    Contact support at kevin@octadezx.com for higher limits.
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
};
