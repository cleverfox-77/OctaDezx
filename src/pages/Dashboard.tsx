import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LogOut, User as UserIcon, CreditCard,
  ExternalLink, Menu, ChevronRight, Building2, X, Search,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { LogoIcon } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
import { DailyUsage } from "@/components/DailyUsage";
import BusinessSetup from "@/components/BusinessSetup";
import DashboardOverview from "@/components/DashboardOverview";
import LeadsFollowups from "@/components/LeadsFollowups";
import ProductCatalogWithScraper from "@/components/ProductCatalogWithScraper";
import ChatSessions from "@/components/ChatSessions";
import KnowledgeBase from "./KnowledgeBase";
import Analytics from "./Analytics";
import UserProfile from "@/components/UserProfile";
import BusinessSettings from "@/components/BusinessSettings";
import Orders from "@/components/Orders";
import ApiKeys from "@/components/ApiKeys";
import PlatformIntegrations from "@/components/PlatformIntegrations";
import Shipments from "@/components/Shipments";
import Invoices from "@/components/Invoices";
import InvoiceSettings from "@/components/InvoiceSettings";
import AiTraining from "@/components/AiTraining";
import McpConnect from "@/components/McpConnect";
import { VideoPlayer } from "@/components/VideoPlayer";
import { navForType, sectionLabel, SECTION_DESCRIPTIONS, type SectionId } from "@/lib/businessTypes";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
// Account sections live outside the per-type business nav.
type AccountSectionId = "profile" | "billing";
type ActiveSection = AccountSectionId | SectionId;

// ── Plan metadata ─────────────────────────────────────────────────
const PLAN_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trial: { label: "Trial", variant: "secondary" },
  free: { label: "Free", variant: "outline" },
  starter: { label: "Starter", variant: "default" },
  pro: { label: "Pro", variant: "default" },
  enterprise: { label: "Enterprise", variant: "default" },
  appsumo_ltd: { label: "Lifetime", variant: "default" },
};

const PLAN_PRICES: Record<string, string> = {
  trial: "Free trial",
  free: "No active plan",
  starter: "$9/month",
  pro: "$29/month",
  enterprise: "$99/month",
  appsumo_ltd: "$230 one-time",
};

const MANAGE_PORTAL_URL = "https://octadezx.lemonsqueezy.com/billing";

// ── Navigation definition ─────────────────────────────────────────
// The business-tools nav is built per business type (navForType) so a
// restaurant never sees "Shipments" and an agency never sees "Invoices".
const ACCOUNT_NAV: { id: AccountSectionId; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "billing", label: "Billing", icon: CreditCard },
];

// ── Main component ────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { status: subscriptionStatus, planType, trialEndsAt, isTrialExpired, loading: subLoading, checkAccess } = useSubscription();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K command palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Business-tools nav, tailored to the selected business's type.
  const businessNav = useMemo(
    () => navForType(selectedBusiness?.business_type),
    [selectedBusiness?.business_type],
  );

  // If the active business section doesn't exist for the newly selected type
  // (e.g. switching from an e-commerce store to an agency that has no Shipments),
  // fall back to Overview so the user never lands on a blank panel.
  useEffect(() => {
    const isAccount = activeSection === "profile" || activeSection === "billing";
    if (!isAccount && selectedBusiness && !businessNav.some((n) => n.id === activeSection)) {
      setActiveSection("overview");
    }
  }, [businessNav, activeSection, selectedBusiness]);

  useEffect(() => {
    if (user?.id) loadBusinesses();
    else setLoading(false);
  }, [user]);

  // Badge on the "Escalated Chats" nav item so handed-off customers aren't missed.
  useEffect(() => {
    if (!selectedBusiness?.id) { setEscalatedCount(0); return; }
    const fetchCount = async () => {
      const { count } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", selectedBusiness.id)
        .eq("status", "escalated");
      setEscalatedCount(count ?? 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [selectedBusiness?.id, activeSection]);

  const loadBusinesses = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("businesses").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      const businessData = (data as Business[]) || [];
      setBusinesses(businessData);
      if (businessData.length > 0) {
        const first = businessData[0];
        setSelectedBusiness(first);
        // Drop freshly-onboarded (untrained) businesses straight into Train AI —
        // that's where they add the info the assistant answers from.
        const cfg = (first.type_config && typeof first.type_config === "object" ? first.type_config : {}) as Record<string, unknown>;
        const untrained = !first.policies?.trim() && !first.description?.trim() && Object.keys(cfg).length === 0;
        if (untrained) setActiveSection("train");
      }
    } catch {
      toast({ title: "Error", description: "Failed to load businesses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const generateChatLink = (businessId: string) => `${window.location.origin}/chat/${businessId}`;

  const handleSettingsUpdated = (updatedBusiness: Business) => {
    setSelectedBusiness(updatedBusiness);
    setBusinesses(businesses.map(b => b.id === updatedBusiness.id ? updatedBusiness : b));
  };

  const handleBusinessNameUpdated = async (newBusinessName: string) => {
    if (!selectedBusiness) return;
    try {
      const { data, error } = await supabase
        .from("businesses").update({ name: newBusinessName })
        .eq("id", selectedBusiness.id).select().single();
      if (error) throw error;
      if (data) {
        setSelectedBusiness(data);
        setBusinesses(businesses.map(b => b.id === data.id ? data : b));
        toast({ title: "Business Name Updated", description: `Name updated to "${newBusinessName}".` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Navigate and close mobile menu
  const navigate = (section: ActiveSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const isBusinessSection = businessNav.some(n => n.id === activeSection);
  const currentNavItem = [...ACCOUNT_NAV, ...businessNav].find(n => n.id === activeSection);

  // ── Loading skeleton ───────────────────────────────────────────
  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-36 rounded-md hidden sm:block" />
              <Skeleton className="h-9 w-24 rounded-md hidden sm:block" />
              <Skeleton className="h-9 w-9 rounded-md sm:hidden" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 space-y-6">
          <div className="flex gap-2 flex-wrap">
            {[88, 110, 72].map((w, i) => <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <Card key={i}><CardHeader className="pb-2 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-16" /></CardHeader><CardContent><Skeleton className="h-3 w-32" /></CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Sidebar nav content (shared between desktop sidebar & mobile sheet) ──
  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Business selector */}
      {businesses.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Business</p>
          <div className="space-y-1">
            {businesses.map(biz => (
              <button
                key={biz.id}
                onClick={() => { setSelectedBusiness(biz); if (isBusinessSection) setMobileMenuOpen(false); }}
                className={`side-item w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                  selectedBusiness?.id === biz.id
                    ? "active bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate font-medium">{biz.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Account section */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Account</p>
        <div className="space-y-0.5">
          {ACCOUNT_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`side-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                activeSection === id
                  ? "active bg-primary text-primary-foreground font-medium shadow-sm"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {activeSection === id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Business tools section */}
      {selectedBusiness && (
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Business Tools</p>
          <div className="space-y-0.5">
            {businessNav.map(({ id, label, icon: Icon, isNew }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`side-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  activeSection === id
                    ? "active bg-primary text-primary-foreground font-medium shadow-sm"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
                {id === "escalated" && escalatedCount > 0 ? (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                    {escalatedCount}
                  </span>
                ) : isNew ? (
                  <span className="ml-auto bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-primary/30">
                    NEW
                  </span>
                ) : (
                  activeSection === id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sign out at bottom */}
      <div className="mt-auto pt-4 border-t">
        <div className="px-2 mb-3">
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          {planType && PLAN_BADGES[planType] && (
            <Badge variant={PLAN_BADGES[planType].variant} className="text-xs mt-1">
              {PLAN_BADGES[planType].label}
            </Badge>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  // ── Section content ────────────────────────────────────────────
  const renderContent = () => {
    if (activeSection === "profile") return <UserProfile onBusinessNameUpdated={handleBusinessNameUpdated} />;

    if (activeSection === "billing") return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Subscription & Billing</CardTitle>
            <CardDescription>Manage your plan, view usage, and update billing details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-bold">{PLAN_BADGES[planType]?.label || planType}</span>
                  <Badge variant={PLAN_BADGES[planType]?.variant || "outline"}>
                    {subscriptionStatus === "cancelled" ? "Cancelled" : subscriptionStatus === "past_due" ? "Past Due" : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{PLAN_PRICES[planType] || ""}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(MANAGE_PORTAL_URL, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />Manage Billing
                </Button>
                {planType !== "free" && planType !== "trial" && planType !== "appsumo_ltd" && subscriptionStatus !== "cancelled" && (
                  <CancelSubscriptionDialog planType={planType}>
                    <Button variant="destructive" size="sm">Cancel Subscription</Button>
                  </CancelSubscriptionDialog>
                )}
                {planType === "appsumo_ltd" && (
                  <Badge variant="secondary" className="text-xs self-center">Lifetime — No cancellation needed</Badge>
                )}
              </div>
            </div>
            {planType === "trial" && trialEndsAt && !isTrialExpired && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Trial expires: {trialEndsAt.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Upgrade to a paid plan to keep your AI chat active after the trial ends.</p>
              </div>
            )}
            {subscriptionStatus === "cancelled" && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Your subscription is cancelled and remains active until the billing period ends.</p>
                <p className="text-xs text-muted-foreground mt-1">You can resubscribe anytime to regain full access.</p>
              </div>
            )}
          </CardContent>
        </Card>
        {(selectedBusiness || businesses[0]) && <DailyUsage businessId={(selectedBusiness || businesses[0]).id} />}
      </div>
    );

    // Business sections — require a selected business
    if (!selectedBusiness) {
      return <BusinessSetup onBusinessCreated={loadBusinesses} />;
    }

    switch (activeSection) {
      case "overview": return (
        <div className="space-y-6">
          <DashboardOverview
            business={selectedBusiness}
            chatLink={generateChatLink(selectedBusiness.id)}
            onNavigate={navigate}
          />
          <BusinessSettings business={selectedBusiness} onSettingsUpdated={handleSettingsUpdated} />
        </div>
      );
      case "train": return (
        <AiTraining
          business={selectedBusiness}
          onSaved={handleSettingsUpdated}
          onNavigate={navigate}
          productsLabel={sectionLabel(selectedBusiness.business_type, "products")}
        />
      );
      case "claude-mcp": return (
        <McpConnect
          businessId={selectedBusiness.id}
          subscribed={checkAccess()}
          onUpgrade={() => navigate("billing")}
        />
      );
      case "analytics": return <Analytics businessId={selectedBusiness.id} />;
      case "products": return <ProductCatalogWithScraper businessId={selectedBusiness.id} />;
      case "chats": return <ChatSessions businessId={selectedBusiness.id} />;
      case "escalated": return <ChatSessions businessId={selectedBusiness.id} filter="escalated" />;
      case "leads": return <LeadsFollowups business={selectedBusiness} onBusinessUpdated={handleSettingsUpdated} />;
      case "api-keys": return <ApiKeys businessId={selectedBusiness.id} />;
      case "orders": return <Orders businessId={selectedBusiness.id} />;
      case "shipments": return <Shipments businessId={selectedBusiness.id} />;
      case "invoices": return <Invoices businessId={selectedBusiness.id} />;
      case "invoice-settings": return <InvoiceSettings business={selectedBusiness} onSettingsUpdated={handleSettingsUpdated} />;
      case "integrations": return <PlatformIntegrations businessId={selectedBusiness.id} />;
      case "knowledge-base": return <KnowledgeBase businessId={selectedBusiness.id} />;
      case "tutorial": return (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="aspect-video w-full">
              <VideoPlayer videoId="1V-H3lsAXNc" title="OctaDezx Tutorial" />
            </div>
            <CardContent className="pt-5">
              <h3 className="font-semibold text-base mb-1">Getting started with OctaDezx</h3>
              <p className="text-sm text-muted-foreground">
                A full walkthrough of setup, training and going live — about 5 minutes.
              </p>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              ["01", "Set up your basics", "Business details and AI personality live in Overview.", "overview"],
              ["02", "Import your catalogue", "Add products manually, by CSV or straight from a store URL.", "products"],
              ["03", "Teach it your answers", "Knowledge base articles cut escalations dramatically.", "knowledge-base"],
              ["04", "Test it yourself", "Open your chat link and talk to your own AI like a customer.", "overview"],
              ["05", "Watch conversations", "Every chat is transcribed — jump in whenever you want.", "chats"],
              ["06", "Improve with data", "Analytics shows what customers ask and what converts.", "analytics"],
            ] as [string, string, string, SectionId][]).map(([num, title, desc, target]) => (
              <button key={num} onClick={() => navigate(target)}
                className="press group text-left rounded-2xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-black text-muted-foreground/20 select-none">{num}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-sm font-semibold mb-1">{title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </div>
      );
      default: return null;
    }
  };

  // ── No business yet ────────────────────────────────────────────
  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <LogoIcon size="lg" />
              <h1 className="text-lg font-bold">OctaDezx</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>
        <div className="relative">
          <div className="absolute inset-0 bg-grid-subtle opacity-40 pointer-events-none"
            style={{ maskImage: "linear-gradient(to bottom, #000, transparent 80%)", WebkitMaskImage: "linear-gradient(to bottom, #000, transparent 80%)" }} />
          <div className="relative container mx-auto px-4 py-10 sm:py-14">
            <BusinessSetup onBusinessCreated={loadBusinesses} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── HEADER ── */}
      <header className="border-b header-glass sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* Left: Logo + business name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoIcon size="lg" />
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-base font-bold leading-tight truncate">
                {selectedBusiness?.name || "OctaDezx"}
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Dashboard{currentNavItem ? ` · ${currentNavItem.label}` : ""}
              </p>
            </div>
            <h1 className="text-base font-bold sm:hidden truncate max-w-[140px]">
              {selectedBusiness?.name || "OctaDezx"}
            </h1>
          </div>

          {/* Center: active section breadcrumb (mobile only) */}
          <div className="flex-1 flex items-center justify-center sm:hidden">
            {currentNavItem && (
              <span className="text-sm font-medium text-muted-foreground">{currentNavItem.label}</span>
            )}
          </div>

          {/* Right: desktop actions + mobile hamburger */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop: search + email + plan badge + sign out */}
            <div className="hidden sm:flex items-center gap-3">
              <button
                onClick={() => setCmdOpen(true)}
                className="press flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                aria-label="Open command palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Jump to…</span>
                <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  Ctrl K
                </kbd>
              </button>
              <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[200px]">{user?.email}</span>
              {planType && PLAN_BADGES[planType] && (
                <Badge variant={PLAN_BADGES[planType].variant} className="text-xs">
                  {PLAN_BADGES[planType].label}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="press">
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </div>

            {/* Mobile: hamburger button */}
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden press"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── COMMAND PALETTE (⌘K) ── */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Jump to a section…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {selectedBusiness && (
            <CommandGroup heading="Business Tools">
              {businessNav.map(({ id, label, icon: Icon }) => (
                <CommandItem
                  key={id}
                  value={label}
                  onSelect={() => { navigate(id); setCmdOpen(false); }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                  {id === "escalated" && escalatedCount > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px]">{escalatedCount}</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Account">
            {ACCOUNT_NAV.map(({ id, label, icon: Icon }) => (
              <CommandItem
                key={id}
                value={label}
                onSelect={() => { navigate(id); setCmdOpen(false); }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </CommandItem>
            ))}
            <CommandItem value="Sign out" onSelect={() => { setCmdOpen(false); handleSignOut(); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* ── MOBILE SHEET MENU ── */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <LogoIcon size="sm" />
                OctaDezx
              </SheetTitle>
              <button onClick={() => setMobileMenuOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <NavContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden sm:flex w-60 lg:w-64 flex-shrink-0 border-r bg-card flex-col overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)]">
          <div className="flex-1 px-3 py-4">
            <NavContent />
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          {/* key remounts the wrapper per section so every switch gets the
              same brief enter transition — navigation feels acknowledged */}
          <div key={activeSection} className="section-enter container max-w-5xl mx-auto px-4 py-6">
            {/* Page title + purpose on desktop */}
            {currentNavItem && (
              <div className="hidden sm:block mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <currentNavItem.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight">{currentNavItem.label}</h2>
                  {activeSection === "integrations" && (
                    <Badge className="text-[10px] px-1.5 py-0.5">NEW</Badge>
                  )}
                </div>
                {activeSection !== "profile" && activeSection !== "billing" && (
                  <p className="text-sm text-muted-foreground mt-1.5 ml-[46px]">
                    {SECTION_DESCRIPTIONS[activeSection as SectionId]}
                  </p>
                )}
              </div>
            )}

            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
