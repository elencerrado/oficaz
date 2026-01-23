import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  refreshToken?: string; // 🔒 SECURITY: Refresh token for auto-refresh
  company: Company;
  subscription?: any;
}

// 🔒 SECURITY: Lightweight symmetric obfuscation for authData at rest
// Not a replacement for CSP/SameSite cookies, but reduces trivial token theft via XSS/localStorage dumps
const STORAGE_KEY = import.meta.env.VITE_STORAGE_KEY || 'oficaz-default-key';
const ENC_PREFIX = 'enc:';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function xorBytes(data: Uint8Array, keyBytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
}

function encryptAuthPayload(payload: AuthData): string {
  const plaintext = encoder.encode(JSON.stringify(payload));
  const keyBytes = encoder.encode(STORAGE_KEY);
  const cipherBytes = xorBytes(plaintext, keyBytes);
  const base64 = btoa(String.fromCharCode(...cipherBytes));
  return `${ENC_PREFIX}${base64}`;
}

function decryptAuthPayload(raw: string): AuthData | null {
  try {
    const base64 = raw.startsWith(ENC_PREFIX) ? raw.slice(ENC_PREFIX.length) : raw;
    const cipherBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const keyBytes = encoder.encode(STORAGE_KEY);
    const plainBytes = xorBytes(cipherBytes, keyBytes);
    const json = decoder.decode(plainBytes);
    return JSON.parse(json);
  } catch (error) {
    // Fallback to legacy JSON.parse for backwards compatibility
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to decrypt authData:', err);
      return null;
    }
  }
}

export function setAuthData(data: AuthData, remember: boolean = true) {
  try {
    const storage = remember ? localStorage : sessionStorage;
    const storageType = remember ? 'localStorage' : 'sessionStorage';
    
    const encrypted = encryptAuthPayload(data);
    storage.setItem('authData', encrypted);
    
    // Clear from the other storage to avoid conflicts
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('authData');
    
    // Verify it was saved correctly
    const saved = storage.getItem('authData');
    if (saved) {
      const parsed = JSON.parse(saved);
      // // console.log(`✅ Auth data verification - saved successfully to ${storageType}:`, { hasToken: !!parsed.token });
    } else {
      // // console.error(`❌ Auth data was not saved to ${storageType}`);
    }
  } catch (error) {
    // // console.error('Error saving auth data:', error);
  }
}

export function getAuthData(): AuthData | null {
  // Try localStorage first (persistent sessions)
  let authDataStr = localStorage.getItem('authData');
  
  // If not in localStorage, try sessionStorage (temporary sessions)
  if (!authDataStr) {
    authDataStr = sessionStorage.getItem('authData');
  }
  
  if (!authDataStr) {
    return null;
  }

  return decryptAuthPayload(authDataStr);
}

export function clearAuthData() {
  localStorage.removeItem('authData');
  sessionStorage.removeItem('authData');
}

// Emergency function to force clear all authentication data
export function forceLogout() {
  // Clear all possible auth storage
  localStorage.removeItem('authData');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('company');
  
  // Clear session storage as well (including superAdminToken)
  sessionStorage.clear();
  
  // Reload page to reset state completely
  window.location.href = '/login';
}

export function getAuthHeaders(): HeadersInit {
  // 🔒 SECURITY: Super admin token now stored in sessionStorage (closes on browser close)
  const superAdminToken = sessionStorage.getItem('superAdminToken');
  if (superAdminToken) {
    // // console.log('🔑 Using super admin token');
    return { Authorization: `Bearer ${superAdminToken}` };
  }
  
  // Fall back to regular user token
  const authData = getAuthData();
  // // console.log('🔑 Auth data:', authData ? 'exists' : 'missing', 'Token:', authData?.token ? 'exists' : 'missing');
  
  if (authData && authData.token) {
    // // console.log('✅ Returning auth header with token');
    return { Authorization: `Bearer ${authData.token}` };
  } else {
    // // console.log('❌ No token available, returning empty headers');
    return {};
  }
}

// Helper function to check if token is likely expired
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    return true; // If we can't parse it, consider it expired
  }
}

// Enhanced function to clear expired tokens
export function clearExpiredTokens() {
  const authData = getAuthData();
  if (authData && authData.token && isTokenExpired(authData.token)) {
    // // console.log('Clearing expired auth token');
    clearAuthData();
  }
  
  // 🔒 SECURITY: Check sessionStorage for super admin token
  const superAdminToken = sessionStorage.getItem('superAdminToken');
  if (superAdminToken && isTokenExpired(superAdminToken)) {
    // // console.log('🔒 Clearing expired super admin token');
    sessionStorage.removeItem('superAdminToken');
    // Redirect to super admin login
    if (window.location.pathname.startsWith('/super-admin')) {
      window.location.href = '/super-admin';
    }
  }
}

// 🔒 SECURITY: Callback to update AuthProvider state after refresh
let onTokenRefreshed: ((token: string) => void) | null = null;

export function setTokenRefreshCallback(callback: (token: string) => void) {
  onTokenRefreshed = callback;
}

// 🔒 SECURITY: Refresh access token using refresh token
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple simultaneous refresh attempts
  if (isRefreshing && refreshPromise) {
    // // console.log('🔄 Token refresh already in progress, waiting...');
    return refreshPromise;
  }

  isRefreshing = true;
  
  refreshPromise = (async () => {
    try {
      const authData = getAuthData();
      
      if (!authData?.refreshToken) {
        // // console.log('❌ No refresh token available');
        return null;
      }

      // // console.log('🔄 Attempting to refresh access token...');
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: authData.refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        // // console.log('❌ Refresh token failed:', response.status);
        clearAuthData();
        return null;
      }

      const data = await response.json();
      
      if (data.token && data.refreshToken) {
        // // console.log('✅ Access token refreshed successfully');
        // // console.log('🔄 Refresh token rotated (sliding session)');
        
        // 🔒 SLIDING SESSION: Update stored auth data with new access token AND new refresh token
        // Server MUST return a new refresh token (single-use) - old one is revoked
        const updatedAuthData = {
          ...authData,
          token: data.token,
          refreshToken: data.refreshToken,
        };
        
        // Update encrypted auth data in appropriate storage
        const remember = localStorage.getItem('authData') ? true : false;
        setAuthData(updatedAuthData, remember);
        
        // 🔒 SECURITY: Notify AuthProvider of token update
        if (onTokenRefreshed) {
          onTokenRefreshed(data.token);
        }
        
        return data.token;
      } else if (data.token && !data.refreshToken) {
        // 🔒 SECURITY: If server doesn't return new refresh token, the old one is revoked
        // Must fail the refresh and force re-login
        // // console.warn('⚠️ Server returned access token but no refresh token - session invalid');
        clearAuthData();
        return null;
      }
      
      return null;
    } catch (error) {
      // // console.error('❌ Error refreshing token:', error);
      clearAuthData();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}
