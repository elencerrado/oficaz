import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Company } from '@shared/schema';
import { getAuthData, setAuthData, clearAuthData, clearExpiredTokens } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  login: (dniOrEmail: string, password: string, companyAlias?: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  subscription: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token from localStorage immediately
    const authData = getAuthData();
    return authData?.token || null;
  });
  const [authData, setAuthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Clear any expired tokens first
      clearExpiredTokens();
      
      const authData = getAuthData();
      console.log('Auth init with data:', authData ? 'found' : 'none');
      
      if (authData && authData.token) {
        try {
          // Verify token by fetching user data
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${authData.token}` },
          });
          
          console.log('Auth verification response:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Auth data verified:', { user: data.user?.fullName, company: data.company?.name, logoUrl: data.company?.logoUrl, subscription: data.subscription });
            
            // CRITICAL FIX: Check for corrupted user data (undefined role, invalid ID)
            if (!data.user || !data.user.id || data.user.id === 4 || !data.user.role) {
              console.log('🚨 CORRUPTED USER DATA DETECTED - FORCING LOGOUT');
              // Force complete cleanup
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/login';
              return;
            }
            
            // CRITICAL SECURITY FIX: Detect company changes and clear cache to prevent data leakage
            const previousCompanyId = company?.id;
            const newCompanyId = data.company?.id;
            
            if (previousCompanyId && newCompanyId && previousCompanyId !== newCompanyId) {
              console.log('🔄 COMPANY CHANGE DETECTED - CLEARING CACHE TO PREVENT DATA LEAKAGE', { 
                from: previousCompanyId, 
                to: newCompanyId 
              });
              // Clear ALL cached data when switching companies
              queryClient.clear();
            }
            
            setUser(data.user);
            setCompany(data.company);
            setToken(authData.token);
            setAuthData({ ...data, token: authData.token });
          } else {
            console.log('Auth verification failed, clearing data');
            clearAuthData();
            // CRITICAL: Also clear localStorage and sessionStorage on failed auth
            localStorage.clear();
            sessionStorage.clear();
            setUser(null);
            setCompany(null);
            setToken(null);
            setAuthData(null);
          }
        } catch (error) {
          console.log('Auth init error:', error);
          // Clear corrupted auth data completely
          clearAuthData();
          localStorage.clear();
          sessionStorage.clear();
          setUser(null);
          setCompany(null);
          setToken(null);
          setAuthData(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (dniOrEmail: string, password: string, companyAlias?: string) => {
    const loginData = companyAlias 
      ? { dniOrEmail, password, companyAlias }
      : { dniOrEmail, password };
      
    console.log('🔐 Login attempt starting...');
    
    // Make login request without using apiRequest to avoid token dependency
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error de login');
    }

    const data = await response.json();
    console.log('🔐 Login response received:', { hasToken: !!data.token, hasUser: !!data.user, tokenPreview: data.token?.substring(0, 20) + '...' });
    
    // CRITICAL SECURITY FIX: Clear cache when logging into different company
    const previousCompanyId = company?.id;
    const newCompanyId = data.company?.id;
    
    if (previousCompanyId && newCompanyId && previousCompanyId !== newCompanyId) {
      console.log('🔄 LOGIN COMPANY CHANGE - CLEARING CACHE TO PREVENT DATA LEAKAGE', { 
        from: previousCompanyId, 
        to: newCompanyId 
      });
      queryClient.clear();
    }
    
    // Save auth data to localStorage using proper function
    const authDataToSave = { user: data.user, token: data.token, company: data.company, subscription: data.subscription };
    setAuthData(authDataToSave);
    console.log('🔐 Auth data saved to localStorage');
    
    // Update state immediately
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    setAuthData(authDataToSave);
    console.log('🔐 Auth state updated, token length:', data.token?.length);
    
    // Verify localStorage was updated
    const verification = localStorage.getItem('authData');
    if (verification) {
      const parsed = JSON.parse(verification);
      console.log('✅ localStorage verification successful:', { hasToken: !!parsed.token, companyName: parsed.company?.name });
    } else {
      console.error('❌ localStorage verification failed - no data found');
    }
    
    // Wait a bit for state to propagate, then refresh queries
    setTimeout(() => {
      queryClient.clear();
      queryClient.invalidateQueries();
      console.log('🔄 Queries invalidated after auth update');
    }, 100);
    
    return data;
  };

  const register = async (formData: any) => {
    console.log('🔐 Register attempt starting...');
    const data = await apiRequest('POST', '/api/auth/register', formData);
    console.log('🔐 Register response received:', { hasToken: !!data.token, hasUser: !!data.user });
    
    // Save initial auth data to localStorage
    localStorage.setItem('authData', JSON.stringify(data));
    setAuthData(data);
    console.log('🔐 Auth data saved to localStorage');
    
    // Update state
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    console.log('🔐 Auth state updated after registration, token length:', data.token?.length);
    
    // Immediately refresh user data to get complete subscription info
    try {
      console.log('🔄 Refreshing user data to get complete subscription info...');
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      
      if (response.ok) {
        const completeData = await response.json();
        console.log('✅ Complete user data refreshed:', { hasSubscription: !!completeData.subscription });
        
        // Update state with complete data including subscription
        setUser(completeData.user);
        setCompany(completeData.company);
        
        // Update authData with complete subscription info
        const completeAuthData = { 
          ...data, 
          user: completeData.user, 
          company: completeData.company,
          subscription: completeData.subscription 
        };
        setAuthData(completeAuthData);
        localStorage.setItem('authData', JSON.stringify(completeAuthData));
        console.log('✅ Complete auth data saved with subscription info');
      }
    } catch (error) {
      console.error('⚠️ Error refreshing user data after registration:', error);
      // Registration still succeeded, just subscription data might be missing
    }
    
    return data;
  };

  const logout = () => {
    // Clear all cached data on logout to prevent data leakage
    console.log('🚪 LOGOUT - CLEARING ALL CACHE AND AUTH DATA');
    queryClient.clear();
    
    setUser(null);
    setCompany(null);
    setToken(null);
    setAuthData(null);
    clearAuthData();
    
    // SECURITY FIX: Clear ALL storage and invalidate history to prevent back navigation
    localStorage.clear();
    sessionStorage.clear();
    
    // Reset dark mode to prevent UI issues on login
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
    
    // Clear browser history to prevent back navigation to admin pages
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', '/login');
    }
    
    // Force redirect to login and prevent caching
    window.location.replace('/login');
  };

  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setCompany(data.company);
        // Include subscription data in authData
        setAuthData({ ...data, token });
        
        // También actualizar localStorage con datos completos de suscripción
        const currentAuthData = getAuthData();
        if (currentAuthData) {
          const updatedAuthData = { 
            ...currentAuthData, 
            user: data.user, 
            company: data.company,
            subscription: data.subscription 
          };
          localStorage.setItem('authData', JSON.stringify(updatedAuthData));
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  console.log('AuthProvider rendering with:', {
    user: user?.fullName,
    company: company?.name,
    subscription: authData?.subscription,
    isLoading
  });

  return (
    <AuthContext.Provider value={{
      user,
      company,
      subscription: authData?.subscription || null,
      token,
      login,
      register,
      logout,
      refreshUser,
      isLoading,
      isAuthenticated: !!(user && company && token),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
