import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureCheck } from "@/hooks/use-feature-check";
import { PageLoading } from "@/components/ui/page-loading";
import { AuthPageLoading } from "@/components/ui/auth-page-loading";
import { useState } from "react";
import * as React from "react";
import { useDemoBanner } from "@/hooks/use-demo-banner";
import { useScrollReset } from "@/hooks/use-scroll-reset";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { SidebarProvider, useSidebarState } from "@/hooks/use-sidebar-state";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ReminderBanner } from "@/components/ui/reminder-banner";
import { TestBanner } from "@/components/test-banner";
import { updateThemeColor, THEME_COLORS } from "@/lib/theme-provider";
import type { FeatureKey } from "@/lib/feature-restrictions";
import { useQuery } from "@tanstack/react-query";

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
};

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
import Schedules from "@/pages/schedules";
import Documents from "@/pages/documents";
import AdminDocuments from "@/pages/admin-documents";
import Messages from "@/pages/messages";
import Reminders from "@/pages/reminders";
import EmployeeReminders from "@/pages/employee-reminders";
import EmployeesSimple from "@/pages/employees-simple";
import Settings from "@/pages/settings";
import EmployeeProfile from "@/pages/employee-profile";
import EmployeeSchedule from "@/pages/employee-schedule";
import NotificationDevices from "@/pages/notification-devices";
import WorkReports from "@/pages/work-reports";
import AdminWorkReports from "@/pages/admin-work-reports";
import AddonStore from "@/pages/addon-store";

// Super admin pages - lazy loaded (rarely accessed)
const SuperAdminSecurity = lazy(() => import("@/pages/super-admin-security"));
const SuperAdminDashboard = lazy(() => import("@/pages/super-admin-dashboard"));
const SuperAdminMetrics = lazy(() => import("@/pages/super-admin-metrics"));
const SuperAdminPlans = lazy(() => import("@/pages/super-admin-plans"));
const SuperAdminCompanyDetail = lazy(() => import("@/pages/super-admin-company-detail"));
const SuperAdminCompanies = lazy(() => import("@/pages/super-admin-companies"));
const SuperAdminInvitations = lazy(() => import("@/pages/super-admin-invitations"));
const SuperAdminPromoCodes = lazy(() => import("@/pages/super-admin-promo-codes"));
const SuperAdminMarketing = lazy(() => import("@/pages/super-admin-marketing"));
const SuperAdminLandingMetrics = lazy(() => import("@/pages/super-admin-landing-metrics"));

// SuperAdmin specific loading component
import { SuperAdminPageLoading } from "@/components/layout/super-admin-page-loading";

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
  const { user, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();

  // SECURITY FIX: Clean up auth data when no valid session exists
  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      // Clear only auth data, not entire localStorage
      localStorage.removeItem('authData');
      
      // Prevent browser history navigation to admin pages
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
    return <PageLoading />; // Show loading while cleanup happens
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
  const { company, isLoading } = useAuth();
  const { hasAccess } = useFeatureCheck();
  
  if (isLoading) {
    return <PageLoading />;
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
  const { user, company, isLoading } = useAuth();
  
  const { data: managerPermissionsData, isLoading: permissionsLoading } = useQuery<{ 
    managerPermissions: { visibleFeatures?: string[] | null } 
  }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'manager',
  });

  if (isLoading || (user?.role === 'manager' && permissionsLoading)) {
    return <PageLoading />;
  }

  if (user?.role !== 'manager') {
    return <>{children}</>;
  }

  const addonKey = featureToAddonKey[feature] || feature;
  const visibleFeatures = managerPermissionsData?.managerPermissions?.visibleFeatures;

  if (visibleFeatures === undefined || visibleFeatures === null) {
    return <>{children}</>;
  }

  if (visibleFeatures.length === 0) {
    const companyAlias = company?.companyAlias || 'test';
    return <Redirect to={`/${companyAlias}/inicio`} />;
  }

  if (!visibleFeatures.includes(addonKey)) {
    const companyAlias = company?.companyAlias || 'test';
    return <Redirect to={`/${companyAlias}/inicio`} />;
  }
  
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showBanner } = useDemoBanner();
  
  // Reset scroll position on route changes
  useScrollReset();
  
  // Enable reminder notifications (toasts) for all authenticated users
  useReminderNotifications();

  // Calculate padding-top dynamically with safe area support for iOS PWA
  // Header is positioned at top-[60px] when banner is shown, plus header height (60px) = 120px total
  const paddingTop = showBanner ? 'pt-header-banner-safe' : 'pt-header-safe';

  // Employee gets simplified view without sidebar - direct render
  if (user?.role === 'employee') {
    // Reset scroll for employees too
    useScrollReset();
    
    // Apply employee-mode class to html for notch color and sync PWA theme-color
    useEffect(() => {
      const root = document.documentElement;
      root.classList.add('employee-mode');
      
      // Sync theme-color with current theme
      const syncThemeColor = () => {
        const isDark = root.classList.contains('dark');
        updateThemeColor(isDark ? THEME_COLORS.employeeDark : THEME_COLORS.employeeLight);
      };
      
      // Initial sync
      syncThemeColor();
      
      // Listen for theme changes
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
    }, []);
    
    return (
      <>
        <ReminderBanner />
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
          <Suspense fallback={<AuthPageLoading />}>
            <RequestCode />
          </Suspense>
        </PublicRoute>
      </Route>

      <Route path="/verify-code">
        <PublicRoute>
          <Suspense fallback={<AuthPageLoading />}>
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
          <ManagerFeatureGate feature="timeTracking">
            <AppLayout>
              {user && (user.role === 'admin' || user.role === 'manager') ? (
                <TimeTracking />
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
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/tienda">
        <ProtectedRoute>
          <AppLayout>
            <AddonStore />
          </AppLayout>
        </ProtectedRoute>
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
            <NotificationDevices />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/vacaciones">
        <ProtectedRoute>
          <ManagerFeatureGate feature="vacation">
            <AppLayout>
              {user && (user.role === 'admin' || user.role === 'manager') ? (
                <VacationManagement />
              ) : (
                <VacationRequests />
              )}
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/cuadrante">
        <ProtectedRoute>
          <ManagerFeatureGate feature="schedules">
            <AppLayout>
              {user && (user.role === 'admin' || user.role === 'manager') ? (
                <Schedules />
              ) : (
                <EmployeeSchedule />
              )}
            </AppLayout>
          </ManagerFeatureGate>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/documentos">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="documents">
            <ManagerFeatureGate feature="documents">
              <AppLayout>
                {user?.role === 'employee' ? (
                  <Documents />
                ) : (
                  <AdminDocuments />
                )}
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/mensajes">
        <ProtectedRoute>
          <FeatureProtectedRoute feature="messages">
            <ManagerFeatureGate feature="messages">
              <AppLayout>
                <Messages />
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
                {user?.role === 'employee' ? (
                  <EmployeeReminders />
                ) : (
                  <Reminders />
                )}
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
                {user?.role === 'employee' ? (
                  <WorkReports />
                ) : (
                  <AdminWorkReports />
                )}
              </AppLayout>
            </ManagerFeatureGate>
          </FeatureProtectedRoute>
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

/**
 * RouterView: All page routing logic.
 * This component is a sibling to GlobalOverlays, so routing changes won't affect global UI.
 */
export function RouterView() {
  return <Router />;
}
