import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

// Check if current route is an admin/dashboard route that should support dark mode
const isAdminRoute = () => {
  const path = window.location.pathname;
  
  const adminRoutes = [
    '/admin-dashboard',
    '/employee-dashboard', 
    '/time-tracking',
    '/employee-time-tracking',
    '/vacation-requests',
    '/vacation-management',
    '/documents',
    '/admin-documents',
    '/messages',
    '/reminders',
    '/employee-reminders',
    '/employees-simple',
    '/settings',
    '/employee-profile',
    '/super-admin',
    // Direct admin routes for company alias paths
    '/recordatorios',
    '/empleados',
    '/configuracion',
    // Replit custom domain URLs
    '/oficaz/admin-dashboard',
    '/oficaz/employee-dashboard', 
    '/oficaz/time-tracking',
    '/oficaz/employee-time-tracking',
    '/oficaz/vacation-requests',
    '/oficaz/vacation-management',
    '/oficaz/documents',
    '/oficaz/admin-documents',
    '/oficaz/messages',
    '/oficaz/reminders',
    '/oficaz/employee-reminders',
    '/oficaz/employees-simple',
    '/oficaz/configuracion', // Spanish version of settings
    '/oficaz/settings',
    '/oficaz/employee-profile',
    '/oficaz/super-admin',
    '/oficaz/recordatorios',
    '/oficaz/empleados',
    // Employee routes patterns
    '/oficaz/inicio',
    '/oficaz/fichajes',
    '/oficaz/horas',
    '/oficaz/vacaciones',
    '/oficaz/documentos',
    '/oficaz/mensajes'
  ];
  
  // Also check for company alias patterns like /companyName/recordatorios, /companyName/empleados
  const hasCompanyAliasAdminRoute = /^\/[^\/]+\/(recordatorios|empleados|inicio|fichajes|horas|vacaciones|documentos|mensajes|configuracion)/.test(path);
  
  return adminRoutes.some(route => path.startsWith(route)) || hasCompanyAliasAdminRoute;
};

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system', 
  storageKey = 'oficaz-theme' 
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get base theme from global storage for initial load
    const storedTheme = localStorage.getItem(storageKey) as Theme;
    return storedTheme || defaultTheme;
  });

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;

      // Always remove existing theme classes first
      root.classList.remove('light', 'dark');

      // Only apply dark mode for admin routes, force light mode for public pages
      if (!isAdminRoute()) {
        root.classList.add('light');
        // Force light mode styling on root
        root.style.colorScheme = 'light';
        return;
      }

      let appliedTheme = theme;
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' 
          : 'light';
        appliedTheme = systemTheme;
      }
      
      root.classList.add(appliedTheme);
      // Set color scheme for better browser integration
      root.style.colorScheme = appliedTheme;
      
      // Force a reflow to ensure changes are applied immediately
      void root.offsetHeight;
    };

    applyTheme();
    
    // Add a small delay to ensure theme is applied on slower devices
    const timeoutId = setTimeout(applyTheme, 50);
    
    return () => clearTimeout(timeoutId);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system' && isAdminRoute()) {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Listen to route changes to re-evaluate theme application
  useEffect(() => {
    const handleLocationChange = () => {
      // Small delay to ensure DOM has updated with new route
      setTimeout(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (!isAdminRoute()) {
          root.classList.add('light');
        } else {
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
              ? 'dark' 
              : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }
        }
      }, 10); // Small delay for route to update
    };

    // Enhanced route change detection for mobile compatibility
    
    // Listen to popstate for back/forward navigation
    window.addEventListener('popstate', handleLocationChange);
    
    // Listen to hashchange for hash navigation
    window.addEventListener('hashchange', handleLocationChange);
    
    // Custom event for route changes (in case wouter fires custom events)
    window.addEventListener('routechange', handleLocationChange);
    
    // Mutation observer to detect URL changes that might not trigger events
    const observer = new MutationObserver(() => {
      handleLocationChange();
    });
    
    // Watch for changes in the document title or other indicators of route change
    observer.observe(document.head, { childList: true, subtree: true });
    
    // Listen to pushstate/replacestate for programmatic navigation
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    // Periodic check for route changes (fallback for mobile browsers)
    const intervalId = setInterval(() => {
      if (window.location.pathname !== (window as any).lastPathname) {
        (window as any).lastPathname = window.location.pathname;
        handleLocationChange();
      }
    }, 500);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('routechange', handleLocationChange);
      observer.disconnect();
      clearInterval(intervalId);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [theme]);

  // Initialize pathname tracking
  useEffect(() => {
    (window as any).lastPathname = window.location.pathname;
  }, []);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};