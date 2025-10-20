import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./auth";

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

  // Handle token expiration, malformed tokens or 401 unauthorized
  // BUT DON'T redirect during login process
  if (res.status === 403 || res.status === 401) {
    try {
      const errorText = await res.text();
      if (errorText.includes('Invalid or expired token') || errorText.includes('Access token required')) {
        console.log('🚨 Auth error detected in API request:', url);
        
        // Reset counter if enough time has passed
        shouldResetAuthErrorCounter();
        
        // Increment error counter
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        console.log(`⚠️ Auth error count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
        
        // Check if this is a super admin session
        const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
        const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
        
        // Only redirect if we're not already on login page or in login process
        // AND we've had multiple consecutive errors
        if (!window.location.pathname.includes('/login') && !url.includes('/api/auth/login') && !url.includes('/api/super-admin/login')) {
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              console.log('🚨 SuperAdmin session expired after multiple errors, redirecting to SuperAdmin login');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              console.log('🚨 Regular session expired after multiple errors, redirecting to login');
              localStorage.removeItem('authData');
              sessionStorage.removeItem('authData');
              window.location.href = '/login';
            }
            return;
          } else {
            console.log('⏳ Transient auth error, allowing retry...');
          }
        } else {
          console.log('🚨 Auth error during login process, not redirecting');
        }
      }
    } catch (e) {
      // If we can't read the error text, still handle as auth error but be more careful
      if (!window.location.pathname.includes('/login') && !url.includes('/api/auth/login') && !url.includes('/api/super-admin/login')) {
        shouldResetAuthErrorCounter();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        
        if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          if (isSuperAdmin || hasSuperAdminToken) {
            console.log('🚨 SuperAdmin auth error (unreadable) after multiple errors, redirecting to SuperAdmin login');
            sessionStorage.removeItem('superAdminToken');
            window.location.href = '/super-admin';
          } else {
            console.log('🚨 Auth error (unreadable) after multiple errors, redirecting to login');
            localStorage.removeItem('authData');
            sessionStorage.removeItem('authData');
            window.location.href = '/login';
          }
          return;
        }
      }
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

    // Handle token expiration in queries too
    if (res.status === 403 || res.status === 401) {
      try {
        const errorText = await res.text();
        if (errorText.includes('Invalid or expired token') || errorText.includes('Access token required')) {
          // Reset counter if enough time has passed
          shouldResetAuthErrorCounter();
          
          // Increment error counter
          consecutiveAuthErrors++;
          lastAuthErrorTime = Date.now();
          console.log(`⚠️ Auth error in query count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
          
          // Check if this is a super admin session
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          // Only redirect after multiple consecutive errors
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              console.log('🚨 SuperAdmin session expired in query after multiple errors, redirecting to SuperAdmin login');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              console.log('🚨 Regular session expired in query after multiple errors, redirecting to login');
              localStorage.removeItem('authData');
              sessionStorage.removeItem('authData');
              window.location.href = '/login';
            }
          } else {
            console.log('⏳ Transient auth error in query, allowing retry...');
          }
          return null;
        }
      } catch (e) {
        // If we can't read the error text, still handle as auth error
        shouldResetAuthErrorCounter();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        
        if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          if (isSuperAdmin || hasSuperAdminToken) {
            console.log('🚨 SuperAdmin auth error in query (unreadable) after multiple errors, redirecting to SuperAdmin login');
            sessionStorage.removeItem('superAdminToken');
            window.location.href = '/super-admin';
          } else {
            console.log('🚨 Auth error in query (unreadable) after multiple errors, redirecting to login');
            localStorage.removeItem('authData');
            sessionStorage.removeItem('authData');
            window.location.href = '/login';
          }
        }
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
