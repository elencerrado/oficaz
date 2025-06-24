import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ReminderBanner } from "@/components/ui/reminder-banner";
import { PageLoading } from "@/components/ui/page-loading";
import { PageWrapper } from "@/components/ui/page-wrapper";
import { useState } from "react";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminDashboard from "@/pages/admin-dashboard";
import EmployeeDashboard from "@/pages/employee-dashboard";
import TimeTracking from "@/pages/time-tracking";
import EmployeeTimeTracking from "@/pages/employee-time-tracking";
import VacationRequests from "@/pages/vacation-requests";
import VacationManagement from "@/pages/vacation-management";
import Documents from "@/pages/documents";
import AdminDocuments from "@/pages/admin-documents";
import Messages from "@/pages/messages";
import Reminders from "@/pages/reminders";
import EmployeesSimple from "@/pages/employees-simple";
import Settings from "@/pages/settings";
import EmployeeProfile from "@/pages/employee-profile";
import AccessDenied from "@/pages/access-denied";
import SuperAdminLogin from "@/pages/super-admin-login";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import SuperAdminPlans from "@/pages/super-admin-plans";
import SuperAdminCompanyDetail from "@/pages/super-admin-company-detail";
import SuperAdminCompanies from "@/pages/super-admin-companies";
import QuickAccess from "@/pages/quick-access";


function DashboardRouter() {
  const { user } = useAuth();
  
  if (user?.role === 'employee') {
    return <EmployeeDashboard />;
  }
  
  // Admin/Manager - just return AdminDashboard component without layout
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

  // Employee gets simplified view without sidebar - direct render
  if (user?.role === 'employee') {
    return (
      <>
        <ReminderBanner />
        {children}
      </>
    );
  }

  // Admin/Manager gets full layout with sidebar
  return (
    <div className="min-h-screen bg-gray-50">
      <ReminderBanner />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main className="lg:ml-64 min-h-screen pt-16 bg-gray-50">
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
  
  // Super admin routes handled separately - no company context needed
  if (location.startsWith('/super-admin')) {
    return (
      <Switch>
        <Route path="/super-admin/login" component={SuperAdminLogin} />
        <Route path="/super-admin/dashboard" component={SuperAdminDashboard} />
        <Route path="/super-admin/plans" component={SuperAdminPlans} />
        <Route path="/super-admin/companies" component={SuperAdminCompanies} />
        <Route path="/super-admin/companies/:id">
          {(params) => <SuperAdminCompanyDetail companyId={params.id} />}
        </Route>
        <Route path="/super-admin" component={SuperAdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Quick access page for testing
  if (location === '/fast') {
    return <QuickAccess />;
  }
  
  return (
    <Switch>
      {/* Public routes for authentication */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>

      {/* Company-specific routes */}
      <Route path="/:companyAlias/login">
        <PublicRoute>
          <Login />
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

      <Route path="/:companyAlias/horas">
        <ProtectedRoute>
          <AppLayout>
            <EmployeeTimeTracking />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/fichajes">
        <ProtectedRoute>
          <AppLayout>
            <TimeTracking />
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
            {user?.role === 'employee' ? <Documents /> : <AdminDocuments />}
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
            <Reminders />
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

      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>

      {/* Root redirect - show login for non-authenticated users */}
      <Route path="/">
        {user && company ? <Redirect to={`/${company.companyAlias}/inicio`} /> : <Redirect to="/login" />}
      </Route>

      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ReminderBanner />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
