import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  company: Company;
  subscription?: any;
}

export function setAuthData(data: AuthData) {
  try {
    localStorage.setItem('authData', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function getAuthData(): AuthData | null {
  const authDataStr = localStorage.getItem('authData');
  
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
}

export function getAuthHeaders(): HeadersInit {
  // Check for super admin token first (for super admin operations)
  const superAdminToken = localStorage.getItem('superAdminToken');
  if (superAdminToken) {
    return { Authorization: `Bearer ${superAdminToken}` };
  }
  
  // Fall back to regular user token
  const authData = getAuthData();
  return authData && authData.token ? { Authorization: `Bearer ${authData.token}` } : {};
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
