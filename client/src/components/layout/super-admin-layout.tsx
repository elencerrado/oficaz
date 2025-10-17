import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { SuperAdminSidebar } from './super-admin-sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isTokenExpired } from '@/lib/auth';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = sessionStorage.getItem('superAdminToken');
    
    // If no token exists, redirect to login
    if (!token) {
      console.log('🚨 No SuperAdmin token found, redirecting to login');
      setLocation('/super-admin');
      return;
    }
    
    // If token exists but is expired, clear it and redirect
    if (isTokenExpired(token)) {
      console.log('🚨 SuperAdmin token expired, redirecting to login');
      sessionStorage.removeItem('superAdminToken');
      setLocation('/super-admin');
      return;
    }
    
    // Token is valid, check expiration periodically
    const intervalId = setInterval(() => {
      const currentToken = sessionStorage.getItem('superAdminToken');
      if (!currentToken || isTokenExpired(currentToken)) {
        console.log('🚨 SuperAdmin token expired (periodic check), redirecting to login');
        sessionStorage.removeItem('superAdminToken');
        setLocation('/super-admin');
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(intervalId);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <SuperAdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-gradient-to-r from-gray-900 to-blue-900 border-b border-white/10 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSidebarOpen(true)}
          className="text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
