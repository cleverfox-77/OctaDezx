import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Crown, Zap, Building2 } from "lucide-react";

const SubscriptionLockScreen = () => {
    const { user } = useAuth();
    const [referralCode, setReferralCode] = useState<string | null>(null);

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
        if (!user?.id) return;
        const params = new URLSearchParams();
        params.set("checkout[custom][user_id]", user.id);
        if (referralCode) {
            params.set("checkout[discount_code]", referralCode);
        }
        window.open(`${url}?${params.toString()}`, '_blank');
    };

    const plans = [
        {
            name: "Starter",
            price: "$9",
            period: "/ month",
            icon: Zap,
            badge: null,
            badgeColor: "",
            borderColor: "border-transparent hover:border-muted",
            accentColor: "text-blue-500",
            bgAccent: "bg-muted",
            capacity: "300 unique customers per day",
            features: [
                "Essential automation tools",
                "Standard response times",
                "Core integrations",
                "Email support",
            ],
            ideal: "Small businesses, boutiques, and startups.",
            checkoutUrl: "https://octadezx.lemonsqueezy.com/checkout/buy/55143028-7194-497f-bd84-d2a3fa5bba44",
            buttonText: "Subscribe to Starter",
            highlight: false,
        },
        {
            name: "Pro",
            price: "$29",
            period: "/ month",
            icon: Crown,
            badge: "MOST POPULAR",
            badgeColor: "bg-primary",
            borderColor: "border-primary ring-1 ring-primary/20",
            accentColor: "text-primary",
            bgAccent: "bg-primary/10",
            capacity: "1,000 unique customers per day",
            features: [
                "Everything in Starter",
                "Whitelabel branding (remove OctaDezx logo)",
                "Priority processing",
                "Advanced analytics & reporting",
            ],
            ideal: "Growing businesses and marketing agencies.",
            checkoutUrl: "https://octadezx.lemonsqueezy.com/checkout/buy/10570561-d529-4751-92f9-8aaf7d6b1b5e",
            buttonText: "Subscribe to Pro",
            highlight: true,
        },
        {
            name: "Enterprise",
            price: "$99",
            period: "/ month",
            icon: Building2,
            badge: "SCALE",
            badgeColor: "bg-purple-600",
            borderColor: "border-purple-500/30",
            accentColor: "text-purple-500",
            bgAccent: "bg-purple-500/10",
            capacity: "Unlimited customers",
            capacityNote: "Fair Use: 100,000 messages/month",
            features: [
                "Everything in Pro",
                "Unlimited daily customers",
                "100,000 messages/month (Fair Use Policy)",
                "Dedicated support channel",
            ],
            ideal: "Large-scale operations and rapidly expanding platforms.",
            checkoutUrl: "https://octadezx.lemonsqueezy.com/checkout/buy/765de369-4c52-4814-aa34-a83983f3ce90",
            buttonText: "Subscribe to Enterprise",
            highlight: false,
        },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background">
            <div className="max-w-6xl w-full space-y-8">
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

                <div className="grid md:grid-cols-3 gap-4 items-stretch">
                    {plans.map((plan) => (
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
                                <CardDescription className="min-h-[20px] text-xs">{plan.ideal}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col space-y-4 text-left">
                                <div className={`${plan.bgAccent} p-3 rounded-lg text-center`}>
                                    <p className={`font-bold text-2xl ${plan.highlight ? plan.accentColor : ''}`}>
                                        {plan.price}{" "}
                                        <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <p className="font-semibold text-xs">Daily Capacity:</p>
                                    <p className="text-xs text-muted-foreground">{plan.capacity}</p>
                                    {plan.capacityNote && (
                                        <p className="text-xs text-muted-foreground opacity-70">{plan.capacityNote}</p>
                                    )}
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
                                    onClick={() => handleSubscribe(plan.checkoutUrl)}
                                >
                                    {plan.buttonText}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionLockScreen;
