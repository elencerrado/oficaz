import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  company: Company;
  subscription?: any;
}

export function setAuthData(data: AuthData, remember: boolean = true) {
  try {
    const storage = remember ? localStorage : sessionStorage;
    const storageType = remember ? 'localStorage' : 'sessionStorage';
    
    console.log(`🔐 Saving auth data to ${storageType}:`, { hasToken: !!data.token, tokenLength: data.token?.length, remember });
    storage.setItem('authData', JSON.stringify(data));
    
    // Clear from the other storage to avoid conflicts
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem('authData');
    
    // Verify it was saved correctly
    const saved = storage.getItem('authData');
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log(`✅ Auth data verification - saved successfully to ${storageType}:`, { hasToken: !!parsed.token });
    } else {
      console.error(`❌ Auth data was not saved to ${storageType}`);
    }
  } catch (error) {
    console.error('Error saving auth data:', error);
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

  try {
    return JSON.parse(authDataStr);
  } catch {
    return null;
  }
}

export function clearAuthData() {
  localStorage.removeItem('authData');
  sessionStorage.removeItem('authData');
}

// Emergency function to force clear all authentication data
export function forceLogout() {
  // Clear all possible auth storage
  localStorage.removeItem('authData');
  localStorage.removeItem('superAdminToken');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('company');
  
  // Clear session storage as well
  sessionStorage.clear();
  
  // Reload page to reset state completely
  window.location.href = '/login';
}

export function getAuthHeaders(): HeadersInit {
  // Check for super admin token first (for super admin operations)
  const superAdminToken = localStorage.getItem('superAdminToken');
  if (superAdminToken) {
    console.log('🔑 Using super admin token');
    return { Authorization: `Bearer ${superAdminToken}` };
  }
  
  // Fall back to regular user token
  const authData = getAuthData();
  console.log('🔑 Auth data:', authData ? 'exists' : 'missing', 'Token:', authData?.token ? 'exists' : 'missing');
  
  if (authData && authData.token) {
    console.log('✅ Returning auth header with token');
    return { Authorization: `Bearer ${authData.token}` };
  } else {
    console.log('❌ No token available, returning empty headers');
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
    console.log('Clearing expired auth token');
    clearAuthData();
  }
  
  const superAdminToken = localStorage.getItem('superAdminToken');
  if (superAdminToken && isTokenExpired(superAdminToken)) {
    console.log('Clearing expired super admin token');
    localStorage.removeItem('superAdminToken');
  }
}
