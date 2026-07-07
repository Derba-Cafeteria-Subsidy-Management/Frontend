import { ApiError, getErrorMessage } from './errors';

export interface ApiEnvelope<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
}

export function unwrapApiData<T>(body: unknown, status = 200): T {
  if (!body || typeof body !== 'object') {
    return body as T;
  }

  const envelope = body as ApiEnvelope<T>;

  if (envelope.success === false) {
    throw new ApiError(getErrorMessage(status, { message: envelope.message }), status, body);
  }

  if (envelope.data !== undefined && envelope.data !== null) {
    return envelope.data as T;
  }

  return body as T;
}

export function normalizeAccessToken(payload: unknown): string {
  const data = payload as Record<string, unknown>;
  const token =
    (data.accessToken as string | undefined) ||
    (data.access_token as string | undefined) ||
    (data.token as string | undefined);

  if (!token || token === 'undefined' || token === 'null') {
    throw new ApiError('Authentication response did not include an access token.', 500, payload);
  }

  return token;
}

export function normalizeRefreshToken(payload: unknown): string {
  const data = payload as Record<string, unknown>;
  const token =
    (data.refreshToken as string | undefined) ||
    (data.refresh_token as string | undefined);

  if (!token || token === 'undefined' || token === 'null') {
    throw new ApiError('Authentication response did not include a refresh token.', 500, payload);
  }

  return token;
}

export function normalizeAuthTokens(payload: unknown): { accessToken: string; refreshToken: string } {
  const data = unwrapApiData<Record<string, unknown>>(payload);

  return {
    accessToken: normalizeAccessToken(data),
    refreshToken: normalizeRefreshToken(data),
  };
}
