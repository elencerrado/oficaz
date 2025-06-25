import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./auth";

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
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Always add authorization header if token exists
  Object.assign(headers, authHeaders);
  
  // Auth headers applied successfully

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle token expiration or malformed tokens
  if (res.status === 403) {
    try {
      const errorText = await res.text();
      if (errorText.includes('Invalid or expired token')) {
        // Clear auth data and redirect to login
        localStorage.removeItem('authData');
        window.location.href = '/login';
        return;
      }
    } catch (e) {
      // If we can't read the error text, still handle as auth error
      localStorage.removeItem('authData');
      window.location.href = '/login';
      return;
    }
  }
  
  await throwIfResNotOk(res);
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

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1 * 60 * 1000, // 1 minute cache for reminders
      gcTime: 2 * 60 * 1000, // 2 minutes garbage collection for reminders
      retry: 1,
      retryDelay: 500,
    },
    mutations: {
      retry: false,
    },
  },
});
