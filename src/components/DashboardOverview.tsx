import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageSquare, Bot, AlertTriangle, ShoppingBag, Copy, ExternalLink,
  CheckCircle2, Circle, ArrowRight, Package, GraduationCap, BarChart3, Link2,
} from "lucide-react";
import { type Database } from "@/integrations/supabase/types";
import { type SectionId } from "@/lib/businessTypes";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

interface Props {
  business: Business;
  chatLink: string;
  onNavigate: (section: SectionId) => void;
}

interface Stats {
  total: number;
  resolved: number;
  escalated: number;
  orders: number;
  products: number;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const DashboardOverview = ({ business, chatLink, onNavigate }: Props) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkShared, setLinkShared] = useState(
    () => localStorage.getItem(`octadezx_link_shared_${business.id}`) === "1"
  );

  useEffect(() => {
    let alive = true;
    const count = (table: "chat_sessions" | "orders" | "products", status?: string) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("business_id", business.id);
      if (status) q = q.eq("status", status);
      return q.then(({ count: c }) => c ?? 0);
    };
    Promise.all([
      count("chat_sessions"),
      count("chat_sessions", "resolved"),
      count("chat_sessions", "escalated"),
      count("orders"),
      count("products"),
    ]).then(([total, resolved, escalated, orders, products]) => {
      if (alive) setStats({ total, resolved, escalated, orders, products });
    });
    return () => { alive = false; };
  }, [business.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chatLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      localStorage.setItem(`octadezx_link_shared_${business.id}`, "1");
      setLinkShared(true);
      toast({ title: "Link copied", description: "Share it anywhere your customers are." });
    });
  };

  const trained = Boolean(business.policies?.trim() || business.description?.trim());

  const checklist = useMemo(() => [
    { label: "Create your business", done: true, hint: "Done — welcome aboard", action: null as SectionId | null },
    { label: "Add your catalogue", done: (stats?.products ?? 0) > 0, hint: "Import from any store URL or CSV", action: "products" as SectionId },
    { label: "Train the AI", done: trained, hint: "Policies, tone and FAQs", action: "train" as SectionId },
    { label: "Share your chat link", done: linkShared, hint: "Or connect WhatsApp & Instagram", action: "integrations" as SectionId },
  ], [stats?.products, trained, linkShared]);

  const doneCount = checklist.filter((c) => c.done).length;
  const setupComplete = doneCount === checklist.length;

  const kpis = [
    { label: "Conversations", value: stats?.total, icon: MessageSquare, tone: "text-blue-600", bg: "bg-blue-500/10", sub: "All time", action: "chats" as SectionId },
    { label: "Resolved by AI", value: stats?.resolved, icon: Bot, tone: "text-emerald-600", bg: "bg-emerald-500/10", sub: stats && stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}% of all chats` : "No chats yet", action: "chats" as SectionId },
    { label: "Needs attention", value: stats?.escalated, icon: AlertTriangle, tone: (stats?.escalated ?? 0) > 0 ? "text-amber-600" : "text-muted-foreground", bg: (stats?.escalated ?? 0) > 0 ? "bg-amber-500/10" : "bg-muted", sub: (stats?.escalated ?? 0) > 0 ? "Escalated to your team" : "All clear", action: "escalated" as SectionId },
    { label: "Orders captured", value: stats?.orders, icon: ShoppingBag, tone: "text-violet-600", bg: "bg-violet-500/10", sub: "Confirmed by the AI", action: "orders" as SectionId },
  ];

  const quickActions = [
    { label: "View conversations", icon: MessageSquare, section: "chats" as SectionId },
    { label: "Import products", icon: Package, section: "products" as SectionId },
    { label: "Train the AI", icon: GraduationCap, section: "train" as SectionId },
    { label: "Open analytics", icon: BarChart3, section: "analytics" as SectionId },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome band ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white"
        style={{ background: "linear-gradient(135deg, #000047 0%, #1e1b5e 60%, #312e81 100%)" }}>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <div>
            <p className="text-sm text-white/70 mb-1">{greeting()},</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{business.name}</h2>
            <div className="flex items-center gap-2 mt-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <span className="text-sm text-white/85 font-medium">Your AI agent is live and answering customers</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0">
            <Button onClick={handleCopy} variant="secondary" className="press bg-white text-[#000047] hover:bg-white/90 font-semibold">
              <Copy className="h-4 w-4 mr-2" />{copied ? "Copied!" : "Copy chat link"}
            </Button>
            <Button onClick={() => window.open(chatLink, "_blank")} variant="outline"
              className="press border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white font-semibold">
              <ExternalLink className="h-4 w-4 mr-2" />Open live chat
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <button key={k.label} onClick={() => onNavigate(k.action)}
            className="press group text-left rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.bg}`}>
                <k.icon className={k.tone} size={18} />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {stats === null
              ? <Skeleton className="h-8 w-16 mb-1" />
              : <div className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{k.value}</div>}
            <div className="text-sm font-medium mt-0.5">{k.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6 items-start">

        {/* ── Setup checklist ── */}
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-base">{setupComplete ? "Setup complete" : "Finish setting up"}</h3>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">{doneCount} of {checklist.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {setupComplete
                ? "Your AI agent has everything it needs. Watch conversations roll in."
                : "Two minutes each — every step makes your AI meaningfully smarter."}
            </p>
            <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(doneCount / checklist.length) * 100}%`, background: "linear-gradient(90deg, #000047, #4f46e5)" }} />
            </div>
            <div className="space-y-1">
              {checklist.map((item) => (
                <button key={item.label}
                  onClick={() => item.action && !item.done && onNavigate(item.action)}
                  disabled={item.done || !item.action}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    item.done ? "opacity-70" : "hover:bg-muted press"
                  }`}>
                  {item.done
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.hint}</div>
                  </div>
                  {!item.done && item.action && <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Chat link + quick actions ── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-base">Test &amp; share your AI</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This link is both your <strong className="text-foreground">test drive</strong> and your storefront:
                open it to chat with your own AI like a customer would, then share it in your
                bio, auto-replies and receipts.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 min-w-0 truncate rounded-lg bg-muted px-3 py-2.5 text-xs">{chatLink}</code>
                <Button size="icon" variant="outline" onClick={handleCopy} aria-label="Copy chat link" className="press flex-shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => window.open(chatLink, "_blank")} variant="outline" size="sm" className="press w-full">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Test how your AI handles chats
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-base mb-4">Quick actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((a) => (
                  <button key={a.label} onClick={() => onNavigate(a.section)}
                    className="press flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5">
                    <a.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium leading-tight">{a.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
