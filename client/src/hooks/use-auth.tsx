import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Company } from '@shared/schema';
import { getAuthData, setAuthData as saveAuthData, clearAuthData, clearExpiredTokens, setTokenRefreshCallback } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  login: (dniOrEmail: string, password: string, companyAlias?: string, remember?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: (manual?: boolean) => void;
  refreshUser: () => Promise<void>;
  updateToken: (newToken: string) => void; // 🔒 SECURITY: Update token after refresh
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
              // Clear only auth data, preserve other localStorage items
              localStorage.removeItem('authData');
              window.location.href = '/login';
              return;
            }

            // 🔄 ROLE CHANGE DETECTION: If server detected role change, update token and reload
            if (data.roleChanged && data.newToken) {
              console.log(`🔄 ROLE CHANGE DETECTED: ${data.previousRole} → ${data.user.role} - Updating and reloading...`);
              // Update token in storage with new role
              const updatedAuthData = {
                ...authData,
                token: data.newToken,
                user: data.user
              };
              localStorage.setItem('authData', JSON.stringify(updatedAuthData));
              // Clear all cached data to prevent stale permissions
              queryClient.clear();
              // Reload page to show new dashboard with correct permissions
              window.location.reload();
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
          } else if (response.status === 403) {
            // Check if it's a cancelled account
            const errorData = await response.json();
            if (errorData.code === 'ACCOUNT_CANCELLED') {
              console.log('🚫 ACCOUNT CANCELLED - BLOCKING ACCESS');
              // Clear auth data and redirect to login with a message
              localStorage.removeItem('authData');
              window.location.href = '/login?message=account_cancelled';
              return;
            }
          } else {
            console.log('Auth verification failed, clearing data');
            clearAuthData();
            // CRITICAL: Only clear auth data, not entire localStorage
            localStorage.removeItem('authData');
            setUser(null);
            setCompany(null);
            setToken(null);
            setAuthData(null);
          }
        } catch (error) {
          console.log('Auth init error:', error);
          // Clear corrupted auth data only
          clearAuthData();
          localStorage.removeItem('authData');
          setUser(null);
          setCompany(null);
          setToken(null);
          setAuthData(null);
        }
      }
      setIsLoading(false);
      
      // Remove PWA splash screen when auth is ready
      if (typeof window !== 'undefined' && typeof (window as any).removeInitialSplash === 'function') {
        (window as any).removeInitialSplash();
      }
    };

    initAuth();
  }, []);

  const login = async (dniOrEmail: string, password: string, companyAlias?: string, remember: boolean = true) => {
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
      // Check for cancelled account during login
      if (response.status === 403 && errorData.code === 'ACCOUNT_CANCELLED') {
        throw new Error('ACCOUNT_CANCELLED');
      }
      throw new Error(errorData.message || 'Error de login');
    }

    const data = await response.json();
    console.log('🔐 Login response received:', { 
      hasToken: !!data.token, 
      hasUser: !!data.user, 
      tokenLength: data.token?.length,
      userEmail: data.user?.email,
      companyName: data.company?.name,
      remember
    });
    
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
    
    // 🔒 SECURITY: Save auth data with refresh token for auto-refresh
    const authDataToSave = { 
      user: data.user, 
      token: data.token, 
      refreshToken: data.refreshToken, // Store refresh token for auto-refresh
      company: data.company, 
      subscription: data.subscription 
    };
    
    // Use the updated setAuthData function with remember parameter
    saveAuthData(authDataToSave, remember);
    console.log(`🔐 Auth data saved to ${remember ? 'localStorage' : 'sessionStorage'} (with refresh token)`);
    
    // Update state immediately
    setUser(data.user);
    setCompany(data.company);
    setToken(data.token);
    setAuthData(authDataToSave);
    console.log('🔐 Auth state updated, token length:', data.token?.length);
    
    // Clear and invalidate queries immediately since auth is now available
    queryClient.clear();
    queryClient.invalidateQueries();
    console.log('🔄 Queries cleared and invalidated after successful auth update');
    
    return data;
  };

  const register = async (formData: any) => {
    console.log('🔐 Register attempt starting...');
    const data = await apiRequest('POST', '/api/auth/register', formData);
    console.log('🔐 Register response received:', { hasToken: !!data.token, hasUser: !!data.user });
    
    // CRITICAL FIX: Clear ALL cached queries before setting new auth data
    // This prevents stale data from previous sessions from appearing
    queryClient.clear();
    console.log('🔄 Queries cleared for fresh registration');
    
    // Save initial auth data to localStorage
    localStorage.setItem('authData', JSON.stringify(data));
    saveAuthData(data);
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
        saveAuthData(completeAuthData);
        console.log('✅ Complete auth data saved with subscription info');
      }
    } catch (error) {
      console.error('⚠️ Error refreshing user data after registration:', error);
      // Registration still succeeded, just subscription data might be missing
    }
    
    // CRITICAL FIX: Invalidate all queries after registration to ensure fresh data loads
    // This is essential for the dashboard to show newly created demo employees
    queryClient.invalidateQueries();
    console.log('🔄 All queries invalidated for fresh data after registration');
    
    // Set flag for welcome modal to show after navigation to dashboard
    localStorage.setItem('showWelcomeModal', 'true');
    console.log('🎉 Welcome modal flag set');
    
    return data;
  };

  const logout = async (manual: boolean = true) => {
    console.log(`🚪 LOGOUT (${manual ? 'MANUAL' : 'AUTO'}) - CLEARING CACHE AND AUTH DATA`);
    
    // CRITICAL: Clear localStorage FIRST to prevent re-initialization
    const theme = localStorage.getItem('theme');
    localStorage.removeItem('authData');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    sessionStorage.clear();
    if (theme) localStorage.setItem('theme', theme);
    console.log('✅ localStorage cleared');
    
    // Clear state immediately AFTER localStorage
    setUser(null);
    setCompany(null);
    setToken(null);
    setAuthData(null);
    console.log('✅ State cleared');
    
    // 🔒 SECURITY: Revoke refresh token on manual logout
    if (manual && token) {
      try {
        console.log('🔒 Revoking refresh token...');
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ refreshToken: getAuthData()?.refreshToken })
        });
        console.log('✅ Refresh token revoked');
      } catch (error) {
        console.error('⚠️ Error revoking refresh token:', error);
      }
    }
    
    // Clear queries
    queryClient.clear();
    
    // Direct redirect without delay
    console.log('🔄 Redirecting to login NOW...');
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 🔄 ROLE CHANGE DETECTION: If server detected role change, update token and reload
        if (data.roleChanged && data.newToken) {
          console.log(`🔄 ROLE CHANGE DETECTED: ${data.previousRole} → ${data.user.role} - Updating and reloading...`);
          // Update token in storage with new role
          const currentAuthData = getAuthData();
          const updatedAuthData = {
            ...currentAuthData,
            token: data.newToken,
            user: data.user,
            company: data.company,
            subscription: data.subscription
          };
          localStorage.setItem('authData', JSON.stringify(updatedAuthData));
          // Clear all cached data to prevent stale permissions
          queryClient.clear();
          // Reload page to show new dashboard with correct permissions
          window.location.reload();
          return;
        }
        
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

  // 🔒 SECURITY: Update token in AuthProvider state after refresh
  const updateToken = (newToken: string) => {
    setToken(newToken);
    const currentAuthData = getAuthData();
    if (currentAuthData) {
      const updatedAuthData = {
        ...currentAuthData,
        token: newToken
      };
      setAuthData(updatedAuthData);
      console.log('✅ AuthProvider state updated with new token');
    }
  };

  // 🔒 SECURITY: Register callback for token refresh
  useEffect(() => {
    setTokenRefreshCallback(updateToken);
    return () => setTokenRefreshCallback(() => {});
  }, []);

  // 🔄 UNIFIED WEBSOCKET: Listen for all real-time events
  // Handles: role changes, messages, work sessions, vacation requests, reminders, documents
  // This eliminates polling for real-time data - much more efficient!
  useEffect(() => {
    if (!token || !user) return;
    
    // Build WebSocket URL using current host
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/work-sessions?token=${token}`;
    
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 5000; // 5 seconds
    
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected for real-time updates');
          reconnectAttempts = 0;
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Helper to invalidate all queries starting with a path
            const invalidateByPath = (basePath: string) => {
              queryClient.invalidateQueries({
                predicate: (query) => {
                  const key = query.queryKey[0];
                  return typeof key === 'string' && key.startsWith(basePath);
                }
              });
            };
            
            // Handle different event types
            switch (data.type) {
              // Role change - reload page with new token
              case 'role_changed':
                if (data.newToken) {
                  console.log(`🔄 ROLE CHANGE: ${data.previousRole} → ${data.newRole}`);
                  const currentAuthData = getAuthData();
                  const updatedAuthData = { ...currentAuthData, token: data.newToken };
                  localStorage.setItem('authData', JSON.stringify(updatedAuthData));
                  queryClient.clear();
                  window.location.reload();
                }
                break;
              
              // Messages - refresh all message-related queries including unread count
              case 'message_received':
                console.log('📬 New message received via WebSocket');
                invalidateByPath('/api/messages');
                // Also invalidate unread count for badge updates
                queryClient.invalidateQueries({ 
                  predicate: (query) => {
                    const key = query.queryKey[0];
                    return typeof key === 'string' && key.startsWith('/api/messages/unread');
                  }
                });
                break;
              
              // Work sessions - refresh all time tracking and dashboard queries
              case 'work_session_created':
              case 'work_session_updated':
              case 'work_session_deleted':
                console.log(`⏱️ Work session ${data.type.replace('work_session_', '')} via WebSocket`);
                invalidateByPath('/api/work-sessions');
                invalidateByPath('/api/break-periods');
                invalidateByPath('/api/admin/dashboard');
                invalidateByPath('/api/admin/work-sessions');
                break;
              
              // Vacation requests - refresh all vacation-related queries
              case 'vacation_request_created':
              case 'vacation_request_updated':
                console.log(`🏖️ Vacation request ${data.type.replace('vacation_request_', '')} via WebSocket`);
                invalidateByPath('/api/vacation-requests');
                invalidateByPath('/api/admin/dashboard');
                break;
              
              // Time modification requests
              case 'modification_request_created':
              case 'modification_request_updated':
                console.log(`✏️ Modification request ${data.type.replace('modification_request_', '')} via WebSocket`);
                invalidateByPath('/api/admin/work-sessions/modification-requests');
                break;
              
              // Documents - refresh all document-related queries
              case 'document_request_created':
              case 'document_uploaded':
                console.log(`📄 Document event via WebSocket`);
                invalidateByPath('/api/documents');
                invalidateByPath('/api/document-notifications');
                break;
              
              // Reminders - refresh all reminder queries
              case 'reminder_created':
              case 'reminder_user_completed':
              case 'reminder_all_completed':
                console.log(`🔔 Reminder event via WebSocket: ${data.type}`);
                invalidateByPath('/api/reminders');
                break;
              
              // Work reports
              case 'work_report_created':
                console.log(`📝 Work report created via WebSocket`);
                invalidateByPath('/api/admin/work-reports');
                invalidateByPath('/api/work-reports');
                break;
            }
          } catch (e) {
            // Ignore parse errors for non-JSON messages
          }
        };
        
        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          // Attempt to reconnect if not at max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connect, reconnectDelay);
          }
        };
        
        ws.onerror = () => {
          // Silent error - connection will close and attempt reconnect
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };
    
    connect();
    
    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [token, user?.id]);

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
      updateToken, // 🔒 SECURITY: Expose updateToken for refresh
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
