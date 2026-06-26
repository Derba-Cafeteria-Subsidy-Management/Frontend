import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, seedDatabase, type Employee, type MenuItem, type Transaction, type User } from '../db/db';
import toast from 'react-hot-toast';

// Types for Cashier Steps
export type CashierStep = 1 | 2 | 3 | 4 | 5;

interface AppContextType {
  currentUser: User | null;
  login: (username: string, role: 'Admin' | 'Cashier' | 'Super Admin') => Promise<boolean>;
  logout: () => void;
  isOffline: boolean;
  setOfflineMode: (offline: boolean) => void;
  syncOfflineTransactions: () => Promise<void>;
  
  // Cashier Flow State
  cashierStep: CashierStep;
  selectedEmployee: Employee | null;
  selectedSession: 'Breakfast' | 'Lunch' | 'Dinner' | null;
  selectedMenu: MenuItem | null;
  lastTransactionId: string | null;
  
  setEmployee: (emp: Employee | null) => void;
  setSession: (sess: 'Breakfast' | 'Lunch' | 'Dinner' | null) => void;
  setMenu: (menu: MenuItem | null) => void;
  goToStep: (step: CashierStep) => void;
  resetCashierFlow: () => void;
  submitTransaction: () => Promise<boolean>;
  
  dbInitialized: boolean;
  triggerDbReSeed: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  
  // Cashier Registration Flow State
  const [cashierStep, setCashierStep] = useState<CashierStep>(1);
  const [selectedEmployee, setSelectedEmployeeState] = useState<Employee | null>(null);
  const [selectedSession, setSelectedSessionState] = useState<'Breakfast' | 'Lunch' | 'Dinner' | null>(null);
  const [selectedMenu, setSelectedMenuState] = useState<MenuItem | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  // Initialize DB and Auth Session
  useEffect(() => {
    const init = async () => {
      try {
        await seedDatabase();
        setDbInitialized(true);
        
        // Restore user session if any
        const savedUser = localStorage.getItem('cafeteria_user');
        if (savedUser) {
          setCurrentUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error('Failed to initialize database:', err);
      }
    };
    init();
  }, []);

  const triggerDbReSeed = async () => {
    setDbInitialized(false);
    await db.delete();
    await db.open();
    await seedDatabase();
    setDbInitialized(true);
    toast.success('Database reset and re-seeded successfully!');
  };

  // Login
  const login = async (username: string, role: 'Admin' | 'Cashier' | 'Super Admin'): Promise<boolean> => {
    try {
      const user = await db.users.get(username);
      if (user && user.status === 'Active') {
        const updatedUser = { ...user, lastLogin: new Date().toLocaleString() };
        await db.users.put(updatedUser);
        setCurrentUser(updatedUser);
        localStorage.setItem('cafeteria_user', JSON.stringify(updatedUser));
        
        // Log action
        await db.auditLogs.add({
          timestamp: new Date(),
          user: username,
          action: 'Login',
          entity: 'User',
          entityId: username,
          details: JSON.stringify({ role })
        });
        
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Logout
  const logout = () => {
    if (currentUser) {
      db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser.username,
        action: 'Logout',
        entity: 'User',
        entityId: currentUser.username,
        details: '{}'
      }).catch(console.error);
    }
    setCurrentUser(null);
    localStorage.removeItem('cafeteria_user');
    resetCashierFlow();
  };

  // Offline Simulator Toggle
  const setOfflineMode = (offline: boolean) => {
    setIsOffline(offline);
    if (offline) {
      toast('Offline Mode Activated. Transactions will queue in browser storage.', {
        icon: '⚠️',
        style: {
          border: '1px solid #DC2626',
          padding: '16px',
          color: '#DC2626',
          backgroundColor: '#FFF'
        }
      });
    } else {
      toast('Simulating reconnection...', { icon: '🔄' });
      // Trigger sync
      setTimeout(() => {
        syncOfflineTransactions();
      }, 1000);
    }
  };

  // Sync Offline Transactions
  const syncOfflineTransactions = async () => {
    try {
      const unsyncedFiltered = await db.transactions.filter(t => !t.isSynced).toArray();
      
      if (unsyncedFiltered.length > 0) {
        toast.loading(`Back online. Syncing ${unsyncedFiltered.length} transactions...`, { id: 'sync-toast' });
        
        // Simulate background sync API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        for (const txn of unsyncedFiltered) {
          if (txn.id) {
            await db.transactions.update(txn.id, { isSynced: true });
            
            // Add audit log
            await db.auditLogs.add({
              timestamp: new Date(),
              user: currentUser?.username || 'system',
              action: 'Sync Transaction',
              entity: 'Transaction',
              entityId: txn.id,
              details: JSON.stringify({ employeeId: txn.employeeId, total: txn.price })
            });
          }
        }
        
        toast.success(`Sync complete. ${unsyncedFiltered.length} transactions uploaded!`, { id: 'sync-toast' });
      } else {
        toast.success('Connection restored. System is online.', { id: 'sync-toast' });
      }
    } catch (e) {
      console.error('Error syncing:', e);
      toast.error('Sync failed. Will retry later.');
    }
  };

  // Cashier State Helpers
  const setEmployee = (emp: Employee | null) => {
    setSelectedEmployeeState(emp);
  };

  const setSession = (sess: 'Breakfast' | 'Lunch' | 'Dinner' | null) => {
    setSelectedSessionState(sess);
  };

  const setMenu = (menu: MenuItem | null) => {
    setSelectedMenuState(menu);
  };

  const goToStep = (step: CashierStep) => {
    setCashierStep(step);
  };

  const resetCashierFlow = () => {
    setSelectedEmployeeState(null);
    setSelectedSessionState(null);
    setSelectedMenuState(null);
    setLastTransactionId(null);
    setCashierStep(1);
  };

  // Submit Transaction (Step 4 -> Step 5)
  const submitTransaction = async (): Promise<boolean> => {
    if (!selectedEmployee || !selectedSession || !selectedMenu) {
      toast.error('Missing transaction details.');
      return false;
    }

    try {
      // 1. Double check session conflict for the day in the frontend DB (Business Rules)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const existing = await db.transactions
        .where('employeeId')
        .equals(selectedEmployee.id)
        .and(t => t.session === selectedSession && t.timestamp >= startOfDay && t.timestamp <= endOfDay)
        .toArray();

      if (existing.length > 0) {
        toast.error(`Employee has already consumed ${selectedSession} today!`, {
          duration: 4000,
          style: { border: '1px solid #DC2626', color: '#DC2626' }
        });
        return false;
      }

      // Get current split configuration
      const currentConfig = await db.subsidyConfig.get('current');
      const employeePercent = currentConfig ? currentConfig.employeePercent : 40;
      const companyPercent = currentConfig ? currentConfig.companyPercent : 60;
      
      const empShare = parseFloat(((selectedMenu.price * employeePercent) / 100).toFixed(2));
      const compShare = parseFloat(((selectedMenu.price * companyPercent) / 100).toFixed(2));

      const txnId = `TXN-${Math.floor(10000 + Math.random() * 90000)}`;

      const transaction: Transaction = {
        id: txnId,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        department: selectedEmployee.department,
        session: selectedSession,
        menuItemId: selectedMenu.id!,
        menuItemName: selectedMenu.name,
        price: selectedMenu.price,
        employeeShare: empShare,
        companyShare: compShare,
        cashierName: currentUser?.username || 'cashier',
        timestamp: new Date(),
        status: 'Complete',
        isSynced: !isOffline
      };

      await db.transactions.add(transaction);
      setLastTransactionId(txnId);

      // Create Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'cashier',
        action: 'Create Transaction',
        entity: 'Transaction',
        entityId: txnId,
        details: JSON.stringify({ 
          employeeId: selectedEmployee.id, 
          session: selectedSession,
          price: selectedMenu.price,
          offline: isOffline
        })
      });

      if (isOffline) {
        toast.success('Saved locally (Offline Mode)');
      } else {
        toast.success('Transaction recorded successfully!');
      }

      setCashierStep(5);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit transaction.');
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      login,
      logout,
      isOffline,
      setOfflineMode,
      syncOfflineTransactions,
      cashierStep,
      selectedEmployee,
      selectedSession,
      selectedMenu,
      lastTransactionId,
      setEmployee,
      setSession,
      setMenu,
      goToStep,
      resetCashierFlow,
      submitTransaction,
      dbInitialized,
      triggerDbReSeed
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
