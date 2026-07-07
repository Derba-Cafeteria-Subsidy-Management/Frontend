const ACCESS_TOKEN_KEY = 'cafeteria_access_token';
const REFRESH_TOKEN_KEY = 'cafeteria_refresh_token';
const USER_KEY = 'cafeteria_user';
const REMEMBER_ME_KEY = 'cafeteria_remember_me';

function getStorage(persistent: boolean): Storage {
  return persistent ? localStorage : sessionStorage;
}

function isRememberMeEnabled(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

export function setRememberMe(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    localStorage.removeItem(REMEMBER_ME_KEY);
  }
}

export function getAccessToken(): string | null {
  const token =
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    sessionStorage.getItem(ACCESS_TOKEN_KEY);

  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }

  return token;
}

export function getRefreshToken(): string | null {
  const token =
    localStorage.getItem(REFRESH_TOKEN_KEY) ||
    sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }

  return token;
}

export function setTokens(accessToken: string, refreshToken: string, rememberMe = true): void {
  if (!accessToken || accessToken === 'undefined') {
    throw new Error('Cannot store an invalid access token.');
  }

  setRememberMe(rememberMe);
  clearTokens();

  const storage = getStorage(rememberMe);
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setAccessToken(accessToken: string): void {
  const storage = getStorage(isRememberMeEnabled());
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearTokens(): void {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(USER_KEY);
  });
}

export function setStoredUser(userJson: string): void {
  const storage = getStorage(isRememberMeEnabled());
  storage.setItem(USER_KEY, userJson);
}

export function getStoredUser(): string | null {
  return (
    localStorage.getItem(USER_KEY) ||
    sessionStorage.getItem(USER_KEY)
  );
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
