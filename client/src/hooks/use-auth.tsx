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
  const [authData, setAuthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
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
            setUser(data.user);
            setCompany(data.company);
            setToken(authData.token);
            setAuthData({ ...data, token: authData.token });
          } else {
            console.log('Auth verification failed, clearing data');
            clearAuthData();
            setUser(null);
            setCompany(null);
            setToken(null);
            setAuthData(null);
          }
        } catch (error) {
          console.log('Auth init error:', error);
          // Clear corrupted auth data
          clearAuthData();
          setUser(null);
          setCompany(null);
          setToken(null);
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
    
    console.log('Login successful, saving auth data:', { 
      user: data.user?.fullName, 
      company: data.company?.name, 
      subscription: data.subscription?.plan,
      token: data.token ? 'present' : 'missing' 
    });
    
    // Save complete auth data to localStorage
    setAuthData(data);
    
    // Update state with all data including subscription
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    
    console.log('Auth state updated successfully, token saved:', data.token ? 'yes' : 'no');
    
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
    setAuthData(null);
    clearAuthData();
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
