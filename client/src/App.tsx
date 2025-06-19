import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { useState } from "react";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import TimeTracking from "@/pages/time-tracking";
import VacationRequests from "@/pages/vacation-requests";
import Documents from "@/pages/documents";
import Messages from "@/pages/messages";
import Employees from "@/pages/employees";
import Settings from "@/pages/settings";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-oficaz-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-oficaz-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main className="lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-oficaz-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  
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

      {/* Company-specific protected routes */}
      <Route path="/:companyAlias/dashboard">
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/time-tracking">
        <ProtectedRoute>
          <AppLayout>
            <TimeTracking />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/vacation-requests">
        <ProtectedRoute>
          <AppLayout>
            <VacationRequests />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/documents">
        <ProtectedRoute>
          <AppLayout>
            <Documents />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/messages">
        <ProtectedRoute>
          <AppLayout>
            <Messages />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/employees">
        <ProtectedRoute>
          <AppLayout>
            <Employees />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/:companyAlias/settings">
        <ProtectedRoute>
          <AppLayout>
            <Settings />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Legacy routes - redirect to company-specific routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
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
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
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
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
