import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureCheck } from "@/hooks/use-feature-check";
import { clearAuthData } from "@/lib/auth";
import { useEmployeeViewMode } from "@/hooks/use-employee-view-mode";
import { PageLoading } from "@/components/ui/page-loading";
import { AuthPageLoading } from "@/components/ui/auth-page-loading";
import { useState } from "react";
import * as React from "react";
import { useDemoBanner } from "@/hooks/use-demo-banner";
import { useScrollReset } from "@/hooks/use-scroll-reset";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { SidebarProvider, useSidebarState } from "@/hooks/use-sidebar-state";
import { SidebarScrollProvider } from "@/hooks/use-sidebar-scroll";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ReminderBanner } from "@/components/ui/reminder-banner";
import { TestBanner } from "@/components/test-banner";
import { updateThemeColor, THEME_COLORS } from "@/lib/theme-provider";
import type { FeatureKey } from "@/lib/feature-restrictions";
import { useQuery } from "@tanstack/react-query";
import oficazLogo from "@/assets/oficaz-logo.png";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const featureToAddonKey: Record<string, string> = {
  timeTracking: 'time_tracking',
  vacation: 'vacation',
  schedules: 'schedules',
  documents: 'documents',
  messages: 'messages',
  reminders: 'reminders',
  work_reports: 'work_reports',
  reports: 'work_reports',
  ai_assistant: 'ai_assistant',
  inventory: 'inventory',
  accounting: 'accounting',
};

import { lazy, Suspense } from "react";

// Critical pages - loaded immediately
import PublicLanding from "@/pages/public-landing";
import PublicPrivacy from "@/pages/public-privacy";
import PublicTerms from "@/pages/public-terms";
import PublicCookies from "@/pages/public-cookies";
import PublicLegalNotice from "@/pages/public-legal-notice";
import PublicNotFound from "@/pages/public-not-found";
import PublicLogin from "@/pages/public-login";
import PublicRegister from "@/pages/public-register";
import PublicForgotPassword from "@/pages/public-forgot-password";
import PublicResetPassword from "@/pages/public-reset-password";
import PublicAccessDenied from "@/pages/public-access-denied";

// Auth-related pages - lazy loaded
const PublicRequestCode = lazy(() => import("@/pages/public-request-code"));
const PublicVerifyCode = lazy(() => import("@/pages/public-verify-code"));

// Dashboard pages - loaded immediately for smooth navigation
import AdminDashboard from "@/pages/admin-dashboard";
import EmployeeDashboard from "@/pages/employee-dashboard";

// Core admin pages - loaded immediately to prevent layout shifts
import AdminTimeTracking from "@/pages/admin-time-tracking";
import EmployeeTimeTracking from "@/pages/employee-time-tracking";
import EmployeeVacationRequests from "@/pages/employee-vacation-requests";
import AdminVacationManagement from "@/pages/admin-vacation-management";
import AdminSchedules from "@/pages/admin-schedules";
import EmployeeDocuments from "@/pages/employee-documents";
import AdminDocuments from "@/pages/admin-documents";
import AdminEmployeeMessages from "@/pages/admin-employee-messages";
import AdminReminders from "@/pages/admin-reminders";
import EmployeeReminders from "@/pages/employee-reminders";
import AdminEmployees from "@/pages/admin-employees";
import EmployeeSettings from "@/pages/employee-settings";
import EmployeeProfile from "@/pages/employee-profile";
import EmployeeSchedule from "@/pages/employee-schedule";
import EmployeeNotificationDevices from "@/pages/employee-notification-devices";
import EmployeeWorkReports from "@/pages/employee-work-reports";
import AdminWorkReports from "@/pages/admin-work-reports";
import AdminEmployeeAddonStore from "@/pages/admin-employee-addon-store";
import AdminInventory from "@/pages/admin-inventory";
import AdminAccounting from "@/pages/admin-accounting";
import EmployeeExpenses from "@/pages/employee-expenses";
import AdminCRM from "@/pages/admin-crm";
import AccountantDashboard from "@/pages/accountant-dashboard";
import AccountantAccounting from "@/pages/accountant-accounting";
import AccountantDocuments from "@/pages/accountant-documents";

// Super admin pages - lazy loaded (rarely accessed)
const SuperAdminSecurity = lazy(() => import("@/pages/super-admin-security"));
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin-dashboard"));
const SuperAdminMetrics = lazy(() => import("@/pages/super-admin-metrics"));
const SuperAdminPlans = lazy(() => import("@/pages/super-admin-plans"));
const SuperAdminPricing = lazy(() => import("@/pages/super-admin-pricing"));
const SuperAdminCompanyDetail = lazy(() => import("@/pages/super-admin-company-detail"));
const SuperAdminCompanies = lazy(() => import("@/pages/super-admin-companies"));
const SuperAdminInvitations = lazy(() => import("@/pages/super-admin-invitations"));
const SuperAdminPromoCodes = lazy(() => import("@/pages/super-admin-promo-codes"));
const SuperAdminMarketing = lazy(() => import("@/pages/super-admin-marketing"));
const SuperAdminLandingMetrics = lazy(() => import("@/pages/super-admin-landing-metrics"));

// SuperAdmin specific loading component
import { SuperAdminPageLoading } from "@/components/layout/super-admin-page-loading";

// Utility pages - lazy loaded
const PublicInvitationRegister = lazy(() => import("@/pages/public-invitation-register"));
const EmployeeActivation = lazy(() => import("@/pages/employee-activation"));
const TestEmail = lazy(() => import("@/pages/test-email"));

function DashboardRouter() {
  const { user } = useAuth();
  const { isEmployeeViewMode } = useEmployeeViewMode();
  
  if (user?.role === 'employee' || isEmployeeViewMode) {
    return <EmployeeDashboard />;
  }
  
  return <AdminDashboard />;
}

function RoleBasedPage({ 
  adminComponent: AdminComponent, 
  employeeComponent: EmployeeComponent 
}: { 
  adminComponent: React.ComponentType; 
  employeeComponent: React.ComponentType;
}) {
  const { user } = useAuth();
  const { isEmployeeViewMode } = useEmployeeViewMode();
  
  if (user?.role === 'employee' || isEmployeeViewMode) {
    return <EmployeeComponent />;
  }
  
  return <AdminComponent />;
}

function SubscriptionExpiredScreen() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  
  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <img 
          src={oficazLogo} 
          alt="Oficaz" 
          className="h-16 w-auto mx-auto mb-8"
          data-testid="img-oficaz-logo"
        />
        <h1 
          className="text-2xl font-semibold text-gray-900 dark:text-white mb-3"
          data-testid="text-subscription-expired-title"
        >
          Tu suscripción ha caducado
        </h1>
        <p 
          className="text-gray-600 dark:text-gray-400 mb-8"
          data-testid="text-subscription-expired-message"
        >
          Ponte en contacto con tu administrador para renovar la suscripción y seguir utilizando Oficaz.
        </p>
        <Button 
          onClick={handleLogout}
          variant="outline"
          className="gap-2"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, company, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: trialStatus, isLoading: trialLoading } = useQuery<{ isBlocked: boolean }>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
    enabled: !!user && user.role !== 'accountant',
  });

  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      clearAuthData();
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
      setLocation('/login');
    }
  }, [user, token, isLoading, setLocation]);

  // Don't block rendering - let children render even while loading
  // The page will show its own loading state (spinner) instead of full-screen block
  if (!user || !token) {
    return <PageLoading />;
  }
  
  // Accountants are external and not tied to company trials or store
  if (user.role === 'accountant') {
    return <>{children}</>;
  }

  const isTrialExpired = trialStatus?.isBlocked === true;
  
  if (isTrialExpired) {
    if (user.role === 'admin') {
      const companyAlias = company?.companyAlias || 'test';
      return <Redirect to={`/${companyAlias}/tienda`} />;
    }
    return <SubscriptionExpiredScreen />;
  }

  return <>{children}</>;
}

function FeatureProtectedRoute({ 
  children, 
  feature 
}: { 
  children: React.ReactNode; 
  feature: FeatureKey;
}) {
  const { user, company } = useAuth();
  const { hasAccess, isLoading } = useFeatureCheck();

  // Don't block rendering while feature check loads - let page render and handle restrictions
  if (isLoading) {
    return <>{children}</>;
  }

  // Accountants do not depend on store/features; redirect to their routes
  if (user?.role === 'accountant') {
    if (feature === 'accounting') {
      return <Redirect to={'/accountant/contabilidad'} />;
    }
    if (feature === 'documents') {
      return <Redirect to={'/accountant/documentos'} />;
    }
    return <>{children}</>;
  }

  if (!hasAccess(feature)) {
    const companyAlias = company?.companyAlias || 'test';
    return <Redirect to={`/${companyAlias}/tienda`} />;
  }
  
  return <>{children}</>;
}

function ManagerFeatureGate({ 
  children, 
  feature 
}: { 
  children: React.ReactNode; 
  feature: string;
}) {
  // Managers can always access pages - the access level (full vs read-only) 
  // is controlled within each page via useFeatureCheck hooks.
  // This allows managers with "Solo lectura" permission to view pages with limited access.
  return <>{children}</>;
}

function TrialExpiredLayout({ children }: { children: React.ReactNode }) {
  useScrollReset();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="min-h-screen">
        {children}
      </main>
    </div>
  );
}

function StoreRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showBanner } = useDemoBanner();
  
  const { data: trialStatus, isLoading: trialLoading } = useQuery<{ isBlocked: boolean }>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
    enabled: !!user && user.role !== 'accountant',
  });
  
  useScrollReset();

  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      clearAuthData();
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
      setLocation('/login');
    }
  }, [user, token, isLoading, setLocation]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (!user || !token) {
    return <PageLoading />;
  }
  
  // Accountants bypass trial/subscription entirely
  if (user.role === 'accountant') {
    return <>{children}</>;
  }

  const isTrialExpired = trialStatus?.isBlocked === true;
  
  if (isTrialExpired) {
    if (user.role === 'admin') {
      return (
        <TrialExpiredLayout>
          {children}
        </TrialExpiredLayout>
      );
    }
    return <SubscriptionExpiredScreen />;
  }
  
  const paddingTop = showBanner ? 'pt-header-banner-safe' : 'pt-header-safe';
  
  return (
    <SidebarProvider>
      <AppLayoutContent 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        paddingTop={paddingTop}
      >
        {children}
      </AppLayoutContent>
    </SidebarProvider>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, subscription } = useAuth();
  const { isEmployeeViewMode } = useEmployeeViewMode();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showBanner } = useDemoBanner();
  const isAccountant = user?.role === 'accountant';
  
  const { data: trialStatus } = useQuery<{ isBlocked: boolean }>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
    enabled: !!user && user.role === 'admin',
  });
  
  const isTrialExpired = trialStatus?.isBlocked === true;
  
  // Determine if we should use employee view (either employee role OR employee view mode)
  const useEmployeeLayout = user?.role === 'employee' || isEmployeeViewMode;
  
  // Reset scroll position on route changes (always called)
  useScrollReset();
  
  // Enable reminder notifications (toasts) for all authenticated users
  useReminderNotifications();

  // Apply employee-mode class when in employee layout
  useEffect(() => {
    const root = document.documentElement;
    
    if (useEmployeeLayout) {
      root.classList.add('employee-mode');
      
      const syncThemeColor = () => {
        const isDark = root.classList.contains('dark');
        updateThemeColor(isDark ? THEME_COLORS.employeeDark : THEME_COLORS.employeeLight);
      };
      
      syncThemeColor();
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            syncThemeColor();
          }
        });
      });
      
      observer.observe(root, { attributes: true, attributeFilter: ['class'] });
      
      return () => {
        observer.disconnect();
        root.classList.remove('employee-mode');
      };
    }
  }, [useEmployeeLayout]);

  // Calculate padding-top dynamically with safe area support for iOS PWA
  const paddingTop = showBanner ? 'pt-header-banner-safe' : 'pt-header-safe';

  // Employee gets simplified view without sidebar - direct render
  if (useEmployeeLayout) {
    return (
      <>
        {children}
      </>
    );
  }

  // Admin/Manager gets full layout with sidebar
  return (
    <SidebarProvider>
      <AppLayoutContent 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        paddingTop={paddingTop}
      >
        {children}
      </AppLayoutContent>
    </SidebarProvider>
  );
}

// Minimal layout for accountant: no reminder banner, no trial/subscription hooks
function AccountantLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showBanner } = useDemoBanner();
  useScrollReset();

  const paddingTop = showBanner ? 'pt-header-banner-safe' : 'pt-header-safe';

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
        <main 
          className={`lg:ml-64 min-h-screen ${paddingTop}`}
          style={{ backgroundColor: 'hsl(var(--background))' }}
        >
          <div className="px-6 pt-4 pb-8 min-h-screen overflow-y-auto" style={{ overflowX: 'clip' }}>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function AppLayoutContent({ 
  children, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  paddingTop 
}: { 
  children: React.ReactNode;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  paddingTop: string;
}) {
  const { setIsSidebarOpen: setSidebarContextOpen } = useSidebarState();

  // Sync local state with context
  React.useEffect(() => {
    setSidebarContextOpen(isSidebarOpen);
  }, [isSidebarOpen, setSidebarContextOpen]);

  // Sync theme-color for admin PWA mode
  React.useEffect(() => {
    const root = document.documentElement;
    
    // Remove employee-mode class if present (admin mode)
    root.classList.remove('employee-mode');
    
    // Sync theme-color with current theme for admin
    const syncAdminThemeColor = () => {
      const isDark = root.classList.contains('dark');
      updateThemeColor(isDark ? THEME_COLORS.adminDark : THEME_COLORS.adminLight);
    };
    
    // Initial sync
    syncAdminThemeColor();
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          syncAdminThemeColor();
        }
      });
    });
    
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ReminderBanner />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main 
        className={`lg:ml-64 min-h-screen ${paddingTop}`}
        style={{
          backgroundColor: 'hsl(var(--background))'
        }}
      >
        <AdminLayout>
          {children}
        </AdminLayout>
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, company, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Routes with dark background need dark loader
  const darkBackgroundRoutes = ['/request-code', '/verify-code', '/login', '/forgot-password', '/reset-password'];
  const isDarkRoute = darkBackgroundRoutes.some(route => location.startsWith(route));

  if (isLoading) {
    return isDarkRoute ? <AuthPageLoading /> : <PageLoading />;
  }

  // Don't redirect during registration welcome flow
  const isInWelcomeFlow = sessionStorage.getItem('registrationWelcomeFlow') === 'true';
  
  if (user && company && !isInWelcomeFlow) {
    return <Redirect to={`/${company.companyAlias}/inicio`} />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, company } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Listen for AI assistant navigation events (SPA navigation without full page reload)
  useEffect(() => {
    const handleAINavigation = (event: CustomEvent<{ url: string }>) => {
      if (event.detail?.url) {
        console.log('🧭 AI Navigation to:', event.detail.url);
        setLocation(event.detail.url);
      }
    };
    
    window.addEventListener('ai-assistant-navigate', handleAINavigation as EventListener);
    return () => {
      window.removeEventListener('ai-assistant-navigate', handleAINavigation as EventListener);
    };
  }, [setLocation]);
  
  // Super admin routes handled separately - PROTECTED: Only if no regular user session exists
  if (location.startsWith('/super-admin')) {
    // SEO PROTECTION: Prevent indexing of super admin pages
    React.useEffect(() => {
      // Add noindex meta tag
      let metaRobots = document.querySelector('meta[name="robots"]');
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow');

      // Cleanup: remove noindex when leaving super-admin routes
      return () => {
        const robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) {
          robotsMeta.remove();
        }
      };
    }, []);
    
    // CRITICAL FIX: If user is logged in as regular user, redirect them out of SuperAdmin area
    if (user && company) {
      console.log('🚨 SECURITY: Regular user attempting to access SuperAdmin - redirecting');
      window.location.href = `/${company.companyAlias}/inicio`;
      return <PageLoading />;
    }
    
    return (
      <Switch>
        <Route path="/super-admin/dashboard">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminDashboard />
          </Suspense>
        </Route>
        <Route path="/super-admin/metrics">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminMetrics />
          </Suspense>
        </Route>
        <Route path="/super-admin/plans">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminPlans />
          </Suspense>
        </Route>
        <Route path="/super-admin/pricing">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminPricing />
          </Suspense>
        </Route>
        <Route path="/super-admin/companies">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminCompanies />
          </Suspense>
        </Route>
        <Route path="/super-admin/companies/:id">
          {(params) => (
            <Suspense fallback={<SuperAdminPageLoading />}>
              <SuperAdminCompanyDetail companyId={params.id} />
            </Suspense>
          )}
        </Route>
        <Route path="/super-admin/invitations">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminInvitations />
          </Suspense>
        </Route>
        <Route path="/super-admin/promo-codes">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminPromoCodes />
          </Suspense>
        </Route>
        <Route path="/super-admin/marketing">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminMarketing />
          </Suspense>
        </Route>
        <Route path="/super-admin/landing-metrics">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminLandingMetrics />
          </Suspense>
        </Route>
        <Route path="/super-admin">
          <Suspense fallback={<SuperAdminPageLoading />}>
            <SuperAdminSecurity />
          </Suspense>
        </Route>
        <Route component={PublicNotFound} />
      </Switch>
    );
  }

  
  return (
    <Switch>
      {/* Legal pages */}
      <Route path="/politica-privacidad">
        <PublicPrivacy />
      </Route>

      <Route path="/terminos">
        <PublicTerms />
      </Route>

      <Route path="/aviso-legal">
        <PublicLegalNotice />
      </Route>

      <Route path="/cookies" component={PublicCookies} />

      {/* Public routes for authentication */}
      <Route path="/login">
        <PublicRoute>
          <PublicLogin />
        </PublicRoute>
      </Route>

      <Route path="/forgot-password">
        <PublicRoute>
          <PublicForgotPassword />
        </PublicRoute>
      </Route>

      <Route path="/reset-password">
        <PublicRoute>
          <PublicResetPassword />
        </PublicRoute>
      </Route>

      <Route path="/request-code">
        <PublicRoute>
          <Suspense fallback={<AuthPageLoading />}>
            <PublicRequestCode />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/verify-code">
        <PublicRoute>
          <Suspense fallback={<AuthPageLoading />}>
            <PublicVerifyCode />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <PublicRegister />
        </PublicRoute>
      </Route>

      <Route path="/registro/invitacion/:token">
        <PublicRoute>
          <Suspense fallback={<PageLoading />}>
            <PublicInvitationRegister />
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
          <PublicLogin />
        </PublicRoute>
      </Route>

      <Route path="/:companyAlias/forgot-password">
        <PublicRoute>
          <PublicForgotPassword />
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
          <ManagerFeatureGate feature="timeTracking">
            <AppLayout>
              {user && (user.role === 'admin' || user.role === 'manager') ? (
                <AdminTimeTracking />
              ) : (
                <Redirect to={`/${company?.companyAlias || 'test'}/misfichajes`} />
              )}
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/configuracion">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeSettings />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/tienda">
        <StoreRoute>
          <AdminEmployeeAddonStore />
        </StoreRoute>
      </Route>

      <Route path="/:companyAlias/usuario">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeProfile />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/dispositivos">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeNotificationDevices />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/ausencias">
        <ProtectedRoute>
          <ManagerFeatureGate feature="vacation">
            <AppLayout>
              <RoleBasedPage 
                adminComponent={AdminVacationManagement} 
                employeeComponent={EmployeeVacationRequests} 
              />
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/cuadrante">
        <ProtectedRoute>
          <ManagerFeatureGate feature="schedules">
            <AppLayout>
              <RoleBasedPage 
                adminComponent={AdminSchedules} 
                employeeComponent={EmployeeSchedule} 
              />
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/documentos">
        <ProtectedRoute>
          <ManagerFeatureGate feature="documents">
            <AppLayout>
              <AdminDocuments />
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/misdocumentos">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeDocuments />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/mensajes">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="messages">
            <ManagerFeatureGate feature="messages">
              <AppLayout>
                <AdminEmployeeMessages />
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/recordatorios">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="reminders">
            <ManagerFeatureGate feature="reminders">
              <AppLayout>
                <RoleBasedPage 
                  adminComponent={AdminReminders} 
                  employeeComponent={EmployeeReminders} 
                />
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/partes-trabajo">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="work_reports">
            <ManagerFeatureGate feature="work_reports">
              <AppLayout>
                <RoleBasedPage 
                  adminComponent={AdminWorkReports} 
                  employeeComponent={EmployeeWorkReports} 
                />
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/inventario">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="inventory">
            <AppLayout>
              {/* Inventory is admin/manager only - no employee view */}
              <AdminInventory />
            </AppLayout>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/clientes-proyectos">
        <ProtectedRoute>
          <AppLayout>
            <AdminCRM />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/contabilidad">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="accounting">
            <ManagerFeatureGate>
              <AppLayout>
                <RoleBasedPage 
                  adminComponent={AdminAccounting} 
                  employeeComponent={EmployeeExpenses} 
                />
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/gastos">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="accounting">
            <AppLayout>
              <EmployeeExpenses />
            </AppLayout>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      {/* Accountant Dashboard - Special routes for accountant role */}
      <Route path="/accountant">
        <ProtectedRoute>
          <AccountantLayout>
            <AccountantDashboard />
          </AccountantLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/accountant/contabilidad">
        <ProtectedRoute>
          <AccountantLayout>
            <AccountantAccounting />
          </AccountantLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/accountant/documentos">
        <ProtectedRoute>
          <AccountantLayout>
            <AccountantDocuments />
          </AccountantLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/empleados">
        <ProtectedRoute>
          <AppLayout>
            <AdminEmployees />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/access-denied">
        <PublicAccessDenied />
      </Route>

      {/* Login/Register routes for non-authenticated users */}
      <Route path="/login">
        <PublicRoute>
          <PublicLogin />
        </PublicRoute>
      </Route>

      <Route path="/forgot-password">
        <PublicRoute>
          <PublicForgotPassword />
        </PublicRoute>
      </Route>

      <Route path="/reset-password">
        <PublicRoute>
          <PublicResetPassword />
        </PublicRoute>
      </Route>

      {/* Landing page - main entry point (must be last to avoid conflicts) */}
      <Route path="/">
        <PublicRoute>
          <PublicLanding />
        </PublicRoute>
      </Route>

      {/* 404 fallback */}
      <Route component={PublicNotFound} />
    </Switch>
  );
}

/**
 * RouterView: All page routing logic.
 * This component is a sibling to GlobalOverlays, so routing changes won't affect global UI.
 */
export function RouterView() {
  const { user, token, isLoading } = useAuth();

  // While auth loads, show the auth loading screen
  if (isLoading) {
    return <AuthPageLoading />;
  }

  // If not authenticated, fall back to main router (will handle public/login)
  if (!user || !token) {
    return <Router />;
  }

  // Accountant-only shell: completely isolated from subscription/feature logic
  if (user.role === 'accountant') {
    return (
      <SidebarScrollProvider>
        <AccountantLayout>
          <Switch>
            <Route path="/accountant/contabilidad">
              <AccountantAccounting />
            </Route>
            <Route path="/accountant/documentos">
              <AccountantDocuments />
            </Route>
            <Route path="/accountant">
              <AccountantDashboard />
            </Route>
            <Route>
              <Redirect to="/accountant" />
            </Route>
          </Switch>
        </AccountantLayout>
      </SidebarScrollProvider>
    );
  }

  // Default router for other roles
  return <Router />;
}
