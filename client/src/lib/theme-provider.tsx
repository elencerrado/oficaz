import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

// Theme colors for PWA status bar - exported for use in other components
export const THEME_COLORS = {
  employeeLight: '#f9fafb',  // gray-50
  employeeDark: '#232B36',   // employee dark mode
  adminLight: '#FFFFFF',     // white
  adminDark: '#020817',      // hsl(222.2 84% 4.9%)
};

// Update meta theme-color for PWA status bar - exported for use in other components
export const updateThemeColor = (color: string) => {
  // Remove any existing theme-color meta tags without media queries
  const existingMetas = document.querySelectorAll('meta[name="theme-color"]:not([media])');
  existingMetas.forEach(meta => meta.remove());
  
  // Create or update the main theme-color (without media query, overrides the ones with media)
  let metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement;
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.name = 'theme-color';
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.content = color;
  
  // Also update the media query ones for consistency
  const lightMeta = document.querySelector('meta[name="theme-color"][media*="light"]') as HTMLMetaElement;
  const darkMeta = document.querySelector('meta[name="theme-color"][media*="dark"]') as HTMLMetaElement;
  
  // For employee pages, sync both to current theme
  const isEmployeePage = window.location.pathname.includes('employee-dashboard') || 
                         window.location.pathname.includes('/inicio') ||
                         document.documentElement.classList.contains('employee-mode');
  
  if (isEmployeePage) {
    if (lightMeta) lightMeta.content = color;
    if (darkMeta) darkMeta.content = color;
  }
};

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
    '/work-reports',
    '/schedules',
    // Direct employee routes (Spanish)
    '/inicio',
    '/fichajes',
    '/misfichajes',
    '/horas',
    '/vacaciones',
    '/documentos',
    '/mensajes',
    '/cuadrante',
    '/partes-trabajo',
    '/usuario',
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
    '/oficaz/configuracion',
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
    '/oficaz/mensajes',
    '/oficaz/cuadrante',
    '/oficaz/partes-trabajo',
    '/oficaz/usuario'
  ];
  
  // Also check for company alias patterns like /companyName/recordatorios, /companyName/empleados
  // Support both Spanish and English route names
  const hasCompanyAliasAdminRoute = /^\/[^\/]+\/(recordatorios|empleados|inicio|fichajes|misfichajes|horas|vacaciones|documentos|documents|mensajes|messages|cuadrante|configuracion|usuario|settings|profile|reminders|employees|time-tracking|vacation-requests|vacation-management|admin-documents|employee-dashboard|admin-dashboard|partes-trabajo|work-reports|dispositivos|control-tiempo|schedules)/.test(path);
  
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
      const isEmployee = root.classList.contains('employee-mode');

      // Always remove existing theme classes first
      root.classList.remove('light', 'dark');

      // Only apply dark mode for admin routes, force light mode for public pages
      // BUT respect employee-mode for notch color
      if (!isAdminRoute()) {
        root.classList.add('light');
        // Only force light color scheme if NOT in employee mode
        if (!isEmployee) {
          root.style.colorScheme = 'light';
          updateThemeColor(THEME_COLORS.adminLight);
        }
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
      
      // Update PWA status bar color based on theme and page type
      if (isEmployee) {
        updateThemeColor(appliedTheme === 'dark' ? THEME_COLORS.employeeDark : THEME_COLORS.employeeLight);
      } else {
        updateThemeColor(appliedTheme === 'dark' ? THEME_COLORS.adminDark : THEME_COLORS.adminLight);
      }
      
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
    let lastAppliedPath = '';
    
    const handleLocationChange = () => {
      const currentPath = window.location.pathname;
      
      // Skip if we already applied theme for this path
      if (currentPath === lastAppliedPath) return;
      lastAppliedPath = currentPath;
      
      const root = window.document.documentElement;
      const isAdmin = isAdminRoute();
      
      // CRITICAL: Read theme from localStorage to get the CURRENT value
      // This fixes the issue where theme changes weren't persisting across navigation
      const currentTheme = (localStorage.getItem(storageKey) as Theme) || theme;
      
      // Determine target theme
      let targetTheme: string;
      if (!isAdmin) {
        targetTheme = 'light';
      } else if (currentTheme === 'system') {
        targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        targetTheme = currentTheme;
      }
      
      const isEmployee = root.classList.contains('employee-mode');
      
      // Only update if theme actually changed
      if (!root.classList.contains(targetTheme)) {
        root.classList.remove('light', 'dark');
        root.classList.add(targetTheme);
        
        // Only force light color scheme for non-admin non-employee-mode
        if (!isAdmin && !isEmployee) {
          root.style.colorScheme = 'light';
        } else {
          root.style.colorScheme = targetTheme;
        }
      }
      
      // Always update theme-color for PWA status bar on route change
      if (isEmployee) {
        updateThemeColor(targetTheme === 'dark' ? THEME_COLORS.employeeDark : THEME_COLORS.employeeLight);
      } else {
        updateThemeColor(targetTheme === 'dark' ? THEME_COLORS.adminDark : THEME_COLORS.adminLight);
      }
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
  }, [theme, storageKey]);

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