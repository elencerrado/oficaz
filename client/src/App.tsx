import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/lib/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ReminderBanner } from "@/components/ui/reminder-banner";
import { GlobalDemoBanner } from "@/components/global-demo-banner";
import { TestBanner } from "@/components/test-banner";
import CookieBanner from "@/components/CookieBanner";
import { PageLoading } from "@/components/ui/page-loading";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { useState } from "react";
import { useDemoBanner } from "@/hooks/use-demo-banner";
import { useScrollReset } from "@/hooks/use-scroll-reset";

import { lazy, Suspense } from "react";

// Critical pages - loaded immediately
import Landing from "@/pages/landing";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Cookies from "@/pages/cookies";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AccessDenied from "@/pages/access-denied";

// Auth-related pages - lazy loaded
const RequestCode = lazy(() => import("@/pages/request-code"));
const VerifyCode = lazy(() => import("@/pages/verify-code"));

// Dashboard pages - loaded immediately for smooth navigation
import AdminDashboard from "@/pages/admin-dashboard";
import EmployeeDashboard from "@/pages/employee-dashboard";

// Core admin pages - loaded immediately to prevent layout shifts
import TimeTracking from "@/pages/time-tracking";
import EmployeeTimeTracking from "@/pages/employee-time-tracking";
import VacationRequests from "@/pages/vacation-requests";
import VacationManagement from "@/pages/vacation-management";
import Documents from "@/pages/documents";
import AdminDocuments from "@/pages/admin-documents";
import Messages from "@/pages/messages";
import Reminders from "@/pages/reminders";
import EmployeeReminders from "@/pages/employee-reminders";
import EmployeesSimple from "@/pages/employees-simple";
import Settings from "@/pages/settings";
import EmployeeProfile from "@/pages/employee-profile";

// Super admin pages - lazy loaded (rarely accessed)
const SuperAdminSecurity = lazy(() => import("@/pages/super-admin-security"));
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin-dashboard"));
const SuperAdminPlans = lazy(() => import("@/pages/super-admin-plans"));
const SuperAdminCompanyDetail = lazy(() => import("@/pages/super-admin-company-detail"));
const SuperAdminCompanies = lazy(() => import("@/pages/super-admin-companies"));
const SuperAdminInvitations = lazy(() => import("@/pages/super-admin-invitations"));

// Utility pages - lazy loaded
const InvitationRegister = lazy(() => import("@/pages/invitation-register"));

const EmployeeActivation = lazy(() => import("@/pages/employee-activation"));
const TestEmail = lazy(() => import("@/pages/test-email"));



function DashboardRouter() {
  const { user } = useAuth();
  
  if (user?.role === 'employee') {
    return <EmployeeDashboard />;
  }
  
  return <AdminDashboard />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showBanner } = useDemoBanner();
  
  // Reset scroll position on route changes
  useScrollReset();

  // Calculate padding-top dynamically
  // Header is positioned at top-[60px] when banner is shown, plus header height (60px) = 120px total
  const paddingTop = showBanner ? 'pt-[120px]' : 'pt-16'; // 60px banner + 60px header = 120px

  // Employee gets simplified view without sidebar - direct render
  if (user?.role === 'employee') {
    // Reset scroll for employees too
    useScrollReset();
    
    return (
      <>
        <ReminderBanner />
        {children}
      </>
    );
  }

  // Admin/Manager gets full layout with sidebar
  return (
    <div className="min-h-screen bg-background">
      <ReminderBanner />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main className={`lg:ml-64 min-h-screen ${paddingTop} bg-background`}>
        {children}
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, company, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (user && company) {
    return <Redirect to={`/${company.companyAlias}/inicio`} />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, company } = useAuth();
  const [location] = useLocation();
  
  // Super admin routes handled separately - PROTECTED: Only if no regular user session exists
  if (location.startsWith('/super-admin')) {
    // CRITICAL FIX: If user is logged in as regular user, redirect them out of SuperAdmin area
    if (user && company) {
      console.log('🚨 SECURITY: Regular user attempting to access SuperAdmin - redirecting');
      window.location.href = `/${company.companyAlias}/admin`;
      return <PageLoading />;
    }
    
    return (
      <Switch>
        <Route path="/super-admin/security">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminSecurity />
          </Suspense>
        </Route>

        <Route path="/super-admin/dashboard">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminDashboard />
          </Suspense>
        </Route>
        <Route path="/super-admin/plans">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminPlans />
          </Suspense>
        </Route>
        <Route path="/super-admin/companies">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminCompanies />
          </Suspense>
        </Route>
        <Route path="/super-admin/companies/:id">
          {(params) => (
            <Suspense fallback={<PageLoading />}>
              <SuperAdminCompanyDetail companyId={params.id} />
            </Suspense>
          )}
        </Route>
        <Route path="/super-admin/invitations">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminInvitations />
          </Suspense>
        </Route>
        <Route path="/super-admin">
          <Suspense fallback={<PageLoading />}>
            <SuperAdminSecurity />
          </Suspense>
        </Route>
        <Route component={NotFound} />
      </Switch>
    );
  }


  
  return (
    <Switch>
      {/* Legal pages */}
      <Route path="/privacy">
        <Privacy />
      </Route>

      <Route path="/terms">
        <Terms />
      </Route>

      <Route path="/cookies" component={Cookies} />

      {/* Public routes for authentication */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/forgot-password">
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      </Route>

      <Route path="/reset-password">
        <PublicRoute>
          <ResetPassword />
        </PublicRoute>
      </Route>

      <Route path="/request-code">
        <PublicRoute>
          <Suspense fallback={<PageLoading />}>
            <RequestCode />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/verify-code">
        <PublicRoute>
          <Suspense fallback={<PageLoading />}>
            <VerifyCode />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>

      <Route path="/registro/invitacion/:token">
        <PublicRoute>
          <Suspense fallback={<PageLoading />}>
            <InvitationRegister />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/employee-activation">
        <PublicRoute>
          <Suspense fallback={<PageLoading />}>
            <EmployeeActivation />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/test-email">
        <Suspense fallback={<PageLoading />}>
          <TestEmail />
        </Suspense>
      </Route>

      {/* Company-specific routes */}
      <Route path="/:companyAlias/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/:companyAlias/forgot-password">
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      </Route>

      {/* Employee dashboard route */}
      <Route path="/:companyAlias">
        {(params) => (
          <ProtectedRoute>
            {user && user.role === 'employee' ? (
              <EmployeeDashboard />
            ) : (
              <Redirect to={`/${params.companyAlias}/inicio`} />
            )}
          </ProtectedRoute>
        )}
      </Route>

      {/* Company-specific protected routes */}
      <Route path="/:companyAlias/inicio">
        <ProtectedRoute>
          <AppLayout>
            <DashboardRouter />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/control-tiempo">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeTimeTracking />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/misfichajes">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeTimeTracking />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/fichajes">
        <ProtectedRoute>
          <AppLayout>
            {user && (user.role === 'admin' || user.role === 'manager') ? (
              <TimeTracking />
            ) : (
              <Redirect to={`/${company?.companyAlias || 'test'}/misfichajes`} />
            )}
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/configuracion">
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/usuario">
        <ProtectedRoute>
          <EmployeeProfile />
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/vacaciones">
        <ProtectedRoute>
          <AppLayout>
            {user && (user.role === 'admin' || user.role === 'manager') ? (
              <VacationManagement />
            ) : (
              <VacationRequests />
            )}
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/documentos">
        <ProtectedRoute>
          <AppLayout>
            {user?.role === 'employee' ? (
              <Documents />
            ) : (
              <AdminDocuments />
            )}
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/mensajes">
        <ProtectedRoute>
          <AppLayout>
            <Messages />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/recordatorios">
        <ProtectedRoute>
          <AppLayout>
            {user?.role === 'employee' ? (
              <EmployeeReminders />
            ) : (
              <Reminders />
            )}
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/empleados">
        <ProtectedRoute>
          <AppLayout>
            <EmployeesSimple />
          </AppLayout>
        </ProtectedRoute>
      </Route>



      <Route path="/:companyAlias/access-denied">
        <AccessDenied />
      </Route>



      {/* Login/Register routes for non-authenticated users */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/forgot-password">
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      </Route>

      <Route path="/reset-password">
        <PublicRoute>
          <ResetPassword />
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>

      {/* Landing page - main entry point (must be last to avoid conflicts) */}
      <Route path="/">
        <PublicRoute>
          <Landing />
        </PublicRoute>
      </Route>

      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="oficaz-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GlobalDemoBanner />
          <TooltipProvider>
            <Toaster />
            <Router />
            <CookieBanner />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
