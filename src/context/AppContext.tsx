import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../client/axios';
import { offlineDb, type OfflineEmployee } from '../db/indexedDb';
import { db, initializeDatabase } from '../db/db'; // ✅ Import main database
import toast from 'react-hot-toast';
import { clearTokens, getAccessToken, setTokens } from '../lib/auth/tokenStorage';
import type { Employee, MenuItem, User } from '../types/api';

export type CashierStep = 1 | 2 | 3 | 4 | 5 | 6;

interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

interface AppContextType {
  currentUser: User | null;
  authLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  isOffline: boolean;
  setOfflineMode: (offline: boolean) => void;
  syncOfflineTransactions: () => Promise<void>;

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
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [dbInitialized, setDbInitialized] = useState<boolean>(false); // ✅ Changed to track actual initialization

  const [cashierStep, setCashierStep] = useState<CashierStep>(1);
  const [selectedEmployee, setSelectedEmployeeState] = useState<Employee | null>(null);
  const [selectedSession, setSelectedSessionState] = useState<'Breakfast' | 'Lunch' | 'Dinner' | null>(null);
  const [selectedMenu, setSelectedMenuState] = useState<MenuItem | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  // ✅ Add database initialization
  useEffect(() => {
    const initDatabases = async () => {
      try {
        console.log('🔄 Initializing databases...');
        
        // Initialize main database with error handling
        try {
          await initializeDatabase();
          console.log('✅ Main database initialized');
        } catch (error: any) {
          console.warn('Main database initialization error:', error);
          
          if (error.name === 'DatabaseClosedError' || 
              error.message?.includes('UpgradeError') ||
              error.message?.includes('changing primary key')) {
            console.log('⚠️ Schema mismatch detected, resetting main database...');
            await indexedDB.deleteDatabase('CafeteriaDatabase');
            await db.open();
            console.log('✅ Main database recreated');
          } else {
            throw error;
          }
        }
        
        // Initialize offline database with error handling
        try {
          await offlineDb.open();
          console.log('✅ Offline database initialized');
        } catch (error: any) {
          console.warn('Offline database initialization error:', error);
          
          if (error.name === 'DatabaseClosedError' || 
              error.message?.includes('UpgradeError') ||
              error.message?.includes('changing primary key')) {
            console.log('⚠️ Schema mismatch detected, resetting offline database...');
            await indexedDB.deleteDatabase('CafeteriaOfflineDatabase');
            await offlineDb.open();
            console.log('✅ Offline database recreated');
          } else {
            // Non-critical error, offline features might not work but app can continue
            console.error('Offline database error (non-critical):', error);
          }
        }
        
        setDbInitialized(true);
        console.log('✅ All databases ready');
        
      } catch (error) {
        console.error('❌ Critical database initialization failed:', error);
        
        // Show user-friendly error
        toast.error(
          'Database initialization failed. Please clear your browser data and refresh.',
          { duration: 6000 }
        );
        
        // Attempt emergency reset
        try {
          await indexedDB.deleteDatabase('CafeteriaDatabase');
          await indexedDB.deleteDatabase('CafeteriaOfflineDatabase');
          console.log('🔄 Emergency reset performed, reloading...');
          setTimeout(() => window.location.reload(), 2000);
        } catch (resetError) {
          console.error('Failed to perform emergency reset:', resetError);
        }
      }
    };

    initDatabases();
  }, []);

  // ✅ Your existing code continues below...
  
  const resetCashierFlow = useCallback(() => {
    setSelectedEmployeeState(null);
    setSelectedSessionState(null);
    setSelectedMenuState(null);
    setLastTransactionId(null);
    setCashierStep(1);
  }, []);

  /**
   * Synchronize IndexedDB offline queue with backend
   * Validates and formats transactions before sending
   */
  const syncOfflineTransactions = useCallback(async () => {
    try {
      // Get all queued transactions
      const queued = await offlineDb.queuedTransactions.toArray();

      if (queued.length === 0) {
        console.log('No offline transactions to sync');
        return;
      }

      console.log(`Found ${queued.length} offline transactions to sync`);

      // ✅ Map fields back to match backend payload schema expectations ('localId' and 'mealSession')
      const transactions = queued.map(t => {
        // Ensure menuItemId is a string (UUID format)
        const menuItemId = t.menuItemId ? String(t.menuItemId) : '';
        
        // Validate required fields
        if (!t.employeeId || !t.mealSession || !menuItemId) {
          console.warn('Skipping invalid transaction:', t);
          return null;
        }

        return {
          localId: t.localId,
          employeeId: t.employeeId,
          mealSession: t.mealSession,
          menuItemId: menuItemId,
          offlineAt: t.offlineAt,
        };
      }).filter(Boolean); // Remove null entries

      if (transactions.length === 0) {
        // Clear invalid transactions
        await offlineDb.queuedTransactions.clear();
        toast.error('No valid transactions to sync. Cleared invalid entries.');
        return;
      }

      const syncPayload = { transactions };

      console.log('Sending sync payload:', JSON.stringify(syncPayload, null, 2));

      toast.loading(`Syncing ${transactions.length} transactions...`, { id: 'sync-toast' });

      const response = await axiosInstance.post('/api/sync/offline-batch', syncPayload);

      console.log('Sync response:', response.data);

      if (response.data?.success) {
        // Clear all synced transactions from queue
        await offlineDb.queuedTransactions.clear();
        toast.success(`Sync complete. ${transactions.length} transactions uploaded!`, { id: 'sync-toast' });
        console.log('Cleared queued transactions');
      } else {
        toast.error('Offline sync failed on server.', { id: 'sync-toast' });
      }
    } catch (e: any) {
      console.error('Error during offline sync:', e);
      
      // Log the error response for debugging
      if (e.response) {
        console.error('Error response data:', e.response.data);
        console.error('Error response status:', e.response.status);
        
        // Check if the error is about invalid data
        if (e.response.status === 400) {
          const errorMsg = e.response.data?.message || 'Invalid transaction data';
          toast.error(`Sync failed: ${errorMsg}`, { id: 'sync-toast' });
          
          // Try to clean up invalid transactions
          try {
            const queued = await offlineDb.queuedTransactions.toArray();
            // If there are transactions with invalid menuItemId (numbers instead of UUIDs)
            const invalidTxns = queued.filter(t => {
              const id = String(t.menuItemId || '');
              // Check if it's a number (like "2") or a short ID
              return id.length < 10 || /^\d+$/.test(id);
            });
            
            if (invalidTxns.length > 0) {
              console.warn('Found invalid transactions to remove:', invalidTxns);
              
              // Bulk delete only the specific invalid records using their localIds
              const invalidLocalIds = invalidTxns.map(t => t.localId);
              await offlineDb.queuedTransactions.bulkDelete(invalidLocalIds);
              
              toast.error(`Cleared ${invalidTxns.length} invalid transaction(s). Please try again.`, { id: 'sync-toast' });
            }
          } catch (cleanupError) {
            console.error('Failed to clean up invalid transactions:', cleanupError);
          }
        } else if (e.response.status === 401) {
          toast.error('Authentication failed. Please log in again.', { id: 'sync-toast' });
        } else if (e.response.status === 403) {
          toast.error('Permission denied. You cannot sync transactions.', { id: 'sync-toast' });
        } else {
          toast.error(`Server error: ${e.response.status}`, { id: 'sync-toast' });
        }
      } else if (e.message?.includes('Network Error') || e.code === 'ERR_NETWORK') {
        toast.error('Network error. Will retry when connection is stable.', { id: 'sync-toast' });
      } else {
        toast.error('Sync failed. System will retry later.', { id: 'sync-toast' });
      }
    }
  }, []);

  /**
   * Handle Online/Offline Status automatically
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('Internet connection restored!');
      setIsOffline(false);
      toast.success('Internet connection restored! Syncing queued data...', { icon: '🌐' });
      
      // Call sync with a small delay to ensure connection is fully established
      setTimeout(() => {
        syncOfflineTransactions();
      }, 1000);
    };

    const handleOffline = () => {
      console.log('Internet connection lost!');
      setIsOffline(true);
      toast('Offline mode active. System will queue registrations locally.', {
        icon: '⚠️',
        style: { border: '1px solid #DC2626', color: '#DC2626' },
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineTransactions]);

  /**
   * Check for pending transactions on mount and periodically
   */
  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (!isOffline && dbInitialized) { // ✅ Only check when DB is initialized
        const queued = await offlineDb.queuedTransactions.toArray();
        if (queued.length > 0) {
          console.log(`Found ${queued.length} pending transactions, syncing...`);
          await syncOfflineTransactions();
        }
      }
    };
    
    // Check immediately when the app loads or when coming online
    checkPendingTransactions();
    
    // Also check every 30 seconds
    const interval = setInterval(checkPendingTransactions, 30000);
    return () => clearInterval(interval);
  }, [isOffline, syncOfflineTransactions, dbInitialized]); // ✅ Added dbInitialized dependency

  // Fetch Current User Profile on load
  useEffect(() => {
    const initAuth = async () => {
      if (getAccessToken()) {
        try {
          const res = await axiosInstance.get('/api/auth/me');
          if (res.data && res.data.success && res.data.data.user) {
            const apiUser = res.data.data.user;
            setCurrentUser({
              id: apiUser.id,
              email: apiUser.email,
              role: apiUser.role === 'ADMIN' ? 'Admin' : apiUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cashier',
              status: apiUser.status === 'ACTIVE' ? 'Active' : apiUser.status === 'PENDING' ? 'Pending' : 'Inactive',
              createdAt: apiUser.createdAt,
              lastLogin: apiUser.lastLogin,
            } as any);
            if (navigator.onLine) {
              cacheEmployeesOffline();
            }
          } else {
            clearTokens();
          }
        } catch {
          clearTokens();
        }
      }
      setAuthLoading(false);
    };

    initAuth();
  }, []);

  // Cache Employees in IndexedDB
  const cacheEmployeesOffline = async () => {
    try {
      const res = await axiosInstance.get('/api/employees?limit=200');
      if (res.data?.success && res.data?.data?.employees) {
        const list: OfflineEmployee[] = res.data.data.employees.map((emp: any) => ({
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          fullName: emp.fullName,
          status: emp.status,
          photo: emp.photo,
          fingerprintId: emp.fingerprintId || null,
        }));
        await offlineDb.offlineEmployees.clear();
        await offlineDb.offlineEmployees.bulkPut(list);
      }
    } catch (e) {
      console.warn('Failed to pre-cache employees for offline support:', e);
    }
  };

  // ✅ Rest of your code remains exactly the same...
  const login = async (
    email: string,
    password: string,
    rememberMe = true
  ): Promise<LoginResult> => {
    try {
      const res = await axiosInstance.post('/api/auth/login', { email, password });
      if (res.data?.success && res.data?.data) {
        const { user: apiUser, accessToken, refreshToken } = res.data.data;
        if (apiUser.status !== 'ACTIVE') {
          return { success: false, error: 'User account is inactive.' };
        }

        setTokens(accessToken, refreshToken, rememberMe);

        const role = apiUser.role === 'ADMIN' ? 'Admin' : apiUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Cashier';

        const mappedUser: User = {
          id: apiUser.id,
          email: apiUser.email,
          role: role as any,
          status: apiUser.status === 'ACTIVE' ? 'Active' : apiUser.status === 'PENDING' ? 'Pending' : 'Inactive',
          createdAt: apiUser.createdAt,
          lastLogin: apiUser.lastLogin,
        } as any;

        setCurrentUser(mappedUser);

        cacheEmployeesOffline();

        let path = '/cashier';
        if (role === 'Admin') path = '/admin';
        else if (role === 'Super Admin') path = '/super-admin';

        return { success: true, redirectTo: path };
      }
      return { success: false, error: 'Invalid server response structure.' };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/api/auth/logout');
    } catch (e) {
      console.warn('Logout request failed:', e);
    } finally {
      clearTokens();
      setCurrentUser(null);
      resetCashierFlow();
    }
  };

  const logoutAll = async () => {
    try {
      await axiosInstance.post('/api/auth/logout-all');
    } catch (e) {
      console.warn('Logout all request failed:', e);
    } finally {
      clearTokens();
      setCurrentUser(null);
      resetCashierFlow();
    }
  };

  const setOfflineMode = (offline: boolean) => {
    setIsOffline(offline);
    if (offline) {
      toast('Simulating Offline Mode. Transactions will queue in local storage.', {
        icon: '⚠️',
        style: { border: '1px solid #DC2626', color: '#DC2626' },
      });
    } else {
      toast('Simulating reconnection...', { icon: '🔄' });
      setTimeout(() => {
        syncOfflineTransactions();
      }, 1000);
    }
  };

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

  const submitTransaction = async (): Promise<boolean> => {
    if (!selectedEmployee || !selectedSession || !selectedMenu) {
      toast.error('Missing transaction details.');
      return false;
    }

    const mealSessionMapped = selectedSession.toUpperCase() as 'BREAKFAST' | 'LUNCH' | 'DINNER';

    if (isOffline) {
      try {
        const localId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const menuItemId = selectedMenu.id;
        
        console.log('Saving offline transaction:', {
          localId,
          employeeId: selectedEmployee.id,
          mealSession: mealSessionMapped,
          menuItemId: menuItemId,
          menuName: selectedMenu.name,
        });

        await offlineDb.queuedTransactions.add({
          localId,
          employeeId: selectedEmployee.id,
          mealSession: mealSessionMapped,
          menuItemId: menuItemId,
          fingerprintId: selectedEmployee.fingerprintId || null,
          offlineAt: new Date().toISOString(),
        });

        setLastTransactionId(localId);
        toast.success('Saved locally (Offline Mode)');
        setCashierStep(5);
        return true;
      } catch (err: any) {
        console.error('Failed to queue offline transaction:', err);
        toast.error('Failed to queue offline transaction.');
        return false;
      }
    } else {
      try {
        const res = await axiosInstance.post('/api/transactions', {
          employeeId: selectedEmployee.id,
          mealSession: mealSessionMapped,
          menuItemId: selectedMenu.id,
        });

        if (res.data?.success && res.data?.data) {
          setLastTransactionId(res.data.data.transactionId);
          toast.success('Transaction recorded successfully!');
          setCashierStep(5);
          return true;
        }
        return false;
      } catch (error: any) {
        console.error('Transaction error:', error);
        if (error.response?.status === 409) {
          toast.error('Employee has already consumed this meal session today');
        } else {
          toast.error('Failed to save transaction');
        }
        return false;
      }
    }
  };

  const triggerDbReSeed = async () => {
    try {
      await indexedDB.deleteDatabase('CafeteriaDatabase');
      await indexedDB.deleteDatabase('CafeteriaOfflineDatabase');
      toast.success('Databases reset. Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error('Failed to reset databases');
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authLoading,
        login,
        logout,
        logoutAll,
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
        triggerDbReSeed,
      }}
    >
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