export type ApiRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER';
export type ApiStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';

export type AppRole = 'Admin' | 'Cashier' | 'Super Admin';
export type AppStatus = 'Active' | 'Inactive' | 'Pending';

// types.ts
export interface ApiUser {
  id: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string;
  createdAt: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: ApiUser;
    accessToken: string;
    refreshToken: string;
  };
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}