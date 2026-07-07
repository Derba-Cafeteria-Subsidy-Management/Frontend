export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class AuthError extends Error {
  constructor(message = 'Your session has expired. Please login again.') {
    super(message);
    this.name = 'AuthError';
  }
}

interface ErrorBody {
  message?: string;
  error?: string;
}

export function getErrorMessage(status: number, body?: ErrorBody): string {
  if (body?.message) return body.message;
  if (body?.error) return body.error;

  switch (status) {
    case 400:
      return 'Please check your input and try again';
    case 401:
      return 'Your session has expired. Please login again.';
    case 403:
      return "You don't have permission to perform this action";
    case 404:
      return 'User not found';
    case 409:
      return 'This email is already registered or has a pending invitation';
    case 429:
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again later.';
  }
}
