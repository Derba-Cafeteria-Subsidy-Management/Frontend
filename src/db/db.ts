import Dexie, { type Table } from 'dexie';

// Define Interfaces
export interface Employee {
  id: string; // EMP-00123
  name: string;
  department: string;
  status: 'Active' | 'Inactive';
  photo: string; // Base64 or placeholder URL
  fingerprintRegistered: boolean;
  fingerprintTemplate?: string;
}

export interface MenuItem {
  id?: number;
  name: string;
  price: number;
  isActive: boolean;
  effectiveDate: string;
}

export interface Transaction {
  id?: string; // TXN-xxxxx
  employeeId: string;
  employeeName: string;
  department: string;
  session: 'Breakfast' | 'Lunch' | 'Dinner';
  menuItemId: number;
  menuItemName: string;
  price: number;
  employeeShare: number;
  companyShare: number;
  cashierName: string;
  timestamp: Date;
  status: 'Complete' | 'Corrected';
  isSynced: boolean; // For offline mode
}

export interface CorrectionRequest {
  id?: string; // REQ-xxxxx
  transactionId: string;
  employeeName: string;
  session: 'Breakfast' | 'Lunch' | 'Dinner';
  originalItemName: string;
  originalPrice: number;
  requestedItemId: number;
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
  details: string; // JSON string
}

export interface SubsidyConfig {
  id: string; // 'current' or Date string for history
  employeePercent: number;
  companyPercent: number;
  effectiveDate: string;
  timestamp?: Date;
  updatedBy?: string;
  notes?: string;
}

export interface User {
  username: string;
  email: string;
  role: 'Admin' | 'Cashier' | 'Super Admin';
  status: 'Active' | 'Inactive' | 'Pending';
  lastLogin?: string;
  password?: string; // Mock authentication
  invitationToken?: string;
}

// Dexie Database Definition
class CafeteriaDatabase extends Dexie {
  employees!: Table<Employee, string>;
  menuItems!: Table<MenuItem, number>;
  transactions!: Table<Transaction, string>;
  correctionRequests!: Table<CorrectionRequest, string>;
  auditLogs!: Table<AuditLog, number>;
  subsidyConfig!: Table<SubsidyConfig, string>;
  users!: Table<User, string>;

  constructor() {
    super('CafeteriaDatabase');
    
    this.version(1).stores({
      employees: 'id, name, department, status, fingerprintRegistered',
      menuItems: '++id, name, price, isActive, effectiveDate',
      transactions: 'id, employeeId, employeeName, session, timestamp, status, isSynced',
      correctionRequests: 'id, transactionId, employeeName, session, status, cashierName, timestamp',
      auditLogs: '++id, timestamp, user, action, entity',
      subsidyConfig: 'id, effectiveDate',
      users: 'username, email, role, status'
    });
  }
}

export const db = new CafeteriaDatabase();

// Seed function to initialize data if empty
export async function seedDatabase() {
  const employeeCount = await db.employees.count();
  if (employeeCount > 0) {
    return; // DB already seeded
  }

  // 1. Seed Employees
  const initialEmployees: Employee[] = [
    {
      id: 'EMP-00123',
      name: 'John Doe',
      department: 'Engineering',
      status: 'Active',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: true,
      fingerprintTemplate: 'fingerprint_template_johndoe'
    },
    {
      id: 'EMP-00124',
      name: 'Jane Smith',
      department: 'Human Resources',
      status: 'Active',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: true,
      fingerprintTemplate: 'fingerprint_template_janesmith'
    },
    {
      id: 'EMP-00125',
      name: 'Michael Kebede',
      department: 'Finance',
      status: 'Active',
      photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: true,
      fingerprintTemplate: 'fingerprint_template_michael'
    },
    {
      id: 'EMP-00126',
      name: 'Sara Almaz',
      department: 'Operations',
      status: 'Active',
      photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: false
    },
    {
      id: 'EMP-00127',
      name: 'Abebe Bikila',
      department: 'Security',
      status: 'Inactive',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: true,
      fingerprintTemplate: 'fingerprint_template_abebe'
    },
    {
      id: 'EMP-00128',
      name: 'Helen Gidey',
      department: 'Marketing',
      status: 'Active',
      photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
      fingerprintRegistered: true,
      fingerprintTemplate: 'fingerprint_template_helen'
    }
  ];
  await db.employees.bulkPut(initialEmployees);

  // 2. Seed Menu Items
  const initialMenuItems: MenuItem[] = [
    // Breakfast
    { name: 'Ful with Egg', price: 100.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Special Firfir', price: 80.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Spiced Tea', price: 15.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Omelet', price: 75.00, isActive: false, effectiveDate: '2026-06-01' }, // Inactive

    // Lunch
    { name: 'Shiro Wot', price: 90.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Special Beyaynetu', price: 120.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Beef Tibs', price: 200.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Chicken Cutlet', price: 180.00, isActive: false, effectiveDate: '2026-06-01' }, // Inactive

    // Dinner
    { name: 'Tagliatelle Pasta',  price: 110.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Rice with Veggies', price: 95.00, isActive: true, effectiveDate: '2026-06-01' },
    { name: 'Chicken Soup', price: 130.00, isActive: true, effectiveDate: '2026-06-01' }
  ];
  await db.menuItems.bulkPut(initialMenuItems);

  // 3. Seed Users
  const initialUsers: User[] = [
    { username: 'cashier', email: 'cashier@company.com', role: 'Cashier', status: 'Active', password: 'cashier123', lastLogin: '2026-06-25 08:00 AM' },
    { username: 'admin', email: 'admin@company.com', role: 'Admin', status: 'Active', password: 'admin123', lastLogin: '2026-06-25 08:15 AM' },
    { username: 'superadmin', email: 'superadmin@company.com', role: 'Super Admin', status: 'Active', password: 'superadmin123', lastLogin: '2026-06-25 08:30 AM' },
    { username: 'cashier_inactive', email: 'cashier_old@company.com', role: 'Cashier', status: 'Inactive', password: 'cashier123' }
  ];
  await db.users.bulkPut(initialUsers);

  // 4. Seed Subsidy Configuration
  const initialConfig: SubsidyConfig[] = [
    { id: 'current', employeePercent: 40, companyPercent: 60, effectiveDate: '2026-06-01' },
    { id: 'history_1', employeePercent: 50, companyPercent: 50, effectiveDate: '2025-01-01' }
  ];
  await db.subsidyConfig.bulkPut(initialConfig);

  // 5. Seed Transactions (some historical, some today)
  const today = new Date();
  
  // Helper to create date relative to today
  const getRelativeDate = (daysAgo: number, hours: number, minutes: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const initialTransactions: Transaction[] = [
    {
      id: 'TXN-00001',
      employeeId: 'EMP-00123',
      employeeName: 'John Doe',
      department: 'Engineering',
      session: 'Breakfast',
      menuItemId: 1, // Ful
      menuItemName: 'Ful with Egg',
      price: 100.00,
      employeeShare: 40.00,
      companyShare: 60.00,
      cashierName: 'cashier',
      timestamp: getRelativeDate(0, 8, 30), // Today 8:30 AM
      status: 'Complete',
      isSynced: true
    },
    {
      id: 'TXN-00002',
      employeeId: 'EMP-00124',
      employeeName: 'Jane Smith',
      department: 'Human Resources',
      session: 'Breakfast',
      menuItemId: 2, // Firfir
      menuItemName: 'Special Firfir',
      price: 80.00,
      employeeShare: 32.00,
      companyShare: 48.00,
      cashierName: 'cashier',
      timestamp: getRelativeDate(0, 8, 45), // Today 8:45 AM
      status: 'Complete',
      isSynced: true
    },
    // Yesterday transactions
    {
      id: 'TXN-00003',
      employeeId: 'EMP-00123',
      employeeName: 'John Doe',
      department: 'Engineering',
      session: 'Lunch',
      menuItemId: 6, // Beyaynetu
      menuItemName: 'Special Beyaynetu',
      price: 120.00,
      employeeShare: 48.00,
      companyShare: 72.00,
      cashierName: 'cashier',
      timestamp: getRelativeDate(1, 12, 30),
      status: 'Complete',
      isSynced: true
    },
    {
      id: 'TXN-00004',
      employeeId: 'EMP-00125',
      employeeName: 'Michael Kebede',
      department: 'Finance',
      session: 'Lunch',
      menuItemId: 7, // Beef Tibs
      menuItemName: 'Beef Tibs',
      price: 200.00,
      employeeShare: 80.00,
      companyShare: 120.00,
      cashierName: 'cashier',
      timestamp: getRelativeDate(1, 13, 10),
      status: 'Complete',
      isSynced: true
    },
    {
      id: 'TXN-00005',
      employeeId: 'EMP-00128',
      employeeName: 'Helen Gidey',
      department: 'Marketing',
      session: 'Dinner',
      menuItemId: 9, // Rice
      menuItemName: 'Rice with Veggies',
      price: 95.00,
      employeeShare: 38.00,
      companyShare: 57.00,
      cashierName: 'cashier',
      timestamp: getRelativeDate(2, 19, 40),
      status: 'Complete',
      isSynced: true
    }
  ];
  await db.transactions.bulkPut(initialTransactions);

  // 6. Seed Correction Requests
  const initialCorrectionRequests: CorrectionRequest[] = [
    {
      id: 'REQ-00001',
      transactionId: 'TXN-00003',
      employeeName: 'John Doe',
      session: 'Lunch',
      originalItemName: 'Special Beyaynetu',
      originalPrice: 120.00,
      requestedItemId: 7, // Beef Tibs
      requestedItemName: 'Beef Tibs',
      requestedPrice: 200.00,
      reason: 'Cashier selected Beyaynetu instead of Beef Tibs by mistake.',
      status: 'Pending',
      cashierName: 'cashier',
      timestamp: getRelativeDate(0, 9, 0) // Today 9:00 AM
    },
    {
      id: 'REQ-00002',
      transactionId: 'TXN-00005',
      employeeName: 'Helen Gidey',
      session: 'Dinner',
      originalItemName: 'Rice with Veggies',
      originalPrice: 95.00,
      requestedItemId: 8, // Pasta
      requestedItemName: 'Tagliatelle Pasta',
      requestedPrice: 110.00,
      reason: 'Employee ordered Pasta, selected Rice on screen.',
      status: 'Approved',
      cashierName: 'cashier',
      timestamp: getRelativeDate(1, 9, 30) // Submitted yesterday
    }
  ];
  await db.correctionRequests.bulkPut(initialCorrectionRequests);

  // 7. Seed Audit Logs
  const initialAuditLogs: AuditLog[] = [
    {
      timestamp: getRelativeDate(3, 9, 0),
      user: 'superadmin',
      action: 'Create User',
      entity: 'User',
      entityId: 'cashier',
      details: JSON.stringify({ role: 'Cashier', status: 'Active', email: 'cashier@company.com' })
    },
    {
      timestamp: getRelativeDate(2, 10, 0),
      user: 'admin',
      action: 'Update Menu Price',
      entity: 'MenuItem',
      entityId: '1',
      details: JSON.stringify({ item: 'Ful with Egg', oldPrice: 90.00, newPrice: 100.00 })
    },
    {
      timestamp: getRelativeDate(1, 14, 0),
      user: 'admin',
      action: 'Approve Correction Request',
      entity: 'CorrectionRequest',
      entityId: 'REQ-00002',
      details: JSON.stringify({ originalTxnId: 'TXN-00005', correctedItem: 'Tagliatelle Pasta' })
    }
  ];
  await db.auditLogs.bulkPut(initialAuditLogs);
}
