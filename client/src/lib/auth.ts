import { User, Company } from '@shared/schema';

interface AuthData {
  user: User;
  token: string;
  company: Company;
}

export function setAuthData(data: AuthData) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  localStorage.setItem('company', JSON.stringify(data.company));
}

export function getAuthData(): AuthData | null {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const companyStr = localStorage.getItem('company');

  if (!token || !userStr || !companyStr) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userStr),
      company: JSON.parse(companyStr),
    };
  } catch {
    return null;
  }
}

export function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('company');
}

export function getAuthHeaders() {
  const authData = getAuthData();
  return authData ? { Authorization: `Bearer ${authData.token}` } : {};
}
