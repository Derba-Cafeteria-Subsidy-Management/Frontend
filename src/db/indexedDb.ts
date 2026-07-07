import Dexie, { type Table } from 'dexie';

export interface OfflineEmployee {
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
}

export interface QueuedTransaction {
  localId: string;
  employeeId: string;
  mealSession: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  menuItemId: string;
  fingerprintId?: string | null;
  offlineAt: string;
}

class CafeteriaOfflineDatabase extends Dexie {
  offlineEmployees!: Table<OfflineEmployee, string>;
  queuedTransactions!: Table<QueuedTransaction, string>;

  constructor() {
    super('CafeteriaOfflineDatabase');
    this.version(1).stores({
      offlineEmployees: 'id, employeeNumber, fullName, status, fingerprintId',
      queuedTransactions: 'localId, employeeId, mealSession, menuItemId, offlineAt',
    });
  }
}

export const offlineDb = new CafeteriaOfflineDatabase();
export default offlineDb;
