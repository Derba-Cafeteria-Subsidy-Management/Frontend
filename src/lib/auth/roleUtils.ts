import type { User } from '../../db/db';
import type { ApiRole, ApiStatus, AppRole, AppStatus } from './types';

/**
 * Map API role to App role
 */
export function mapApiRoleToAppRole(role: ApiRole): AppRole {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'CASHIER':
      return 'Cashier';
    default:
      return 'Cashier';
  }
}

/**
 * Map App role to API role
 */
export function mapAppRoleToApiRole(role: AppRole | 'Admin' | 'Cashier'): ApiRole {
  switch (role) {
    case 'Super Admin':
      return 'SUPER_ADMIN';
    case 'Admin':
      return 'ADMIN';
    case 'Cashier':
      return 'CASHIER';
    default:
      return 'CASHIER';
  }
}

/**
 * Map API status to App status
 */
export function mapApiStatusToAppStatus(status: ApiStatus): AppStatus {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'PENDING':
      return 'Pending';
    case 'INACTIVE':
    case 'SUSPENDED':
    default:
      return 'Inactive';
  }
}

/**
 * ✅ FIXED: Map API user to App user with all required fields
 * Added id and createdAt fields with fallback values
 */
export function mapApiUserToUser(apiUser: any): User {
  // If apiUser is not provided, return a default user
  if (!apiUser) {
    return {
      id: '',
      username: 'unknown',
      email: 'unknown@example.com',
      role: 'Cashier',
      status: 'Inactive',
      createdAt: new Date().toISOString(),
    };
  }

  // ✅ Ensure role and status are properly typed
  const role = apiUser.role as ApiRole;
  const status = apiUser.status as ApiStatus;

  return {
    id: apiUser.id || apiUser.userId || `user-${Date.now()}`,
    username: apiUser.username || apiUser.email?.split('@')[0] || 'unknown',
    email: apiUser.email || 'unknown@example.com',
    role: mapApiRoleToAppRole(role),
    status: mapApiStatusToAppStatus(status),
    lastLogin: apiUser.lastLogin,
    createdAt: apiUser.createdAt || new Date().toISOString(),
  };
}

/**
 * Get the dashboard path for a user role
 */
export function getDashboardPath(role: AppRole): string {
  switch (role) {
    case 'Super Admin':
      return '/super-admin/subsidy';
    case 'Admin':
      return '/admin';
    case 'Cashier':
    default:
      return '/cashier';
  }
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: User | null, role: AppRole): boolean {
  if (!user) return false;
  return user.role === role;
}

/**
 * Check if a user has one of the allowed roles
 */
export function hasAnyRole(user: User | null, roles: AppRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}