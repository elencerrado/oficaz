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
    '/super-admin'
  ];
  
  return adminRoutes.some(route => path.startsWith(route));
};

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system', 
  storageKey = 'oficaz-theme' 
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey) as Theme;
    return storedTheme || defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Always remove existing theme classes first
    root.classList.remove('light', 'dark');

    // Only apply dark mode for admin routes, force light mode for public pages
    if (!isAdminRoute()) {
      root.classList.add('light');
      return;
    }

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
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
    };

    // Listen to popstate for back/forward navigation
    window.addEventListener('popstate', handleLocationChange);
    
    // Listen to pushstate/replacestate for programmatic navigation
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(handleLocationChange, 0);
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(handleLocationChange, 0);
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
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