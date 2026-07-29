export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'SUSPENDED';
export type MealSession = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';
export type AudienceType = 'EMPLOYEE' | 'GUEST' | 'ALL';

export interface MealSessionData {
  session: MealSession;
  mealConsumed: number;
  drinkConsumed: number;
  mealAvailable: boolean;
  drinkAvailable: boolean;
  completed: boolean;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  department?: string;
  status: 'ACTIVE' | 'INACTIVE';
  photo?: string;
  fingerprintId?: string;
  subsidyType?: 'NORMAL' | 'SPECIAL' | 'FULL_COMPANY';
  employeeType?: 'NORMAL' | 'SHIFT';
  groupId?: string;
  mealsToday?: MealSessionData[] | { breakfast: boolean; lunch: boolean; dinner: boolean };
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  mealtype: MealSession;
  currentPrice: number;
  active: boolean;
  description?: string;
  audience?: AudienceType;
}

export interface Transaction {
  id: string;
  employeeId: string;
  employeeNumber?: string;
  fullName: string;
  mealSession: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  menuItem: string;
  menuPrice: number;
  employeeShare: number;
  companyShare: number;
  cashierId: string;
  transactionDate: string;
  createdAt: string;
  correctionStatus?: 'PENDING_CORRECTION' | null;
}

export interface SubsidyConfig {
  id: string;
  employeePercent: number;
  companyPercent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes?: string;
  updatedBy?: string;
}

// In your types/api.ts file, update the CorrectionRequest type:

export interface CorrectionRequest {
  id: string;
  cashierName: string;
  transactionId: string;
  employee: string;
  oldValue: {
    menuPrice: number;
    menuItemId: string;
    companyShare: number;
    menuItemName: string;
    employeeShare: number;
  };
  newValue: {
    menuPrice: number;
    menuItemId: string;
    companyShare: number;
    menuItemName: string;
    employeeShare: number;
  };
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: UserRole;
  } | null;
}

// Common API Response envelope
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

export interface DashboardSummary {
  todayMealsCount: number;
  pendingCorrectionsCount: number;
  activeMenuItemsCount: number;
}

// Full user record returned by GET /api/users (Super Admin view)
export interface UserWithDetails extends User {
  username?: string;
  invitedAt?: string | null;
  invitedBy?: string | null;
}
