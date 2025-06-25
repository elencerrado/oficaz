import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  company: Company;
  subscription?: any;
}

export function setAuthData(data: AuthData) {
  console.log('setAuthData called with token:', !!data.token);
  console.log('Data object:', data);
  try {
    localStorage.setItem('authData', JSON.stringify(data));
    console.log('localStorage.setItem executed');
    const verification = getAuthData();
    console.log('Verification result:', !!verification?.token);
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
  const authData = getAuthData();
  const headers = authData && authData.token ? { Authorization: `Bearer ${authData.token}` } : {};
  console.log('getAuthHeaders called, token exists:', !!authData?.token);
  return headers;
}
