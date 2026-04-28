import { QueryClient, QueryFunction, dehydrate, hydrate } from "@tanstack/react-query";
import { getAuthHeaders, refreshAccessToken, clearAuthData } from "./auth";
import { logger } from "./logger";
import { buildApiUrl } from "./server-config";

interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  data?: unknown;
  queuedAt: number;
}

const QUERY_CACHE_STORAGE_KEY = 'oficaz-react-query-cache-v1';
const MUTATION_QUEUE_STORAGE_KEY = 'oficaz-offline-mutation-queue-v1';
const MAX_MUTATION_QUEUE_SIZE = 100;

function normalizeHeaders(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function readQueuedMutations(): QueuedMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MUTATION_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueuedMutations(queue: QueuedMutation[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTATION_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors to avoid breaking user flow.
  }
}

function queueOfflineMutation(method: string, url: string, data?: unknown): void {
  const nextItem: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    url,
    data,
    queuedAt: Date.now(),
  };

  const currentQueue = readQueuedMutations();
  currentQueue.push(nextItem);
  if (currentQueue.length > MAX_MUTATION_QUEUE_SIZE) {
    currentQueue.splice(0, currentQueue.length - MAX_MUTATION_QUEUE_SIZE);
  }
  writeQueuedMutations(currentQueue);
}

let isFlushingOfflineQueue = false;

export async function flushOfflineMutationQueue(): Promise<void> {
  if (typeof window === 'undefined' || isFlushingOfflineQueue || !navigator.onLine) {
    return;
  }

  isFlushingOfflineQueue = true;
  try {
    const queue = readQueuedMutations();
    if (queue.length === 0) return;

    const remaining: QueuedMutation[] = [];

    for (const item of queue) {
      try {
        const authHeaders = normalizeHeaders(getAuthHeaders());
        const headers: Record<string, string> = {
          ...authHeaders,
          'Content-Type': 'application/json',
        };

        const response = await fetch(buildApiUrl(item.url), {
          method: item.method,
          headers,
          credentials: 'include',
          body: item.data === undefined ? undefined : JSON.stringify(item.data),
        });

        if (!response.ok) {
          // Keep non-successful requests in queue for manual retry/inspection.
          remaining.push(item);
        }
      } catch {
        // Likely still offline or intermittent failure, keep the item.
        remaining.push(item);
      }
    }

    writeQueuedMutations(remaining);

    if (remaining.length === 0) {
      queryClient.invalidateQueries();
    }
  } finally {
    isFlushingOfflineQueue = false;
  }
}

function persistQueryCacheToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const dehydratedState = dehydrate(queryClient);
    window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify(dehydratedState));
  } catch {
    // Ignore serialization/storage failures.
  }
}

function restoreQueryCacheFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return;
    const dehydratedState = JSON.parse(raw);
    hydrate(queryClient, dehydratedState);
  } catch {
    // Ignore hydration failures from stale/incompatible cache.
  }
}

// Track auth errors to avoid redirecting on transient failures
let consecutiveAuthErrors = 0;
const MAX_AUTH_ERRORS_BEFORE_REDIRECT = 3;
let lastAuthErrorTime = 0;

// Reset counter if it's been more than 10 seconds since last error
function resetAuthErrorCounterIfStale(): void {
  const now = Date.now();
  if (now - lastAuthErrorTime > 10000) {
    consecutiveAuthErrors = 0;
  }
}

// Auth error detection patterns (centralized for consistency)
const AUTH_ERROR_PATTERNS = [
  'invalid or expired token',
  'access token required',
  'token inválido o expirado',
  'token invalido o expirado',
  'token de verificación inválido o expirado',
  'token de verificacion invalido o expirado',
];

function isAuthErrorMessage(errorText: string): boolean {
  const normalized = errorText.toLowerCase();
  return AUTH_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
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
  // Build full URL using server configuration
  const fullUrl = buildApiUrl(url);
  
  const authHeaders = getAuthHeaders();
  logger.debug('🔑 Auth headers for request:', authHeaders, 'URL:', fullUrl);
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

  const isMutation = method.toUpperCase() !== 'GET';

  // Queue critical writes while offline to provide real mutation replay.
  if (typeof window !== 'undefined' && isMutation && !navigator.onLine) {
    if (!isFormData) {
      queueOfflineMutation(method, url, data);
      return {
        queued: true,
        offline: true,
        message: 'Sin conexion. Accion guardada y se reintentara automaticamente.',
      };
    }

    throw new Error('No hay conexion para enviar este formulario');
  }
  
  // Always add authorization header if token exists
  Object.assign(headers, authHeaders);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      headers,
      body,
      credentials: "include",
    });
  } catch (error) {
    if (typeof window !== 'undefined' && isMutation && !isFormData) {
      queueOfflineMutation(method, url, data);
      return {
        queued: true,
        offline: true,
        message: 'Conexion inestable. Accion guardada para reintento.',
      };
    }
    throw error;
  }

  // 🔒 SECURITY: Handle token expiration with auto-refresh
  let cachedErrorText: string | null = null;
  
  if (res.status === 403 || res.status === 401) {
    let isAuthError = false;
    try {
      cachedErrorText = await res.text();
      if (isAuthErrorMessage(cachedErrorText)) {
        isAuthError = true;
        logger.warn('🚨 Auth error detected in API request:', fullUrl);
        
        // Skip refresh for login/refresh endpoints to avoid infinite loops
        if (url.includes('/api/auth/login') || url.includes('/api/auth/refresh') || url.includes('/api/super-admin/login')) {
          logger.warn('🚨 Auth error during login/refresh, not attempting refresh');
          return null;
        }
        
        // 🔒 SECURITY: Try to refresh token before redirecting
        const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
        const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
        
        // Only try refresh for regular users (not super admin)
        if (!isSuperAdmin && !hasSuperAdminToken) {
          logger.info('🔄 Attempting token refresh...');
          const newToken = await refreshAccessToken();
          
          if (newToken) {
            logger.info('✅ Token refreshed, retrying original request...');
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
        resetAuthErrorCounterIfStale();
        consecutiveAuthErrors++;
        lastAuthErrorTime = Date.now();
        logger.warn(`⚠️ Auth error count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
        
        if (!window.location.pathname.includes('/login')) {
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              logger.info('🔄 Redirecting to SuperAdmin login...');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              logger.info('🔄 Redirecting to login...');
              clearAuthData();
              window.location.href = '/login';
            }
            return null;
          }
        }
      }
    } catch (e) {
      // Error handling for unparseable responses
      if (!window.location.pathname.includes('/login') && !url.includes('/api/auth/login') && !url.includes('/api/super-admin/login')) {
        resetAuthErrorCounterIfStale();
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
            clearAuthData();
            window.location.href = '/login';
          }
          return null;
        }
      }
    }
    
    if (isAuthError) {
      return null;
    }
    
    // Non-auth error: throw with cached error text
    if (cachedErrorText) {
      throw new Error(`${res.status}: ${cachedErrorText}`);
    }
  } else if (res.ok) {
    // Reset error counter on successful request
    consecutiveAuthErrors = 0;
  }
  
  if (!res.ok && !cachedErrorText) {
    await throwIfResNotOk(res);
  }
  
  // Handle 204 No Content responses (like DELETE operations)
  if (res.status === 204) {
    return null;
  }
  // Prefer robust parsing: handle non-JSON or empty bodies gracefully
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    if (!rawText) {
      // Empty body on success → return null
      return null;
    }
    try {
      return JSON.parse(rawText);
    } catch {
      // If server returned success but non-JSON text, return a simple object
      if (res.ok) {
        return { success: true, message: rawText };
      }
      // Otherwise propagate as an error
      throw new Error(`${res.status}: ${rawText}`);
    }
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
    // Build URL with query params if second element exists
    let url = queryKey[0] as string;
    if (queryKey[1]) {
      if (typeof queryKey[1] === 'string' && queryKey[1].length > 0) {
        // Legacy: string query params
        url = `${url}?${queryKey[1]}`;
      } else if (typeof queryKey[1] === 'object') {
        // New: object query params for better cache management
        const params = new URLSearchParams();
        Object.entries(queryKey[1]).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });
        const queryString = params.toString();
        if (queryString) {
          url = `${url}?${queryString}`;
        }
      }
    }
    // Query with auth headers
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        ...authHeaders,
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // 🔒 SECURITY: Handle token expiration in queries with auto-refresh
    let cachedErrorText: string | null = null;
    
    if (res.status === 403 || res.status === 401) {
      let isAuthError = false;
      try {
        cachedErrorText = await res.text();
        if (isAuthErrorMessage(cachedErrorText)) {
          isAuthError = true;
          logger.warn('🚨 Auth error in query:', queryKey[0]);
          
          // 🔒 SECURITY: Try to refresh token before redirecting
          const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
          const hasSuperAdminToken = sessionStorage.getItem('superAdminToken');
          
          // Only try refresh for regular users (not super admin)
          if (!isSuperAdmin && !hasSuperAdminToken) {
            logger.info('🔄 Attempting token refresh from query...');
            const newToken = await refreshAccessToken();
            
            if (newToken) {
              logger.info('✅ Token refreshed, retrying query...');
              consecutiveAuthErrors = 0; // Reset counter after successful refresh
              
              // Retry the query with new token (use same URL with query params)
              const retryRes = await fetch(url, {
                credentials: "include",
                headers: {
                  Authorization: `Bearer ${newToken}`
                },
              });
              
              if (retryRes.ok) {
                return retryRes.json();
              }
            }
          }
          
          // If refresh failed or we're super admin, proceed with redirect logic
          resetAuthErrorCounterIfStale();
          consecutiveAuthErrors++;
          lastAuthErrorTime = Date.now();
          logger.warn(`⚠️ Auth error in query count: ${consecutiveAuthErrors}/${MAX_AUTH_ERRORS_BEFORE_REDIRECT}`);
          
          if (consecutiveAuthErrors >= MAX_AUTH_ERRORS_BEFORE_REDIRECT) {
            if (isSuperAdmin || hasSuperAdminToken) {
              logger.info('🔄 Redirecting to SuperAdmin login...');
              sessionStorage.removeItem('superAdminToken');
              window.location.href = '/super-admin';
            } else {
              logger.info('🔄 Redirecting to login...');
              clearAuthData();
              window.location.href = '/login';
            }
          }
          return null;
        }
      } catch (e) {
        // If we can't read the error text, still handle as auth error
        resetAuthErrorCounterIfStale();
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
            clearAuthData();
            window.location.href = '/login';
          }
        }
        return null;
      }
      
      // If it's an auth error, return null silently - don't throw
      if (isAuthError) {
        return null;
      }
      
      // Non-auth error: throw with cached error text
      if (cachedErrorText) {
        throw new Error(`${res.status}: ${cachedErrorText}`);
      }
    } else if (res.ok) {
      // Reset error counter on successful query
      consecutiveAuthErrors = 0;
    }

    if (!res.ok && !cachedErrorText) {
      await throwIfResNotOk(res);
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      networkMode: 'offlineFirst',
      refetchInterval: false,
      refetchOnWindowFocus: false, // Avoid network storms on focus; opt in per-query when needed
      refetchOnReconnect: true, // Refetch when internet reconnects
      staleTime: 1 * 60 * 1000, // 1 minute cache
      gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
      retry: 2, // Retry failed queries twice before failing
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false, // Don't retry mutations to avoid duplicate operations
    },
  },
});

// Track last activity time to detect stale sessions
let lastActivityTime = Date.now();

// Update activity time on any user interaction
if (typeof window !== 'undefined') {
  restoreQueryCacheFromStorage();

  let persistTimer: number | null = null;
  queryClient.getQueryCache().subscribe(() => {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(() => {
      persistQueryCacheToStorage();
    }, 500);
  });

  window.addEventListener('beforeunload', persistQueryCacheToStorage);

  window.addEventListener('online', () => {
    void flushOfflineMutationQueue();
    queryClient.invalidateQueries();
  });

  void flushOfflineMutationQueue();

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
      // console.log(`🔄 Window inactive for ${Math.round(inactiveTime / 60000)} minutes - refreshing all data`);
      queryClient.invalidateQueries(); // Force refetch all data
      lastActivityTime = Date.now();
    }
  });
}
