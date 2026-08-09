import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Crown, Zap, Building2, Rocket } from "lucide-react";
import { PLANS, PAYG_RATES } from "@/lib/plans";

const SubscriptionLockScreen = () => {
    const { user } = useAuth();
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [yearly, setYearly] = useState(false);

    // Load user's referral code from profile (set at signup) or localStorage fallback
    useEffect(() => {
        const loadReferralCode = async () => {
            if (user?.id) {
                const { data } = await supabase
                    .from("profiles")
                    .select("referral_code")
                    .eq("user_id", user.id)
                    .single();
                const profileCode = (data as any)?.referral_code;
                if (profileCode) {
                    setReferralCode(profileCode);
                    return;
                }
            }
            // Fallback: check localStorage (user hasn't been saved yet)
            const stored = localStorage.getItem("octadezx_ref");
            if (stored) setReferralCode(stored);
        };
        loadReferralCode();
    }, [user?.id]);

    const handleSubscribe = (url: string) => {
        if (!user?.id || !url) return;
        // Use URL so the existing ?enabled=<variant> query param is preserved
        // (naive `${url}?...` would produce a second "?" and break the checkout).
        const u = new URL(url);
        u.searchParams.set("checkout[custom][user_id]", user.id);
        if (referralCode) {
            u.searchParams.set("checkout[discount_code]", referralCode);
        }
        window.open(u.toString(), '_blank');
    };

    /**
     * Cards driven by src/lib/plans.ts. This screen used to carry a fourth
     * private copy of the ladder and was the last place still advertising the
     * withdrawn $9 tier and a daily customer cap nobody meters any more.
     */
    const ICONS: Record<string, typeof Zap> = {
        starter: Zap, pro: Crown, advanced: Rocket, enterprise: Building2,
    };
    const STYLES: Record<string, { badge: string | null; badgeColor: string; borderColor: string; accentColor: string; bgAccent: string }> = {
        starter:    { badge: null,            badgeColor: "",                borderColor: "border-transparent hover:border-muted", accentColor: "text-blue-500",   bgAccent: "bg-muted" },
        pro:        { badge: "MOST POPULAR",  badgeColor: "bg-primary",      borderColor: "border-primary ring-1 ring-primary/20", accentColor: "text-primary",    bgAccent: "bg-primary/10" },
        advanced:   { badge: "SCALE",         badgeColor: "bg-purple-600",   borderColor: "border-purple-500/30",                 accentColor: "text-purple-500", bgAccent: "bg-purple-500/10" },
        enterprise: { badge: "PAY AS YOU GO", badgeColor: "bg-slate-800",    borderColor: "border-slate-500/30",                  accentColor: "text-slate-700 dark:text-slate-300", bgAccent: "bg-slate-500/10" },
    };

    const plans = PLANS.map((plan) => ({
        ...plan,
        icon: ICONS[plan.key] ?? Zap,
        ...STYLES[plan.key],
        highlight: plan.popular,
        priceLine: plan.monthly == null
            ? "Pay as you go"
            : `$${(yearly ? plan.yearly! : plan.monthly).toLocaleString("en-US")}`,
        periodLine: plan.monthly == null ? `from $${PAYG_RATES.monthlyMinimum} / month` : (yearly ? "/ year" : "/ month"),
        capacity: plan.messages == null
            ? `$${PAYG_RATES.perMessage} per message, $${PAYG_RATES.perVoiceMinute} per phone minute`
            : `${plan.messages.toLocaleString()} AI messages and ${plan.voiceMinutes!.toLocaleString()} phone minutes a month`,
        buttonText: plan.checkout ? `Subscribe to ${plan.name}` : "Talk to us",
    }));

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background">
            <div className="max-w-7xl w-full space-y-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-destructive">Trial Expired</h1>
                    <p className="text-muted-foreground">Your 24-hour free trial has ended. Choose a plan to continue.</p>
                    {referralCode && (
                        <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-sm text-green-700 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span>
                                Discount code <span className="font-mono font-semibold">{referralCode}</span> will be applied at checkout
                            </span>
                        </div>
                    )}
                </div>

                {/* Billing period toggle */}
                <div className="flex justify-center">
                    <div className="inline-flex items-center gap-1 p-1 rounded-full border bg-muted/50">
                        <button
                            onClick={() => setYearly(false)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setYearly(true)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Yearly
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${yearly ? "bg-white/20" : "bg-green-500/10 text-green-600"}`}>
                                2 months free
                            </span>
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
                    {plans.map((plan) => {
                        const checkoutUrl = plan.checkout?.[yearly ? "yearly" : "monthly"] ?? "";
                        return (
                            <Card
                                key={plan.name}
                                className={`flex flex-col h-full transition-shadow hover:shadow-lg border-2 ${plan.borderColor} ${plan.highlight ? 'shadow-lg' : ''} relative overflow-hidden`}
                            >
                                {plan.badge && (
                                    <div className={`absolute top-0 right-0 ${plan.badgeColor} text-white text-xs px-3 py-1 rounded-bl-lg font-medium`}>
                                        {plan.badge}
                                    </div>
                                )}
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <plan.icon className={`h-5 w-5 ${plan.accentColor}`} />
                                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                                    </div>
                                    <CardDescription className="min-h-[20px] text-xs">{plan.desc}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 flex flex-col space-y-4 text-left">
                                    <div className={`${plan.bgAccent} p-3 rounded-lg text-center`}>
                                        <p className={`font-bold text-2xl ${plan.highlight ? plan.accentColor : ''}`}>
                                            {plan.priceLine}{" "}
                                            <span className="text-sm font-normal text-muted-foreground">{plan.periodLine}</span>
                                        </p>
                                        {yearly && plan.monthly != null && (
                                            <p className="text-[11px] font-semibold text-green-600 mt-0.5">2 months free</p>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="font-semibold text-xs">What you get:</p>
                                        <p className="text-xs text-muted-foreground">{plan.capacity}</p>
                                    </div>

                                    <div className="space-y-2 flex-1">
                                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                                            {plan.features.map((feature, i) => (
                                                <li key={i} className="flex items-start gap-1.5">
                                                    <CheckCircle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${plan.accentColor}`} />
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Button
                                        className="w-full mt-4"
                                        size="sm"
                                        variant={plan.highlight ? "default" : "outline"}
                                        onClick={() => checkoutUrl
                                            ? handleSubscribe(checkoutUrl)
                                            : window.location.assign("/pricing#contact")}
                                    >
                                        {plan.buttonText}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionLockScreen;
