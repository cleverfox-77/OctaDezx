import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, CreditCard, BarChart3, HeadphonesIcon,
  Search, ChevronLeft, ChevronRight, DollarSign, TrendingUp, Activity,
  RefreshCw, Tag, Plus, Trash2, Copy, Power, PowerOff, Eye,
  MessageSquare, UserX, ExternalLink, Mail, Globe,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PlatformStats {
  total_users: number;
  active_subscriptions: number;
  mrr: number;
  total_businesses: number;
  plan_distribution: Record<string, number>;
  signups_last_30d: { date: string; count: number }[];
  daily_usage_today: number;
}

interface AdminUser {
  user_id: string;
  email: string;
  business_name: string | null;
  plan_type: string;
  subscription_status: string;
  lemon_squeezy_customer_id: string | null;
  created_at: string;
  business_count: number;
}

interface AdminBusiness {
  id: string;
  name: string;
  owner_email: string;
  owner_plan: string;
  is_active: boolean;
  created_at: string;
  products_count: number;
  sessions_count: number;
  orders_count: number;
  daily_usage_today: number;
}

interface DiscountCode {
  id: string;
  code: string;
  name: string | null;
  percentage: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  total_signups: number;
  paid_signups: number;
  mrr_contribution: number;
}

interface CodeUser {
  user_id: string;
  email: string;
  plan_type: string;
  subscription_status: string;
  created_at: string;
  mrr: number;
}

interface AdminChatSession {
  id: string;
  business_id: string;
  business_name: string;
  owner_email: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_url: string | null;
  created_at: string;
  is_anonymous: boolean;
  message_count: number;
  last_message_at: string | null;
  orders_count: number;
}

interface AdminSessionMessage {
  id: string;
  sender_type: "customer" | "ai" | "human";
  content: string;
  image_url: string | null;
  created_at: string;
}

interface ChatOriginSummary {
  business_id: string;
  business_name: string;
  owner_email: string | null;
  total_sessions: number;
  anonymous_sessions: number;
  identified_sessions: number;
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  trial: "bg-yellow-100 text-yellow-800",
  starter: "bg-blue-100 text-blue-800",
  pro: "bg-purple-100 text-purple-800",
  enterprise: "bg-green-100 text-green-800",
  appsumo_ltd: "bg-orange-100 text-orange-800",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-yellow-100 text-yellow-700",
  past_due: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  expired: "bg-gray-100 text-gray-500",
  none: "bg-gray-50 text-gray-400",
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Overview
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersPage, setUsersPage] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  // Businesses
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [bizTotal, setBizTotal] = useState(0);
  const [bizSearch, setBizSearch] = useState("");
  const [bizPage, setBizPage] = useState(0);
  const [bizLoading, setBizLoading] = useState(false);

  // Support (existing)
  const [tickets, setTickets] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);

  // Chat Sessions (admin)
  const [chatSessions, setChatSessions] = useState<AdminChatSession[]>([]);
  const [chatSessionsTotal, setChatSessionsTotal] = useState(0);
  const [chatSearch, setChatSearch] = useState("");
  const [chatBusinessFilter, setChatBusinessFilter] = useState<string>("");
  const [chatStatusFilter, setChatStatusFilter] = useState<string>("");
  const [chatAnonOnly, setChatAnonOnly] = useState(false);
  const [chatPage, setChatPage] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOriginSummary, setChatOriginSummary] = useState<ChatOriginSummary[]>([]);
  const [chatSummaryLoading, setChatSummaryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AdminChatSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<AdminSessionMessage[]>([]);
  const [sessionMessagesLoading, setSessionMessagesLoading] = useState(false);

  // Discounts
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [newCodeDialogOpen, setNewCodeDialogOpen] = useState(false);
  const [newCodeValue, setNewCodeValue] = useState("");
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [selectedCodeUsers, setSelectedCodeUsers] = useState<{ code: string; users: CodeUser[] } | null>(null);
  const [codeUsersLoading, setCodeUsersLoading] = useState(false);

  const PAGE_SIZE = 25;

  // ─── Admin Check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .single();
      // PGRST116 = no row (non-admin) — expected, not a real error
      if (data && !error) setIsAdmin(true);
    } catch (err) {
      console.error("Admin check failed:", err);
    } finally {
      setCheckingAdmin(false);
    }
  };

  // ─── Data Loaders ───────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_platform_stats");
      if (error) throw error;
      setStats(data as unknown as PlatformStats);
    } catch (err) {
      console.error("Error loading stats:", err);
      toast({ title: "Error", description: "Failed to load platform stats", variant: "destructive" });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (search = usersSearch, page = usersPage) => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_search: search,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      setUsers(result.users || []);
      setUsersTotal(result.total || 0);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearch, usersPage]);

  const loadBusinesses = useCallback(async (search = bizSearch, page = bizPage) => {
    setBizLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_businesses", {
        p_search: search,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      setBusinesses(result.businesses || []);
      setBizTotal(result.total || 0);
    } catch (err) {
      console.error("Error loading businesses:", err);
    } finally {
      setBizLoading(false);
    }
  }, [bizSearch, bizPage]);

  const loadSupport = useCallback(async () => {
    const { data: ticketsData } = await supabase
      .from("platform_support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: feedbackData } = await supabase
      .from("platform_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (ticketsData) setTickets(ticketsData);
    if (feedbackData) setFeedbacks(feedbackData);
  }, []);

  // ─── Chat Session Handlers ─────────────────────────────────────────────
  const loadChatSessions = useCallback(async (
    page = chatPage,
    search = chatSearch,
    bizId = chatBusinessFilter,
    status = chatStatusFilter,
    anonOnly = chatAnonOnly,
  ) => {
    setChatLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_chat_sessions" as any, {
        p_search: search,
        p_business_id: bizId || null,
        p_status: status || null,
        p_anonymous_only: anonOnly,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setChatSessions(result.sessions || []);
      setChatSessionsTotal(result.total || 0);
    } catch (err: any) {
      console.error("Error loading chat sessions:", err);
      toast({ title: "Error", description: err.message || "Failed to load chat sessions", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  }, [chatPage, chatSearch, chatBusinessFilter, chatStatusFilter, chatAnonOnly, toast]);

  const loadChatOriginSummary = useCallback(async () => {
    setChatSummaryLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_chat_origin_summary" as any, { p_days: 30 });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setChatOriginSummary(result.summary || []);
    } catch (err: any) {
      console.error("Error loading chat summary:", err);
    } finally {
      setChatSummaryLoading(false);
    }
  }, []);

  const handleViewSession = async (s: AdminChatSession) => {
    setSelectedSession(s);
    setSessionMessages([]);
    setSessionMessagesLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_session_messages" as any, {
        p_session_id: s.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setSessionMessages(result.messages || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSessionMessagesLoading(false);
    }
  };

  const handleChatSearch = () => {
    setChatPage(0);
    loadChatSessions(0);
  };

  const handleCopyChatUrl = (businessId: string) => {
    const url = `${window.location.origin}/chat/${businessId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Chat URL copied to clipboard" });
  };

  // ─── Discount Code Handlers ────────────────────────────────────────────
  const loadDiscountCodes = useCallback(async () => {
    setDiscountsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_discount_codes" as any);
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setDiscountCodes(result.codes || []);
    } catch (err: any) {
      console.error("Error loading discount codes:", err);
      toast({ title: "Error", description: err.message || "Failed to load discount codes", variant: "destructive" });
    } finally {
      setDiscountsLoading(false);
    }
  }, [toast]);

  const handleCreateCode = async () => {
    if (!newCodeValue.trim()) {
      toast({ title: "Error", description: "Code cannot be empty", variant: "destructive" });
      return;
    }
    setCreatingCode(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_discount_code" as any, {
        p_code: newCodeValue,
        p_name: newCodeName || null,
        p_notes: newCodeNotes || null,
        p_percentage: 10,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      toast({ title: "Code Created", description: `Discount code ${result.code} created successfully` });
      setNewCodeValue("");
      setNewCodeName("");
      setNewCodeNotes("");
      setNewCodeDialogOpen(false);
      loadDiscountCodes();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingCode(false);
    }
  };

  const handleToggleCode = async (id: string, newState: boolean) => {
    try {
      const { error } = await supabase.rpc("admin_toggle_discount_code" as any, {
        p_id: id,
        p_is_active: newState,
      });
      if (error) throw error;
      toast({ title: newState ? "Code Activated" : "Code Deactivated" });
      loadDiscountCodes();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteCode = async (id: string, code: string) => {
    if (!confirm(`Delete discount code "${code}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.rpc("admin_delete_discount_code" as any, {
        p_id: id,
      });
      if (error) throw error;
      toast({ title: "Code Deleted" });
      loadDiscountCodes();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleViewCodeUsers = async (code: string) => {
    setCodeUsersLoading(true);
    setSelectedCodeUsers({ code, users: [] });
    try {
      const { data, error } = await supabase.rpc("admin_get_code_users" as any, {
        p_code: code,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setSelectedCodeUsers({ code, users: result.users || [] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSelectedCodeUsers(null);
    } finally {
      setCodeUsersLoading(false);
    }
  };

  const handleCopyShareLink = (code: string) => {
    const link = `https://octadezx.com/?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: `Share link for ${code} copied to clipboard` });
  };

  // ─── Tab Change Handler ─────────────────────────────────────────────────
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case "overview":
        if (!stats) loadStats();
        break;
      case "users":
        if (users.length === 0) loadUsers("", 0);
        break;
      case "businesses":
        if (businesses.length === 0) loadBusinesses("", 0);
        break;
      case "subscriptions":
        if (users.length === 0) loadUsers("", 0);
        break;
      case "usage":
        if (!stats) loadStats();
        break;
      case "support":
        if (tickets.length === 0 && feedbacks.length === 0) loadSupport();
        break;
      case "discounts":
        if (discountCodes.length === 0) loadDiscountCodes();
        break;
      case "chats":
        if (chatSessions.length === 0) loadChatSessions(0, "", "", "", false);
        if (chatOriginSummary.length === 0) loadChatOriginSummary();
        break;
    }
  };

  // ─── User Search ────────────────────────────────────────────────────────
  const handleUserSearch = () => {
    setUsersPage(0);
    loadUsers(usersSearch, 0);
  };

  const handleBizSearch = () => {
    setBizPage(0);
    loadBusinesses(bizSearch, 0);
  };

  // ─── Plan Override ──────────────────────────────────────────────────────
  const handlePlanOverride = async (userId: string, newPlan: string) => {
    try {
      const { data, error } = await supabase.rpc("admin_update_user_plan", {
        p_user_id: userId,
        p_plan_type: newPlan,
      });
      if (error) throw error;
      const result = data as any;
      if (result.error) throw new Error(result.error);
      toast({ title: "Plan Updated", description: `User plan changed to ${newPlan}` });
      loadUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ─── Reply to Ticket ───────────────────────────────────────────────────
  const sendReply = async (ticketId: string) => {
    if (!reply) return;
    const { error } = await supabase
      .from("platform_support_tickets")
      .update({ admin_reply: reply, status: "resolved" })
      .eq("id", ticketId);
    if (!error) {
      toast({ title: "Replied" });
      setReply("");
      setActiveTicket(null);
      loadSupport();
    }
  };

  // ─── Guards ─────────────────────────────────────────────────────────────
  if (authLoading || checkingAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Checking permissions...</div>
      </div>
    );
  if (!isAdmin) return <Navigate to="/dashboard" />;

  // ─── Helper: KPI Card ──────────────────────────────────────────────────
  const KPICard = ({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: any; subtitle?: string }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 bg-primary/10 rounded-full">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Helper: Pagination ────────────────────────────────────────────────
  const Pagination = ({ total, page, setPage, load }: { total: number; page: number; setPage: (p: number) => void; load: (s?: string, p?: number) => void }) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => { setPage(page - 1); load(undefined, page - 1); }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => { setPage(page + 1); load(undefined, page + 1); }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Plan distribution chart (simple bar)
  const PlanDistribution = ({ distribution }: { distribution: Record<string, number> }) => {
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (total === 0) return <p className="text-sm text-muted-foreground">No data</p>;
    const plans = ["free", "trial", "starter", "pro", "enterprise", "appsumo_ltd"];
    return (
      <div className="space-y-3">
        {plans.map(plan => {
          const count = distribution[plan] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={plan} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{plan === "appsumo_ltd" ? "AppSumo LTD" : plan}</span>
                <span className="text-muted-foreground">{count} ({pct.toFixed(1)}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Signups chart (simple bar chart for last 30 days)
  const SignupsChart = ({ data }: { data: { date: string; count: number }[] }) => {
    if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No signups in the last 30 days</p>;
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-default group relative"
            style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            title={`${d.date}: ${d.count} signups`}
          />
        ))}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">OctaDezx Admin</h1>
          <Badge variant="destructive">Admin</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="businesses" className="gap-1.5">
              <Building2 className="h-4 w-4" /> Businesses
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-1.5">
              <CreditCard className="h-4 w-4" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Usage
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-1.5">
              <Tag className="h-4 w-4" /> Discounts
            </TabsTrigger>
            <TabsTrigger value="chats" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Chat Sessions
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5">
              <HeadphonesIcon className="h-4 w-4" /> Support
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
          <TabsContent value="overview">
            {statsLoading && !stats ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Platform Overview</h2>
                  <Button variant="outline" size="sm" onClick={loadStats} disabled={statsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <KPICard title="Total Users" value={stats.total_users} icon={Users} />
                  <KPICard title="Active Subscriptions" value={stats.active_subscriptions} icon={TrendingUp} />
                  <KPICard title="MRR" value={`$${stats.mrr}`} icon={DollarSign} />
                  <KPICard title="Total Businesses" value={stats.total_businesses} icon={Building2} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Plan Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PlanDistribution distribution={stats.plan_distribution} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">New Signups (Last 30 Days)</CardTitle>
                      <CardDescription>
                        {stats.signups_last_30d.reduce((a, d) => a + d.count, 0)} total signups
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SignupsChart data={stats.signups_last_30d} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-green-500" />
                      <span className="text-sm">
                        <strong>{stats.daily_usage_today}</strong> unique customer sessions today across all businesses
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Button onClick={loadStats}>Load Platform Stats</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════════════ USERS TAB ═══════════════════ */}
          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or business name..."
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUserSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleUserSearch} disabled={usersLoading}>Search</Button>
              </div>

              {usersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Plan</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Businesses</th>
                        <th className="text-left p-3 font-medium">Joined</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.user_id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <div>{u.email}</div>
                            {u.business_name && <div className="text-xs text-muted-foreground">{u.business_name}</div>}
                          </td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${PLAN_COLORS[u.plan_type] || "bg-gray-100"}`}>
                              {u.plan_type === "appsumo_ltd" ? "AppSumo LTD" : u.plan_type}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[u.subscription_status] || "bg-gray-50"}`}>
                              {u.subscription_status}
                            </span>
                          </td>
                          <td className="p-3 text-center">{u.business_count}</td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <Select onValueChange={val => handlePlanOverride(u.user_id, val)}>
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue placeholder="Change plan" />
                              </SelectTrigger>
                              <SelectContent>
                                {["free", "trial", "starter", "pro", "enterprise", "appsumo_ltd"].map(p => (
                                  <SelectItem key={p} value={p} className="text-xs">
                                    {p === "appsumo_ltd" ? "AppSumo LTD" : p}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            No users found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <Pagination total={usersTotal} page={usersPage} setPage={setUsersPage} load={loadUsers} />
            </div>
          </TabsContent>

          {/* ═══════════════════ BUSINESSES TAB ═══════════════════ */}
          <TabsContent value="businesses">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by business name or owner email..."
                    value={bizSearch}
                    onChange={e => setBizSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleBizSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleBizSearch} disabled={bizLoading}>Search</Button>
              </div>

              {bizLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Business</th>
                        <th className="text-left p-3 font-medium">Owner</th>
                        <th className="text-left p-3 font-medium">Plan</th>
                        <th className="text-center p-3 font-medium">Products</th>
                        <th className="text-center p-3 font-medium">Sessions</th>
                        <th className="text-center p-3 font-medium">Orders</th>
                        <th className="text-center p-3 font-medium">Today</th>
                        <th className="text-left p-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {businesses.map(b => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {b.name}
                              {!b.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{b.owner_email}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${PLAN_COLORS[b.owner_plan] || "bg-gray-100"}`}>
                              {b.owner_plan === "appsumo_ltd" ? "LTD" : b.owner_plan}
                            </span>
                          </td>
                          <td className="p-3 text-center">{b.products_count}</td>
                          <td className="p-3 text-center">{b.sessions_count}</td>
                          <td className="p-3 text-center">{b.orders_count}</td>
                          <td className="p-3 text-center font-medium">{b.daily_usage_today}</td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(b.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {businesses.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            No businesses found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <Pagination total={bizTotal} page={bizPage} setPage={setBizPage} load={loadBusinesses} />
            </div>
          </TabsContent>

          {/* ═══════════════════ SUBSCRIPTIONS TAB ═══════════════════ */}
          <TabsContent value="subscriptions">
            <div className="space-y-6">
              {/* Quick stats */}
              {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                  {["starter", "pro", "enterprise", "appsumo_ltd"].map(plan => (
                    <Card key={plan}>
                      <CardContent className="pt-6 text-center">
                        <p className="text-sm text-muted-foreground capitalize">
                          {plan === "appsumo_ltd" ? "AppSumo LTD" : plan}
                        </p>
                        <p className="text-2xl font-bold mt-1">{stats.plan_distribution[plan] || 0}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Paid subscribers table (reuses users data, filtered) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Paid Subscribers</CardTitle>
                  <CardDescription>All users with an active paid plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Email</th>
                          <th className="text-left p-3 font-medium">Plan</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">LS Customer ID</th>
                          <th className="text-left p-3 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {users
                          .filter(u => ["starter", "pro", "enterprise", "appsumo_ltd"].includes(u.plan_type))
                          .map(u => (
                            <tr key={u.user_id} className="hover:bg-muted/30">
                              <td className="p-3">{u.email}</td>
                              <td className="p-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${PLAN_COLORS[u.plan_type]}`}>
                                  {u.plan_type === "appsumo_ltd" ? "AppSumo LTD" : u.plan_type}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[u.subscription_status]}`}>
                                  {u.subscription_status}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground font-mono text-xs">
                                {u.lemon_squeezy_customer_id || "—"}
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        {users.filter(u => ["starter", "pro", "enterprise", "appsumo_ltd"].includes(u.plan_type)).length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                              No paid subscribers found. Load users first.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════ USAGE TAB ═══════════════════ */}
          <TabsContent value="usage">
            <div className="space-y-6">
              {stats ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <KPICard
                      title="Customers Today"
                      value={stats.daily_usage_today}
                      icon={Activity}
                      subtitle="Unique sessions across all businesses"
                    />
                    <KPICard
                      title="Total Users"
                      value={stats.total_users}
                      icon={Users}
                    />
                    <KPICard
                      title="Total Businesses"
                      value={stats.total_businesses}
                      icon={Building2}
                    />
                  </div>

                  {/* Top businesses by daily usage — load from businesses tab */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top Businesses by Daily Usage</CardTitle>
                      <CardDescription>
                        {businesses.length > 0
                          ? "Sorted by today's unique customer count"
                          : "Switch to the Businesses tab first to load data"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businesses.length > 0 ? (
                        <div className="space-y-3">
                          {[...businesses]
                            .sort((a, b) => b.daily_usage_today - a.daily_usage_today)
                            .slice(0, 10)
                            .map((b, i) => (
                              <div key={b.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-mono text-muted-foreground w-6">{i + 1}.</span>
                                  <div>
                                    <p className="text-sm font-medium">{b.name}</p>
                                    <p className="text-xs text-muted-foreground">{b.owner_email}</p>
                                  </div>
                                </div>
                                <Badge variant="outline">{b.daily_usage_today} today</Badge>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => loadBusinesses("", 0)}>
                          Load Business Data
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Button onClick={loadStats}>Load Usage Data</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════ DISCOUNTS TAB ═══════════════════ */}
          <TabsContent value="discounts">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">Discount Codes & Referrals</h2>
                  <p className="text-sm text-muted-foreground">
                    Create codes for influencers. Share <code className="text-xs bg-muted px-1 py-0.5 rounded">octadezx.com/?ref=CODE</code> and track signups & revenue per code.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadDiscountCodes} disabled={discountsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${discountsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Dialog open={newCodeDialogOpen} onOpenChange={setNewCodeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Discount Code</DialogTitle>
                        <DialogDescription>
                          All codes give 10% off. Remember to also create the matching code in your Lemon Squeezy dashboard with the same name.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="code">Code (uppercase, no spaces) *</Label>
                          <Input
                            id="code"
                            placeholder="e.g., JOHNDOE10"
                            value={newCodeValue}
                            onChange={(e) => setNewCodeValue(e.target.value.toUpperCase().replace(/\s/g, ""))}
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Influencer Name (optional)</Label>
                          <Input
                            id="name"
                            placeholder="e.g., John Doe YouTube"
                            value={newCodeName}
                            onChange={(e) => setNewCodeName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes (optional)</Label>
                          <Textarea
                            id="notes"
                            placeholder="e.g., Contact: john@example.com, 30% commission"
                            value={newCodeNotes}
                            onChange={(e) => setNewCodeNotes(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
                          <strong>Important:</strong> Before sharing this code, go to Lemon Squeezy → Discounts → create a new 10% discount with the exact same code <code className="font-mono">{newCodeValue || "CODE"}</code>, applicable to all products.
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewCodeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateCode} disabled={creatingCode}>
                          {creatingCode ? "Creating..." : "Create Code"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {discountsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
                </div>
              ) : discountCodes.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Tag className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No discount codes yet. Click "Create Code" to add your first influencer code.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {discountCodes.map(dc => (
                    <Card key={dc.id} className={!dc.is_active ? "opacity-60" : ""}>
                      <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-lg font-mono font-bold bg-primary/10 text-primary px-3 py-1 rounded">
                                {dc.code}
                              </code>
                              <Badge variant="outline">{dc.percentage}% off</Badge>
                              {!dc.is_active && <Badge variant="secondary">Inactive</Badge>}
                            </div>
                            {dc.name && <p className="text-sm font-medium">{dc.name}</p>}
                            {dc.notes && <p className="text-xs text-muted-foreground">{dc.notes}</p>}
                            <div className="flex gap-4 text-sm pt-2">
                              <div>
                                <span className="text-muted-foreground">Signups:</span>{" "}
                                <span className="font-semibold">{dc.total_signups}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Paid:</span>{" "}
                                <span className="font-semibold text-green-600">{dc.paid_signups}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">MRR:</span>{" "}
                                <span className="font-semibold">${dc.mrr_contribution}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleCopyShareLink(dc.code)}>
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              Copy Link
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleViewCodeUsers(dc.code)} disabled={dc.total_signups === 0}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              View Users
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleCode(dc.id, !dc.is_active)}>
                              {dc.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteCode(dc.id, dc.code)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Users for selected code */}
              {selectedCodeUsers && (
                <Dialog open={!!selectedCodeUsers} onOpenChange={(open) => !open && setSelectedCodeUsers(null)}>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Users from code: <code className="font-mono">{selectedCodeUsers.code}</code></DialogTitle>
                      <DialogDescription>
                        {codeUsersLoading ? "Loading..." : `${selectedCodeUsers.users.length} total signups`}
                      </DialogDescription>
                    </DialogHeader>
                    {codeUsersLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Email</th>
                              <th className="text-left p-3 font-medium">Plan</th>
                              <th className="text-left p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">MRR</th>
                              <th className="text-left p-3 font-medium">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedCodeUsers.users.map(u => (
                              <tr key={u.user_id}>
                                <td className="p-3">{u.email}</td>
                                <td className="p-3">
                                  <span className={`text-xs px-2 py-1 rounded-full ${PLAN_COLORS[u.plan_type] || "bg-gray-100"}`}>
                                    {u.plan_type === "appsumo_ltd" ? "LTD" : u.plan_type}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[u.subscription_status] || "bg-gray-50"}`}>
                                    {u.subscription_status}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-semibold">${u.mrr}</td>
                                <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                            {selectedCodeUsers.users.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">No users yet</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════ CHAT SESSIONS TAB ═══════════════════ */}
          <TabsContent value="chats">
            <div className="space-y-6">

              {/* Origin summary by business */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Chat Origin Summary (Last 30 Days)</CardTitle>
                    <CardDescription>Which business's chat link each session came from. Anonymous = customer didn't provide name/email.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadChatOriginSummary} disabled={chatSummaryLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${chatSummaryLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {chatSummaryLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                    </div>
                  ) : chatOriginSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No chat activity in the last 30 days.</p>
                  ) : (
                    <div className="space-y-2">
                      {chatOriginSummary.map(b => (
                        <div key={b.business_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="font-medium truncate">{b.business_name}</div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 ml-6">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{b.owner_email ?? "—"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-lg font-bold">{b.total_sessions}</div>
                              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">total</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-amber-600">{b.anonymous_sessions}</div>
                              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">anon</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">{b.identified_sessions}</div>
                              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">named</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setChatBusinessFilter(b.business_id);
                              setChatPage(0);
                              loadChatSessions(0, chatSearch, b.business_id, chatStatusFilter, chatAnonOnly);
                            }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyChatUrl(b.business_id)} title="Copy chat URL">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Chat Sessions</CardTitle>
                  <CardDescription>Every chat across every business — including anonymous visitors.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by customer, email, business, or session ID..."
                        value={chatSearch}
                        onChange={e => setChatSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleChatSearch()}
                        className="pl-9"
                      />
                    </div>
                    <Select value={chatStatusFilter || "all"} onValueChange={v => {
                      const next = v === "all" ? "" : v;
                      setChatStatusFilter(next);
                      setChatPage(0);
                      loadChatSessions(0, chatSearch, chatBusinessFilter, next, chatAnonOnly);
                    }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={chatAnonOnly ? "default" : "outline"}
                      onClick={() => {
                        const next = !chatAnonOnly;
                        setChatAnonOnly(next);
                        setChatPage(0);
                        loadChatSessions(0, chatSearch, chatBusinessFilter, chatStatusFilter, next);
                      }}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Anonymous only
                    </Button>
                    <Button onClick={handleChatSearch} disabled={chatLoading}>Search</Button>
                  </div>

                  {/* Business filter chip */}
                  {chatBusinessFilter && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="gap-1.5">
                        Filtered to business
                        <button onClick={() => {
                          setChatBusinessFilter("");
                          setChatPage(0);
                          loadChatSessions(0, chatSearch, "", chatStatusFilter, chatAnonOnly);
                        }} className="ml-1 hover:text-destructive">×</button>
                      </Badge>
                    </div>
                  )}

                  {chatLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No chat sessions found.</p>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Customer</th>
                            <th className="text-left p-3 font-medium">Business (chat URL origin)</th>
                            <th className="text-left p-3 font-medium">Source</th>
                            <th className="text-center p-3 font-medium">Msgs</th>
                            <th className="text-center p-3 font-medium">Orders</th>
                            <th className="text-left p-3 font-medium">Status</th>
                            <th className="text-left p-3 font-medium">Started</th>
                            <th className="text-left p-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {chatSessions.map(s => (
                            <tr key={s.id} className="hover:bg-muted/30">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {s.is_anonymous ? (
                                    <Badge variant="secondary" className="gap-1 text-[10px]">
                                      <UserX className="h-3 w-3" />Anon
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px]">Named</Badge>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-medium truncate max-w-[160px]">{s.customer_name ?? "Anonymous"}</div>
                                    {!s.is_anonymous && s.customer_email && (
                                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">{s.customer_email}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate max-w-[180px]">{s.business_name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground ml-5 truncate max-w-[180px]">{s.owner_email ?? "—"}</div>
                              </td>
                              <td className="p-3">
                                {s.source ? (
                                  <Badge variant="outline" className="capitalize text-[10px]">{s.source}</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">direct</span>
                                )}
                                {s.utm_campaign && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">UTM: {s.utm_campaign}</div>
                                )}
                              </td>
                              <td className="p-3 text-center">{s.message_count}</td>
                              <td className="p-3 text-center">
                                {s.orders_count > 0 ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{s.orders_count}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="p-3">
                                <Badge variant={s.status === "active" ? "default" : s.status === "escalated" ? "destructive" : "secondary"} className="text-[10px]">
                                  {s.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {new Date(s.created_at).toLocaleString()}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewSession(s)} title="View messages">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <a href={`${window.location.origin}/chat/${s.business_id}`} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="sm" title="Open chat URL">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Pagination total={chatSessionsTotal} page={chatPage} setPage={setChatPage} load={(_, p) => loadChatSessions(p ?? 0)} />
                </CardContent>
              </Card>
            </div>

            {/* Session detail dialog */}
            {selectedSession && (
              <Dialog open={!!selectedSession} onOpenChange={(o) => !o && setSelectedSession(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Chat session
                      {selectedSession.is_anonymous && <Badge variant="secondary" className="ml-2"><UserX className="h-3 w-3 mr-1" />Anonymous</Badge>}
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedSession.business_name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{selectedSession.owner_email ?? "—"}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Customer: <strong className="text-foreground">{selectedSession.customer_name ?? "Anonymous"}</strong></span>
                          {!selectedSession.is_anonymous && selectedSession.customer_email && <span>· {selectedSession.customer_email}</span>}
                          <span>· Source: <strong className="text-foreground capitalize">{selectedSession.source ?? "direct"}</strong></span>
                          {selectedSession.utm_campaign && <span>· UTM: {selectedSession.utm_campaign}</span>}
                          {selectedSession.referrer_url && (
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /><span className="truncate max-w-[200px]">{selectedSession.referrer_url}</span></span>
                          )}
                          <span>· {new Date(selectedSession.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto space-y-2 pt-2">
                    {sessionMessagesLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
                      </div>
                    ) : sessionMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No messages in this session.</p>
                    ) : sessionMessages.map(m => (
                      <div key={m.id} className={`flex ${m.sender_type === "customer" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          m.sender_type === "customer"
                            ? "bg-blue-500 text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}>
                          <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
                            {m.sender_type === "customer" ? "Customer" : m.sender_type === "ai" ? "AI" : "Human"}
                            <span className="ml-2 normal-case">{new Date(m.created_at).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                          {m.image_url && (
                            <div className="mt-2"><img src={m.image_url} alt="Attachment" className="rounded-lg max-w-full max-h-48 object-cover" /></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          {/* ═══════════════════ SUPPORT TAB ═══════════════════ */}
          <TabsContent value="support">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Support Tickets</h2>
                {tickets.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tickets yet.</p>
                )}
                {tickets.map(ticket => (
                  <Card key={ticket.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between">
                        <CardTitle className="text-sm text-muted-foreground">{ticket.id.slice(0, 8)}</CardTitle>
                        <Badge variant={ticket.status === "open" ? "destructive" : "default"}>
                          {ticket.status}
                        </Badge>
                      </div>
                      <CardDescription className="font-bold text-lg text-foreground">
                        {ticket.subject}
                      </CardDescription>
                      <div className="text-sm mt-2">{ticket.message}</div>
                    </CardHeader>
                    <CardContent>
                      {ticket.admin_reply ? (
                        <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm">
                          Reply: {ticket.admin_reply}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Write reply..."
                            value={activeTicket === ticket.id ? reply : ""}
                            onChange={e => {
                              setActiveTicket(ticket.id);
                              setReply(e.target.value);
                            }}
                          />
                          <Button size="sm" onClick={() => sendReply(ticket.id)}>
                            Send Reply
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-semibold">User Feedback</h2>
                {feedbacks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No feedback yet.</p>
                )}
                {feedbacks.map(fb => (
                  <Card key={fb.id}>
                    <CardHeader className="pb-2 flex flex-row justify-between">
                      <span className="font-bold text-yellow-500 text-xl">
                        {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString()}
                      </span>
                    </CardHeader>
                    <CardContent>
                      <p className="italic">"{fb.comment}"</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
