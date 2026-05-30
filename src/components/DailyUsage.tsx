
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PLAN_LABELS: Record<string, string> = {
    appsumo_ltd: "Lifetime",
    trial: "Trial",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
    free: "Free",
};

const UPGRADE_URLS: Record<string, { label: string; url: string } | null> = {
    trial: { label: "Upgrade to Starter", url: "https://octadezx.lemonsqueezy.com/checkout/buy/55143028-7194-497f-bd84-d2a3fa5bba44" },
    appsumo_ltd: { label: "Upgrade to Starter", url: "https://octadezx.lemonsqueezy.com/checkout/buy/55143028-7194-497f-bd84-d2a3fa5bba44" },
    starter: { label: "Upgrade to Pro", url: "https://octadezx.lemonsqueezy.com/checkout/buy/10570561-d529-4751-92f9-8aaf7d6b1b5e" },
    pro: { label: "Upgrade to Enterprise", url: "https://octadezx.lemonsqueezy.com/checkout/buy/765de369-4c52-4814-aa34-a83983f3ce90" },
    enterprise: null,
    free: { label: "Subscribe", url: "https://octadezx.lemonsqueezy.com/checkout/buy/55143028-7194-497f-bd84-d2a3fa5bba44" },
};

export const DailyUsage = ({ businessId }: { businessId: string }) => {
    const [usage, setUsage] = useState(0);
    const [limit, setLimit] = useState(300);
    const [plan, setPlan] = useState("starter");
    const [monthlyUsage, setMonthlyUsage] = useState(0);
    const [monthlyLimit, setMonthlyLimit] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const { data } = await supabase.rpc("check_daily_limit", { p_business_id: businessId });
                if (data) {
                    const result = data as any;
                    setUsage(result.usage);
                    setLimit(result.limit);
                    setPlan(result.plan);
                    setMonthlyUsage(result.monthly_usage || 0);
                    setMonthlyLimit(result.monthly_limit || 0);
                }
            } catch (error) {
                console.error("Error fetching usage:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, [businessId]);

    if (loading) return <div className="h-24 bg-muted rounded-lg animate-pulse" />;

    const percentage = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
    const isLimitReached = usage >= limit;
    const planLabel = PLAN_LABELS[plan] || plan;
    const upgrade = UPGRADE_URLS[plan];

    const monthlyPercentage = monthlyLimit > 0 ? Math.min(100, (monthlyUsage / monthlyLimit) * 100) : 0;
    const isMonthlyLimitReached = monthlyLimit > 0 && monthlyUsage >= monthlyLimit;

    return (
        <Card className="mb-6 border-blue-900/20 shadow-sm bg-card">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Daily Customer Limit
                        <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{planLabel}</span>
                    </CardTitle>
                    <span className="text-sm font-medium text-muted-foreground">
                        {usage.toLocaleString()} / {limit.toLocaleString()}
                    </span>
                </div>
                <CardDescription>Unique customers handled today. Resets at midnight UTC.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Progress value={percentage} className={`h-3 ${isLimitReached ? "bg-red-100" : "bg-secondary"}`} />

                {/* Monthly usage bar for enterprise */}
                {plan === "enterprise" && monthlyLimit > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Monthly Messages (Fair Use)</span>
                            <span className="text-sm font-medium text-muted-foreground">
                                {monthlyUsage.toLocaleString()} / {monthlyLimit.toLocaleString()}
                            </span>
                        </div>
                        <Progress value={monthlyPercentage} className={`h-2 ${isMonthlyLimitReached ? "bg-red-100" : "bg-secondary"}`} />
                    </div>
                )}

                {(isLimitReached || isMonthlyLimitReached) && (
                    <Alert variant="destructive" className="bg-red-900/10 border-red-900/20 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Limit Reached</AlertTitle>
                        <AlertDescription className="mt-2 flex flex-col gap-2">
                            <p>
                                {isMonthlyLimitReached
                                    ? "You've reached the 100,000 monthly message limit (Fair Use Policy)."
                                    : `You've reached the ${limit.toLocaleString()} daily customer limit. Your chat is currently paused.`
                                }
                            </p>
                            {upgrade && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => window.open(upgrade.url, "_blank")}
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
