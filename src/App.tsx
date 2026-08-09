import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/hooks/use-theme";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import AuthCallback from "@/components/AuthCallback";
import { useReferralCapture } from "@/hooks/useReferralCapture";
import { LogoIcon } from "@/components/ui/Logo";

// ── Landing page is the only page that loads eagerly (most visitors land here) ──
import Index from "./pages/Index";

// ── All other routes are lazy-loaded, each becomes its own chunk ──
// This means landing-page visitors don't download Dashboard, AdminDashboard,
// CustomerChat, etc. (~70% reduction in initial JS).
const Auth                   = lazy(() => import("./pages/Auth"));
const Authorize              = lazy(() => import("./pages/Authorize"));
const Dashboard              = lazy(() => import("./pages/Dashboard"));
const CustomerChat           = lazy(() => import("./pages/CustomerChat"));
const NotFound               = lazy(() => import("./pages/NotFound"));
const VerificationCompleted  = lazy(() => import("./pages/VerificationCompleted"));
const AdminDashboard         = lazy(() => import("./pages/AdminDashboard"));
const ResetPassword          = lazy(() => import("./pages/ResetPassword"));
const PrivacyPolicy          = lazy(() => import("./pages/PrivacyPolicy"));
const Platform               = lazy(() => import("./pages/Platform"));
const Solutions              = lazy(() => import("./pages/Solutions"));
const Resources              = lazy(() => import("./pages/Resources"));
const Customers              = lazy(() => import("./pages/Customers"));
const Integrations           = lazy(() => import("./pages/Integrations"));
const Pricing                = lazy(() => import("./pages/Pricing"));
const About                  = lazy(() => import("./pages/About"));
const Careers                = lazy(() => import("./pages/Careers"));
const Affiliates             = lazy(() => import("./pages/Affiliates"));
const Blog                   = lazy(() => import("./pages/Blog"));
const BlogPost               = lazy(() => import("./pages/BlogPost"));

const queryClient = new QueryClient();

// On route change: scroll to the #hash target (retrying while a lazy page
// mounts) or to the top of the page.
const ScrollManager = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ block: "start" }); return; }
      if (tries++ < 40) window.setTimeout(tryScroll, 50); // retry ~2s while a lazy page mounts
    };
    tryScroll();
  }, [pathname, hash]);
  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Branded loader shown while a lazy chunk is downloading, same visual
// language as the landing preloader so route changes feel intentional.
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative">
        <LogoIcon size="xl" />
        <div className="absolute -inset-2 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" style={{ animationDuration: "0.9s" }} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">OctaDezx</p>
    </div>
  </div>
);

const AppRoutes = () => {
  useReferralCapture();
  return (
    <>
      <AuthRedirectHandler />
      <ScrollManager />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Landing page, eager (no Suspense wait needed) */}
          <Route path="/" element={<Index />} />

          {/* Marketing sub-pages */}
          <Route path="/platform" element={<Platform />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/about" element={<About />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/affiliates" element={<Affiliates />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

          {/* Lazy-loaded routes */}
          <Route path="/auth" element={<Auth />} />
          {/* MCP OAuth consent screen (handles its own auth → /auth and back) */}
          <Route path="/authorize" element={<Authorize />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <SubscriptionGuard>
                <Dashboard />
              </SubscriptionGuard>
            </ProtectedRoute>
          } />
          <Route path="/chat/:businessId" element={<CustomerChat />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verification-completed" element={<VerificationCompleted />} />
          <Route path="/octadezx-admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
