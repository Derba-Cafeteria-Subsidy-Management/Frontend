import Dexie, { type Table } from 'dexie';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: 'ACTIVE' | 'INACTIVE';
  photo: string | null;
  fingerprintId?: string | null;
  mealsToday?: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  createdAt?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
  effectiveDate: string;
  mealtype?: 'BREAKFAST' | 'LUNCH' | 'DINNER';
}

export interface Transaction {
  id: string;
  employeeId: string;
  employeeNumber?: string;
  employeeName: string;
  session: 'Breakfast' | 'Lunch' | 'Dinner';
  menuItemId: string;
  menuItemName: string;
  price: number;
  employeeShare: number;
  companyShare: number;
  cashierName: string;
  timestamp: Date;
  status: 'Complete' | 'Corrected';
  isSynced: boolean;
  createdAt?: string;
}

export interface CorrectionRequest {
  id?: string;
  transactionId: string;
  employeeName: string;
  session: 'Breakfast' | 'Lunch' | 'Dinner';
  originalItemName: string;
  originalPrice: number;
  requestedItemId: string;
  requestedItemName: string;
  requestedPrice: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  cashierName: string;
  timestamp: Date;
  rejectionReason?: string;
}

export interface AuditLog {
  id?: number;
  timestamp: Date;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

export interface SubsidyConfig {
  id: string;
  employeePercent: number;
  companyPercent: number;
  effectiveDate: string;
  timestamp?: Date;
  updatedBy?: string;
  notes?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'Cashier' | 'Super Admin';
  status: 'Active' | 'Inactive' | 'Pending';
  lastLogin?: string;
  password?: string;
  invitationToken?: string;
  createdAt: string;
}

// ============================================================================
// DEXIE DATABASE DEFINITION
// ============================================================================

class CafeteriaDatabase extends Dexie {
  employees!: Table<Employee, string>;
  menuItems!: Table<MenuItem, string>;
  transactions!: Table<Transaction, string>;
  correctionRequests!: Table<CorrectionRequest, string>;
  auditLogs!: Table<AuditLog, number>;
  subsidyConfig!: Table<SubsidyConfig, string>;
  users!: Table<User, string>;

  constructor() {
    super('CafeteriaDatabase');

    // Version 1 - Original schema (kept for backward compatibility)
    this.version(1).stores({
      employees: 'id, employeeNumber, fullName, status, fingerprintId',
      menuItems: 'id, name, description, price, isActive, effectiveDate, mealtype',
      transactions: 'id, employeeId, employeeName, session, timestamp, status, isSynced',
      correctionRequests: 'id, transactionId, employeeName, session, status, cashierName, timestamp',
      auditLogs: '++id, timestamp, user, action, entity',
      subsidyConfig: 'id, effectiveDate',
      users: 'id, username, email, role, status, createdAt',
    });
  }

  /**
   * Reset database in case of schema conflicts
   */
  async resetDatabase() {
    try {
      await this.delete();
      await this.open();
      console.log('✅ Database reset successfully');
      // Re-seed if needed
      await seedDatabase();
    } catch (error) {
      console.error('Failed to reset database:', error);
    }
  }
}

export const db = new CafeteriaDatabase();

// ============================================================================
// DATABASE INITIALIZATION WITH ERROR HANDLING
// ============================================================================

export async function initializeDatabase() {
  try {
    await db.open();
    console.log('✅ Main database ready');
    return true;
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error);
    
    // Check if it's a schema upgrade error
    if (error.name === 'DatabaseClosedError' || 
        error.message?.includes('UpgradeError') ||
        error.message?.includes('changing primary key')) {
      console.warn('⚠️ Schema mismatch detected, resetting database...');
      
      // Reset the database
      await db.delete();
      await db.open();
      console.log('✅ Database reset and reinitialized');
      
      // Re-seed the database
      await seedDatabase();
      return true;
    }
    
    return false;
  }
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

const getRelativeDate = (daysAgo: number, hours: number, minutes: number): Date => {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

export async function seedDatabase() {
  const employeeCount = await db.employees.count();
  if (employeeCount > 0) {
    console.log('📊 Database already contains data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database...');

  // --------------------------------------------------------------------------
  // 1. Seed Employees
  // --------------------------------------------------------------------------
  const initialEmployees: Employee[] = [
    {
      id: '9c5f9206-586c-4a0c-83f1-32bf4cd2d132',
      employeeNumber: 'EMP-1',
      fullName: 'Mahlet Solomon Ambaye',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintId: 'FP-001',
      mealsToday: { breakfast: false, lunch: false, dinner: false },
    },
    {
      id: 'b8f8a4c5-1f5d-4277-8fa5-b1a4cf93cb06',
      employeeNumber: 'EMP-2',
      fullName: 'Mahlet Belay Mulugeta',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintId: 'FP-002',
      mealsToday: { breakfast: false, lunch: false, dinner: false },
    },
    {
      id: '994e4419-3a50-4e4c-9146-17606851c6bb',
      employeeNumber: 'EMP-3',
      fullName: 'Mahlet Solomon Legesse',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintId: 'FP-003',
      mealsToday: { breakfast: false, lunch: false, dinner: false },
    },
  ];
  await db.employees.bulkPut(initialEmployees);
  console.log(`  ✅ Seeded ${initialEmployees.length} employees`);

  // --------------------------------------------------------------------------
  // 2. Seed Menu Items
  // --------------------------------------------------------------------------
  const initialMenuItems: MenuItem[] = [
    // Breakfast
    {
      id: '23973cc1-68ee-47ad-bcd5-5a621db67964',
      name: 'Gambas al Ajillo',
      price: 13.51,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: '7d599131-da59-498e-8cbf-56578696d968',
      name: 'Rendang',
      price: 17.50,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: 'a11a65b4-0056-416f-af53-07a6aedd9831',
      name: 'Waffles',
      price: 9.20,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: 'f0d7b1ef-88de-45ed-9108-09e576ceccac',
      name: 'Teriyaki Bowl',
      price: 13.56,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: 'fc23cb6c-43d6-4658-81e1-b34a6640acd9',
      name: 'Green Curry',
      price: 13.51,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: '73bb271a-d4d7-4524-aa32-3c415c3d0aa1',
      name: 'Quiche Lorraine',
      price: 4.55,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: 'eadbc838-9525-4404-ba85-52c278e74831',
      name: 'Mac and Cheese',
      price: 7.54,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    {
      id: 'b8482017-e70d-437e-aacd-2ec9eeee7714',
      name: 'Bibimbap',
      price: 15.08,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'BREAKFAST',
    },
    // Lunch
    {
      id: '288a2cdb-59f2-47ab-8931-ad981162708b',
      name: 'Miser Wot',
      price: 8.99,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'LUNCH',
    },
    {
      id: '3a9eaec7-0a5c-4746-945b-975bc4407ada',
      name: 'Shiro Wot',
      price: 7.99,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'LUNCH',
    },
    {
      id: 'b8482017-e70d-437e-aacd-2ec9eeee7714',
      name: 'Bibimbap',
      price: 15.08,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'LUNCH',
    },
    // Dinner
    {
      id: 'f0d7b1ef-88de-45ed-9108-09e576ceccac',
      name: 'Teriyaki Bowl',
      price: 13.56,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'DINNER',
    },
    {
      id: '23973cc1-68ee-47ad-bcd5-5a621db67964',
      name: 'Gambas al Ajillo',
      price: 13.51,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'DINNER',
    },
    {
      id: '7d599131-da59-498e-8cbf-56578696d968',
      name: 'Rendang',
      price: 17.50,
      isActive: true,
      effectiveDate: '2026-06-01',
      mealtype: 'DINNER',
    },
  ];
  await db.menuItems.bulkPut(initialMenuItems);
  console.log(`  ✅ Seeded ${initialMenuItems.length} menu items`);

  // --------------------------------------------------------------------------
  // 3. Seed Subsidy Configuration
  // --------------------------------------------------------------------------
  const initialConfig: SubsidyConfig[] = [
    {
      id: 'current',
      employeePercent: 40,
      companyPercent: 60,
      effectiveDate: '2026-06-01',
    },
    {
      id: 'history_1',
      employeePercent: 50,
      companyPercent: 50,
      effectiveDate: '2025-01-01',
    },
  ];
  await db.subsidyConfig.bulkPut(initialConfig);
  console.log(`  ✅ Seeded ${initialConfig.length} subsidy configs`);

  // --------------------------------------------------------------------------
  // 4. Seed Correction Requests
  // --------------------------------------------------------------------------
  const initialCorrectionRequests: CorrectionRequest[] = [
    {
      id: 'REQ-00001',
      transactionId: 'TXN-00003',
      employeeName: 'John Doe',
      session: 'Lunch',
      originalItemName: 'Special Beyaynetu',
      originalPrice: 120.00,
      requestedItemId: '7d599131-da59-498e-8cbf-56578696d968',
      requestedItemName: 'Beef Tibs',
      requestedPrice: 200.00,
      reason: 'Cashier selected Beyaynetu instead of Beef Tibs by mistake.',
      status: 'Pending',
      cashierName: 'cashier',
      timestamp: getRelativeDate(0, 9, 0),
    },
    {
      id: 'REQ-00002',
      transactionId: 'TXN-00005',
      employeeName: 'Helen Gidey',
      session: 'Dinner',
      originalItemName: 'Rice with Veggies',
      originalPrice: 95.00,
      requestedItemId: '23973cc1-68ee-47ad-bcd5-5a621db67964',
      requestedItemName: 'Tagliatelle Pasta',
      requestedPrice: 110.00,
      reason: 'Employee ordered Pasta, selected Rice on screen.',
      status: 'Approved',
      cashierName: 'cashier',
      timestamp: getRelativeDate(1, 9, 30),
    },
  ];
  await db.correctionRequests.bulkPut(initialCorrectionRequests);
  console.log(`  ✅ Seeded ${initialCorrectionRequests.length} correction requests`);

  // --------------------------------------------------------------------------
  // 5. Seed Audit Logs
  // --------------------------------------------------------------------------
  const initialAuditLogs: AuditLog[] = [
    {
      timestamp: getRelativeDate(3, 9, 0),
      user: 'superadmin',
      action: 'Create User',
      entity: 'User',
      entityId: 'cashier',
      details: JSON.stringify({ role: 'Cashier', status: 'Active', email: 'cashier@company.com' }),
    },
    {
      timestamp: getRelativeDate(2, 10, 0),
      user: 'admin',
      action: 'Update Menu Price',
      entity: 'MenuItem',
      entityId: '23973cc1-68ee-47ad-bcd5-5a621db67964',
      details: JSON.stringify({ item: 'Gambas al Ajillo', oldPrice: 12.00, newPrice: 13.51 }),
    },
    {
      timestamp: getRelativeDate(1, 14, 0),
      user: 'admin',
      action: 'Approve Correction Request',
      entity: 'CorrectionRequest',
      entityId: 'REQ-00002',
      details: JSON.stringify({ originalTxnId: 'TXN-00005', correctedItem: 'Tagliatelle Pasta' }),
    },
  ];
  await db.auditLogs.bulkPut(initialAuditLogs);
  console.log(`  ✅ Seeded ${initialAuditLogs.length} audit logs`);

  console.log('✅ Database seeding complete!');
}