import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface EmployeeViewModeContextType {
  isEmployeeViewMode: boolean;
  enableEmployeeView: () => void;
  disableEmployeeView: () => void;
  toggleEmployeeView: () => void;
}

const EmployeeViewModeContext = createContext<EmployeeViewModeContextType | undefined>(undefined);

export function EmployeeViewModeProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [isEmployeeViewMode, setIsEmployeeViewMode] = useState(() => {
    const stored = localStorage.getItem('employeeViewMode');
    return stored === 'true';
  });
  const [previousAdminPath, setPreviousAdminPath] = useState<string | null>(() => {
    return localStorage.getItem('previousAdminPath');
  });
  const [location, setLocation] = useLocation();
  const { company } = useAuth();
  
  const companyAlias = company?.companyAlias || 'test';

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('employeeViewMode', isEmployeeViewMode.toString());
  }, [isEmployeeViewMode]);

  useEffect(() => {
    if (previousAdminPath) {
      localStorage.setItem('previousAdminPath', previousAdminPath);
    } else {
      localStorage.removeItem('previousAdminPath');
    }
  }, [previousAdminPath]);

  const enableEmployeeView = useCallback(() => {
    // Save current path before switching to employee mode
    setPreviousAdminPath(location);
    setIsEmployeeViewMode(true);
    // Navigate to employee dashboard
    setLocation(`/${companyAlias}/inicio`);
  }, [location, companyAlias, setLocation]);

  const disableEmployeeView = useCallback(() => {
    setIsEmployeeViewMode(false);
    // Return to previous admin path or default to admin dashboard
    const returnPath = previousAdminPath || `/${companyAlias}/inicio`;
    setLocation(returnPath);
    setPreviousAdminPath(null);
  }, [previousAdminPath, companyAlias, setLocation]);

  const toggleEmployeeView = useCallback(() => {
    if (isEmployeeViewMode) {
      disableEmployeeView();
    } else {
      enableEmployeeView();
    }
  }, [isEmployeeViewMode, enableEmployeeView, disableEmployeeView]);

  return (
    <EmployeeViewModeContext.Provider value={{
      isEmployeeViewMode,
      enableEmployeeView,
      disableEmployeeView,
      toggleEmployeeView
    }}>
      {children}
    </EmployeeViewModeContext.Provider>
  );
}

// Default values when used outside provider
const defaultValue: EmployeeViewModeContextType = {
  isEmployeeViewMode: false,
  enableEmployeeView: () => {},
  disableEmployeeView: () => {},
  toggleEmployeeView: () => {}
};

export function useEmployeeViewMode() {
  const context = useContext(EmployeeViewModeContext);
  // Return default value when used outside provider (safe fallback)
  return context ?? defaultValue;
}
