import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  company: Company;
  subscription?: any;
}

export function setAuthData(data: AuthData) {
  localStorage.setItem('authData', JSON.stringify(data));
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
  const authData = getAuthData();
  return authData ? { Authorization: `Bearer ${authData.token}` } : {};
}
