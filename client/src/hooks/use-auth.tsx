import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Company } from '@shared/schema';
import { getAuthData, setAuthData, clearAuthData } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  login: (dniOrEmail: string, password: string, companyAlias?: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const authData = getAuthData();
      console.log('Auth init with data:', authData ? 'found' : 'none');
      
      if (authData) {
        try {
          // Verify token by fetching user data
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${authData.token}` },
          });
          
          console.log('Auth verification response:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Auth data verified:', { user: data.user?.fullName, company: data.company?.name });
            setUser(data.user);
            setCompany(data.company);
            setToken(authData.token);
          } else {
            console.log('Auth verification failed, clearing data');
            clearAuthData();
          }
        } catch (error) {
          console.log('Auth init error:', error);
          clearAuthData();
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
      
    const data = await apiRequest('POST', '/api/auth/login', loginData);
    
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    setAuthData(data);
    
    return data;
  };

  const register = async (formData: any) => {
    const data = await apiRequest('POST', '/api/auth/register-company', formData);
    
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    setAuthData(data);
  };

  const logout = () => {
    setUser(null);
    setCompany(null);
    setToken(null);
    clearAuthData();
  };

  return (
    <AuthContext.Provider value={{
      user,
      company,
      token,
      login,
      register,
      logout,
      isLoading,
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
