import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/hooks/use-theme";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import AuthCallback from "@/components/AuthCallback";
import { useReferralCapture } from "@/hooks/useReferralCapture";

// ── Landing page is the only page that loads eagerly (most visitors land here) ──
import Index from "./pages/Index";

// ── All other routes are lazy-loaded — each becomes its own chunk ──
// This means landing-page visitors don't download Dashboard, AdminDashboard,
// CustomerChat, etc. (~70% reduction in initial JS).
const Auth                   = lazy(() => import("./pages/Auth"));
const Dashboard              = lazy(() => import("./pages/Dashboard"));
const CustomerChat           = lazy(() => import("./pages/CustomerChat"));
const NotFound               = lazy(() => import("./pages/NotFound"));
const VerificationCompleted  = lazy(() => import("./pages/VerificationCompleted"));
const AdminDashboard         = lazy(() => import("./pages/AdminDashboard"));
const ResetPassword          = lazy(() => import("./pages/ResetPassword"));
const PrivacyPolicy          = lazy(() => import("./pages/PrivacyPolicy"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Minimal loader shown while a lazy chunk is downloading
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  </div>
);

const AppRoutes = () => {
  useReferralCapture();
  return (
    <>
      <AuthRedirectHandler />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Landing page — eager (no Suspense wait needed) */}
          <Route path="/" element={<Index />} />

          {/* Lazy-loaded routes */}
          <Route path="/auth" element={<Auth />} />
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
          <Route path="/pricing" element={<Navigate to="/" replace />} />
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
