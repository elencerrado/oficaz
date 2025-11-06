import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, refreshAccessToken } from "./auth";

// Track auth errors to avoid redirecting on transient failures
let consecutiveAuthErrors = 0;
const MAX_AUTH_ERRORS_BEFORE_REDIRECT = 3;
let lastAuthErrorTime = 0;

// Reset counter if it's been more than 10 seconds since last error
function shouldResetAuthErrorCounter() {
  const now = Date.now();
  if (now - lastAuthErrorTime > 10000) {
    consecutiveAuthErrors = 0;
    return true;
  }
  return false;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const authHeaders = getAuthHeaders();
  console.log('🔑 Auth headers for request:', authHeaders, 'URL:', url);
  const headers: Record<string, string> = {};
  
  // Solo establecer Content-Type para JSON, FormData lo maneja automáticamente
  const isFormData = data instanceof FormData;
  let body: any = undefined;
  
  if (data) {
    if (isFormData) {
      // FormData maneja su propio Content-Type con boundary
      body = data;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }
  
  // Always add authorization header if token exists
  Object.assign(headers, authHeaders);

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  // 🔒 SECURITY: Handle token expiration with auto-refresh
  if (res.status === 403 || res.status === 401) {
    let isAuthError = false;
    try {
      const errorText = await res.text();
      if (errorText.includes('Invalid or expired token') || errorText.includes('Access token required')) {
        isAuthError = true;
        console.log('🚨 Auth error detected in API request:', url);
        
        // Skip refresh for login/refresh endpoints to avoid infinite loops
        if (url.includes('/api/auth/login') || url.includes('/api/auth/refresh') || url.includes('/api/super-admin/login')) {
          console.log('🚨 Auth error during login/refresh, not attempting refresh');
          return null;
        }
        
        // 🔒 SECURITY: Try to refresh token before redirecting
        const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
        const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
        
        // Only try refresh for regular users (not super admin)
        if (!isSuperAdmin && !hasSuperAdminToken) {
          console.log('🔄 Attempting token refresh...');
          const newToken = await refreshAccessToken();
          
          if (newToken) {
            console.log('✅ Token refreshed, retrying original request...');
            consecutiveAuthErrors = 0; // Reset counter after successful refresh
            
            // Retry the original request with new token
            const retryHeaders: Record<string, string> = {
              ...headers,
              Authorization: `Bearer ${newToken}`
            };
            
            const retryRes = await fetch(url, {
              method,
              headers: retryHeaders,
              body,
              credentials: "include",
            });
            
            if (retryRes.ok) {
              if (retryRes.status === 204) {
                return null;
              }
              return retryRes.json();
            }
          }
        }
        
        // If refresh failed or we're super admin, proceed with redirect logic
        shouldResetAuthErrorCounter();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        console.log(`⚠️ Auth error count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
        
        if (!window.location.pathname.includes('/login')) {
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              console.log('🔄 Redirecting to SuperAdmin login...');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              console.log('🔄 Redirecting to login...');
              localStorage.removeItem('authData');
              sessionStorage.removeItem('authData');
              window.location.href = '/login';
            }
            return null;
          }
        }
      }
    } catch (e) {
      // Error handling for unparseable responses
      if (!window.location.pathname.includes('/login') && !url.includes('/api/auth/login') && !url.includes('/api/super-admin/login')) {
        shouldResetAuthErrorCounter();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        isAuthError = true;
        
        if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          if (isSuperAdmin || hasSuperAdminToken) {
            sessionStorage.removeItem('superAdminToken');
            window.location.href = '/super-admin';
          } else {
            localStorage.removeItem('authData');
            sessionStorage.removeItem('authData');
            window.location.href = '/login';
          }
          return null;
        }
      }
    }
    
    if (isAuthError) {
      return null;
    }
  } else if (res.ok) {
    // Reset error counter on successful request
    consecutiveAuthErrors = 0;
  }
  
  await throwIfResNotOk(res);
  
  // Handle 204 No Content responses (like DELETE operations)
  if (res.status === 204) {
    return null;
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    // Query with auth headers
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...authHeaders,
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // 🔒 SECURITY: Handle token expiration in queries with auto-refresh
    if (res.status === 403 || res.status === 401) {
      let isAuthError = false;
      try {
        const errorText = await res.text();
        if (errorText.includes('Invalid or expired token') || errorText.includes('Access token required')) {
          isAuthError = true;
          console.log('🚨 Auth error in query:', queryKey[0]);
          
          // 🔒 SECURITY: Try to refresh token before redirecting
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          // Only try refresh for regular users (not super admin)
          if (!isSuperAdmin && !hasSuperAdminToken) {
            console.log('🔄 Attempting token refresh from query...');
            const newToken = await refreshAccessToken();
            
            if (newToken) {
              console.log('✅ Token refreshed, retrying query...');
              consecutiveAuthErrors = 0; // Reset counter after successful refresh
              
              // Retry the query with new token
              const retryRes = await fetch(queryKey[0] as string, {
                credentials: "include",
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache',
                  Authorization: `Bearer ${newToken}`
                },
              });
              
              if (retryRes.ok) {
                return retryRes.json();
              }
            }
          }
          
          // If refresh failed or we're super admin, proceed with redirect logic
          shouldResetAuthErrorCounter();
          consecutiveAuthErrors++;
          lastAuthErrorTime = Date.now();
          console.log(`⚠️ Auth error in query count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
          
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              console.log('🔄 Redirecting to SuperAdmin login...');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              console.log('🔄 Redirecting to login...');
              localStorage.removeItem('authData');
              sessionStorage.removeItem('authData');
              window.location.href = '/login';
            }
          }
          return null;
        }
      } catch (e) {
        // If we can't read the error text, still handle as auth error
        shouldResetAuthErrorCounter();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        isAuthError = true;
        
        if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          if (isSuperAdmin || hasSuperAdminToken) {
            sessionStorage.removeItem('superAdminToken');
            window.location.href = '/super-admin';
          } else {
            localStorage.removeItem('authData');
            sessionStorage.removeItem('authData');
            window.location.href = '/login';
          }
        }
        return null;
      }
      
      // If it's an auth error, return null silently - don't throw
      if (isAuthError) {
        return null;
      }
    } else if (res.ok) {
      // Reset error counter on successful query
      consecutiveAuthErrors = 0;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Refetch when window regains focus
      refetchOnReconnect: true, // Refetch when internet reconnects
      staleTime: 1 * 60 * 1000, // 1 minute cache
      gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
      retry: 1,
      retryDelay: 500,
    },
    mutations: {
      retry: false,
    },
  },
});

// Track last activity time to detect stale sessions
let lastActivityTime = Date.now();

// Update activity time on any user interaction
if (typeof window !== 'undefined') {
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    window.addEventListener(event, () => {
      lastActivityTime = Date.now();
    }, { passive: true });
  });

  // When window regains focus after being inactive for >30 minutes, invalidate all queries
  window.addEventListener('focus', () => {
    const inactiveTime = Date.now() - lastActivityTime;
    const thirtyMinutes = 30 * 60 * 1000;
    
    if (inactiveTime > thirtyMinutes) {
      console.log(`🔄 Window inactive for ${Math.round(inactiveTime / 60000)} minutes - refreshing all data`);
      queryClient.invalidateQueries(); // Force refetch all data
      lastActivityTime = Date.now();
    }
  });
}
