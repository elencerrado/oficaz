import { createContext, useContext, useState, ReactNode } from 'react';

interface EmployeeViewModeContextType {
  isEmployeeViewMode: boolean;
  enableEmployeeView: () => void;
  disableEmployeeView: () => void;
  toggleEmployeeView: () => void;
}

const EmployeeViewModeContext = createContext<EmployeeViewModeContextType | undefined>(undefined);

export function EmployeeViewModeProvider({ children }: { children: ReactNode }) {
  const [isEmployeeViewMode, setIsEmployeeViewMode] = useState(false);

  const enableEmployeeView = () => setIsEmployeeViewMode(true);
  const disableEmployeeView = () => setIsEmployeeViewMode(false);
  const toggleEmployeeView = () => setIsEmployeeViewMode(prev => !prev);

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

export function useEmployeeViewMode() {
  const context = useContext(EmployeeViewModeContext);
  if (context === undefined) {
    throw new Error('useEmployeeViewMode must be used within an EmployeeViewModeProvider');
  }
  return context;
}
