import type { User } from '../../db/db';
import type { ApiRole, ApiStatus, ApiUser, AppRole, AppStatus } from './types';

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

export function mapApiUserToUser(apiUser: ApiUser): User {
  return {
    username: apiUser.email.split('@')[0] || apiUser.email,
    email: apiUser.email,
    role: mapApiRoleToAppRole(apiUser.role),
    status: mapApiStatusToAppStatus(apiUser.status),
    lastLogin: apiUser.lastLogin,
  };
}

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
