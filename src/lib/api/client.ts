import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from '../auth/tokenStorage';
import { ApiError, AuthError, getErrorMessage } from './errors';
import { normalizeAccessToken, unwrapApiData } from './response';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthError();
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    clearTokens();
    throw new AuthError(getErrorMessage(response.status, body as { message?: string }));
  }

  const unwrapped = unwrapApiData<Record<string, unknown>>(body, response.status);
  const accessToken = normalizeAccessToken(unwrapped);

  setAccessToken(accessToken);
  return accessToken;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(fetchOptions.headers);
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await fetch(url, { ...fetchOptions, headers });

  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRefresh &&
    path !== '/api/auth/refresh-token' &&
    path !== '/api/auth/login'
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    try {
      const newToken = await (refreshPromise as Promise<string>);
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...fetchOptions, headers });
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      clearTokens();
      throw new AuthError();
    }
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(response.status, body as { message?: string }), response.status, body);
  }

  return unwrapApiData<T>(body, response.status);
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
