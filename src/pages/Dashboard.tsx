import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LogOut, MessageSquare, Users, Settings, BookOpen, BarChart2,
  User as UserIcon, Copy, PlayCircle, ShoppingBag, CreditCard,
  ExternalLink, Plug, Menu, ChevronRight, Building2, X,
  Truck, FileText, ReceiptText,
} from "lucide-react";
import { LogoIcon } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { CancelSubscriptionDialog } from "@/components/CancelSubscriptionDialog";
import { DailyUsage } from "@/components/DailyUsage";
import BusinessSetup from "@/components/BusinessSetup";
import ProductCatalogWithScraper from "@/components/ProductCatalogWithScraper";
import ChatSessions from "@/components/ChatSessions";
import KnowledgeBase from "./KnowledgeBase";
import Analytics from "./Analytics";
import UserProfile from "@/components/UserProfile";
import BusinessSettings from "@/components/BusinessSettings";
import Orders from "@/components/Orders";
import PlatformIntegrations from "@/components/PlatformIntegrations";
import Shipments from "@/components/Shipments";
import Invoices from "@/components/Invoices";
import InvoiceSettings from "@/components/InvoiceSettings";
import { VideoPlayer } from "@/components/VideoPlayer";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type SectionId =
  | "profile" | "billing"
  | "overview" | "analytics" | "products" | "chats"
  | "orders" | "shipments" | "invoices" | "invoice-settings"
  | "integrations" | "knowledge-base" | "tutorial";

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
const ACCOUNT_NAV: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const BUSINESS_NAV: { id: SectionId; label: string; icon: React.ElementType; isNew?: boolean }[] = [
  { id: "overview", label: "Overview", icon: MessageSquare },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "products", label: "Products", icon: Settings },
  { id: "chats", label: "Chat Sessions", icon: Users },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "shipments", label: "Shipments", icon: Truck, isNew: true },
  { id: "invoices", label: "Invoices", icon: FileText, isNew: true },
  { id: "invoice-settings", label: "Invoice Settings", icon: ReceiptText },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "tutorial", label: "Tutorial", icon: PlayCircle },
];

// ── Main component ────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { status: subscriptionStatus, planType, trialEndsAt, isTrialExpired, loading: subLoading } = useSubscription();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.id) loadBusinesses();
    else setLoading(false);
  }, [user]);

  const loadBusinesses = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("businesses").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      const businessData = (data as Business[]) || [];
      setBusinesses(businessData);
      if (businessData.length > 0) setSelectedBusiness(businessData[0]);
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

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(
      () => toast({ title: "Copied!", description: "Chat link copied to clipboard." }),
      () => toast({ title: "Error", description: "Failed to copy link.", variant: "destructive" })
    );
  };

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
  const navigate = (section: SectionId) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const isBusinessSection = BUSINESS_NAV.some(n => n.id === activeSection);
  const currentNavItem = [...ACCOUNT_NAV, ...BUSINESS_NAV].find(n => n.id === activeSection);

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
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  selectedBusiness?.id === biz.id
                    ? "bg-primary text-primary-foreground"
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === id
                  ? "bg-primary text-primary-foreground font-medium"
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
            {BUSINESS_NAV.map(({ id, label, icon: Icon, isNew }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeSection === id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
                {isNew && (
                  <span className="ml-auto bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-primary/30">
                    NEW
                  </span>
                )}
                {activeSection === id && !isNew && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
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
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chat Link</CardTitle>
              <CardDescription>Share this link with your customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="bg-muted p-3 rounded-md overflow-x-auto flex-grow">
                  <code className="text-sm whitespace-nowrap">{generateChatLink(selectedBusiness.id)}</code>
                </div>
                <Button variant="outline" size="icon" onClick={() => handleCopyLink(generateChatLink(selectedBusiness.id))}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Add this to your auto-reply messages or share it on social media</p>
            </CardContent>
          </Card>
          <BusinessSettings business={selectedBusiness} onSettingsUpdated={handleSettingsUpdated} />
        </div>
      );
      case "analytics": return <Analytics businessId={selectedBusiness.id} />;
      case "products": return <ProductCatalogWithScraper businessId={selectedBusiness.id} />;
      case "chats": return <ChatSessions businessId={selectedBusiness.id} />;
      case "orders": return <Orders businessId={selectedBusiness.id} />;
      case "shipments": return <Shipments businessId={selectedBusiness.id} />;
      case "invoices": return <Invoices businessId={selectedBusiness.id} />;
      case "invoice-settings": return <InvoiceSettings business={selectedBusiness} onSettingsUpdated={handleSettingsUpdated} />;
      case "integrations": return <PlatformIntegrations businessId={selectedBusiness.id} />;
      case "knowledge-base": return <KnowledgeBase businessId={selectedBusiness.id} />;
      case "tutorial": return (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started with OctaDezx</CardTitle>
            <CardDescription>Watch this tutorial to learn how to set up and use your AI chatbot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="aspect-video w-full">
              <VideoPlayer videoId="1V-H3lsAXNc" title="OctaDezx Tutorial" />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Quick Start Steps:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Configure your business settings in Overview</li>
                <li>Add products via manual upload or URL scraper</li>
                <li>Set up knowledge base articles for common questions</li>
                <li>Test the chatbot using the Chat Link</li>
                <li>Monitor conversations in Chat Sessions</li>
                <li>Review analytics to improve customer service</li>
              </ol>
            </div>
            <div className="space-y-2 border-t pt-4">
              <h3 className="font-semibold">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Explore each section to get familiar with the platform. The Products section lets you import entire catalogs from Shopify, WooCommerce, and more.
              </p>
            </div>
          </CardContent>
        </Card>
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
        <div className="container mx-auto px-4 py-8">
          <BusinessSetup onBusinessCreated={loadBusinesses} />
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── HEADER ── */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* Left: Logo + business name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoIcon size="lg" />
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-base font-bold leading-tight truncate">
                {selectedBusiness?.name || "OctaDezx"}
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">Dashboard</p>
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
            {/* Desktop: email + plan badge + sign out */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[200px]">{user?.email}</span>
              {planType && PLAN_BADGES[planType] && (
                <Badge variant={PLAN_BADGES[planType].variant} className="text-xs">
                  {PLAN_BADGES[planType].label}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </div>

            {/* Mobile: hamburger button */}
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

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
          <div className="container max-w-5xl mx-auto px-4 py-6">
            {/* Page title on desktop */}
            <div className="hidden sm:flex items-center gap-2 mb-6">
              {currentNavItem && (
                <>
                  <currentNavItem.icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{currentNavItem.label}</h2>
                  {activeSection === "integrations" && (
                    <Badge className="text-[10px] px-1.5 py-0.5">NEW</Badge>
                  )}
                </>
              )}
            </div>

            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
