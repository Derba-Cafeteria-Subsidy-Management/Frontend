import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import axiosInstance from '../../client/axios';
import type { MenuItem, Employee } from '../../types/api';
import {
  Fingerprint,
  MagnifyingGlass,
  WarningCircle,
  CheckCircle,
  Coffee,
  Sun,
  Moon,
  ArrowLeft,
  XCircle,
  Lock,
  Check,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Session status for a meal period */
type SessionStatus = 'Available' | 'Consumed' | 'Locked';

/** Meal session types */
type MealSession = 'BREAKFAST' | 'LUNCH' | 'DINNER';

/** Menu pagination state */
interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CashierFlow Component
 * 
 * Handles the complete cashier transaction flow from employee identification
 * to transaction completion.
 * 
 * Flow Steps:
 * 1. Employee Identification (Manual ID or Fingerprint)
 * 2. Session Selection (Breakfast/Lunch/Dinner)
 * 3. Menu Item Selection (with search and pagination - can be skipped)
 * 4. Drink Selection (Optional if meal selected, Required if meal skipped)
 * 5. Transaction Review and Submission
 * 6. Success Receipt
 */
export const CashierFlow: React.FC = () => {
  // ==========================================================================
  // CONTEXT & HOOKS
  // ==========================================================================

  const {
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
  } = useApp();

  const navigate = useNavigate();

  // ==========================================================================
  // REFS
  // ==========================================================================

  /** Prevents state updates after component unmount */
  const isMountedRef = useRef(true);

  /** Timer reference for the countdown on the success screen */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================================================
  // STEP 1: EMPLOYEE IDENTIFICATION
  // ==========================================================================

  const [manualId, setManualId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'matched' | 'nomatch'>('idle');

  // ==========================================================================
  // STEP 2: SESSION SELECTION
  // ==========================================================================

  const [sessionStatus, setSessionStatus] = useState<{
    Breakfast: SessionStatus;
    Lunch: SessionStatus;
    Dinner: SessionStatus;
  }>({
    Breakfast: 'Available',
    Lunch: 'Available',
    Dinner: 'Available',
  });

  // ==========================================================================
  // STEP 3: MENU SELECTION
  // ==========================================================================

  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [displayedMenuItems, setDisplayedMenuItems] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');

  const [menuPagination, setMenuPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 6,
    totalItems: 0,
    totalPages: 0,
  });

  // ==========================================================================
  // STEP 4: DRINK SELECTION
  // ==========================================================================

  const [drinkItems, setDrinkItems] = useState<MenuItem[]>([]);
  const [selectedDrink, setSelectedDrink] = useState<MenuItem | null>(null);
  const [isLoadingDrinks, setIsLoadingDrinks] = useState(false);
  const [drinkSearchTerm, setDrinkSearchTerm] = useState('');
  const [filteredDrinks, setFilteredDrinks] = useState<MenuItem[]>([]);
  const [displayedDrinks, setDisplayedDrinks] = useState<MenuItem[]>([]);
  const [drinkPagination, setDrinkPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 6,
    totalItems: 0,
    totalPages: 0,
  });

  // ==========================================================================
  // STEP 5: SUBSIDY RATES
  // ==========================================================================

  const [subsidyRates, setSubsidyRates] = useState({ employee: 40, company: 60 });

  // ==========================================================================
  // STEP 6: RECEIPT COUNTDOWN
  // ==========================================================================

  const [countdown, setCountdown] = useState(5);

  const [employeeSearchEnabled, setEmployeeSearchEnabled] = useState(true);

  // ==========================================================================
  // LIFECYCLE EFFECTS
  // ==========================================================================

  /**
   * Track component mount/unmount state
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchAuthSettings = async () => {
      try {
        const res = await axiosInstance.get('/api/system-settings/authentication');
        
        if (!isMountedRef.current) return;

        if (res.data?.success && res.data?.data) {
          setEmployeeSearchEnabled(res.data.data.employeeSearchEnabled ?? true);
        }
      } catch (error) {
        console.error('Failed to fetch authentication settings:', error);
        // Keep default values if API fails
      }
    };

    fetchAuthSettings();
  }, []);

  /**
   * Fetch subsidy rates when reaching step 5
   * Uses the policy query parameter: DEFAULT or FULL_COMPANY
   */
  useEffect(() => {
    if (cashierStep === 5) {
      axiosInstance
        .get('/api/subsidy', {
          params: { policy: 'DEFAULT' }
        })
        .then((res) => {
          if (!isMountedRef.current) return;
          if (res.data?.success && res.data?.data) {
            setSubsidyRates({
              employee: res.data.data.employeePercent,
              company: res.data.data.companyPercent,
            });
          }
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          if (err.response?.status === 403) {
            console.log('Cashier does not have permission to view subsidy config. Using default 40/60 split.');
          } else {
            console.error('Failed to fetch subsidy rates:', err);
          }
          // Keep default values (40/60)
        });
    }
  }, [cashierStep]);

  /**
   * Countdown timer for success screen
   */
  useEffect(() => {
    if (cashierStep === 6) {
      setCountdown(5);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cashierStep]);

  /**
   * Reset flow when countdown reaches zero
   */
  useEffect(() => {
    if (cashierStep === 6 && countdown === 0) {
      resetCashierFlow();
    }
  }, [cashierStep, countdown, resetCashierFlow]);

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Get current session meal/drink availability
   */
  const getCurrentSessionAvailability = () => {
    if (!selectedEmployee || !selectedSession) {
      return { mealAvailable: true, drinkAvailable: true };
    }
    
    const mealsToday = selectedEmployee.mealsToday;
    
    if (Array.isArray(mealsToday)) {
      const currentSessionMeals = mealsToday.find(
        (meal: any) => meal.session === selectedSession.toUpperCase()
      );
      
      if (!currentSessionMeals) {
        return { mealAvailable: true, drinkAvailable: true };
      }
      
      return {
        mealAvailable: currentSessionMeals.mealConsumed < 1 && currentSessionMeals.mealAvailable,
        drinkAvailable: currentSessionMeals.drinkConsumed < 1 && currentSessionMeals.drinkAvailable,
      };
    }
    
    return { mealAvailable: true, drinkAvailable: true };
  };

  /**
   * Get detailed session status for display
   */
  const getSessionDetailedStatus = (sessionName: string) => {
    if (!selectedEmployee?.mealsToday || !Array.isArray(selectedEmployee.mealsToday)) {
      return null;
    }
    
    const sessionData = selectedEmployee.mealsToday.find(
      (meal: any) => meal.session === sessionName.toUpperCase()
    );
    
    if (!sessionData) return null;
    
    const mealConsumed = sessionData.mealConsumed >= 1;
    const drinkConsumed = sessionData.drinkConsumed >= 1;
    
    return { mealConsumed, drinkConsumed };
  };

  /**
   * Check if the selected employee is a guest
   */
  const isGuest = () => {
    if (!selectedEmployee) return false;
    return selectedEmployee.employeeNumber?.toLowerCase().includes('guest') || 
           selectedEmployee.fullName?.toLowerCase().includes('guest');
  };

  // ==========================================================================
  // STEP 2: SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Check employee sessions and update session status
   */
  const checkEmployeeSessions = (employee: Employee | null) => {
    if (!employee) {
      console.log('No employee selected');
      return;
    }

    console.log('Checking sessions for employee:', employee.fullName);

    const status: {
      Breakfast: SessionStatus;
      Lunch: SessionStatus;
      Dinner: SessionStatus;
    } = {
      Breakfast: 'Available',
      Lunch: 'Available',
      Dinner: 'Available',
    };

    if (employee.mealsToday) {
      // Handle the new mealsToday format (array of objects)
      if (Array.isArray(employee.mealsToday)) {
        employee.mealsToday.forEach((mealSession: any) => {
          // Check if both meal and drink are consumed for this session
          const bothConsumed = mealSession.mealConsumed >= 1 && mealSession.drinkConsumed >= 1;
          
          if (bothConsumed) {
            // Both meal and drink consumed - session is fully consumed
            switch (mealSession.session) {
              case 'BREAKFAST':
                status.Breakfast = 'Consumed';
                break;
              case 'LUNCH':
                status.Lunch = 'Consumed';
                break;
              case 'DINNER':
                status.Dinner = 'Consumed';
                break;
            }
          }
          // If only one is consumed, session remains available for the other
        });
      } else {
        // Legacy format handling
        const meals = employee.mealsToday as any;
        if (meals.breakfast === true) status.Breakfast = 'Consumed';
        if (meals.lunch === true) status.Lunch = 'Consumed';
        if (meals.dinner === true) status.Dinner = 'Consumed';
      }
    }

    setSessionStatus(status);
  };

  /**
   * Update session availability when employee changes
   */
  useEffect(() => {
    if (cashierStep === 2 && selectedEmployee) {
      checkEmployeeSessions(selectedEmployee);
    }
  }, [cashierStep, selectedEmployee]);

  // ==========================================================================
  // STEP 1: EMPLOYEE LOOKUP
  // ==========================================================================

  /**
   * Handle employee lookup by manual ID entry
   */
  const handleManualLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualId.trim()) return;

    setLookupError(null);
    setIsSearching(true);

    const formattedId = manualId.trim();

    try {
      let emp: Employee | null = null;

      const res = await axiosInstance.get(`/api/employees/${encodeURIComponent(formattedId)}`);

      if (!isMountedRef.current) return;
      setIsSearching(false);

      if (res.data?.success && res.data?.data) {
        const apiData = res.data.data;
        emp = {
          id: apiData.id,
          employeeNumber: apiData.employeeNumber,
          fullName: apiData.fullName,
          status: apiData.status as 'ACTIVE' | 'INACTIVE',
          photo: apiData.photo,
          fingerprintId: apiData.fingerprintId || undefined,
          mealsToday: apiData.mealsToday || { breakfast: false, lunch: false, dinner: false },
        };
      } else {
        setLookupError('Employee not found. Please check the ID and try again.');
        toast.error('Employee not found');
        return;
      }

      if (!emp) {
        setLookupError('Employee not found. Please check the ID and try again.');
        toast.error('Employee not found');
        return;
      }

      if (emp.status === 'INACTIVE') {
        setLookupError('Access Denied — Employee status is Inactive');
        toast.error('Access Denied: Employee is Inactive');
        return;
      }

      setEmployee(emp);
      setLookupError(null);
      toast.success(`Welcome, ${emp.fullName}!`);

      checkEmployeeSessions(emp);
      goToStep(2);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setIsSearching(false);

      if (err.response?.status === 403) {
        setLookupError('Access denied. Please contact administrator.');
        toast.error('Access denied');
      } else if (err.response?.status === 404) {
        setLookupError('Employee not found. Please check the ID and try again.');
        toast.error('Employee not found');
      } else {
        setLookupError('Error occurred looking up employee');
        toast.error('Error occurred looking up employee');
      }
    }
  };

  /**
   * Handle biometric fingerprint scan
   */
  const triggerFingerprintScan = async () => {
    if (scanStatus === 'scanning') return;

    setScanStatus('scanning');
    setLookupError(null);

    try {
      const res = await axiosInstance.post('/api/employees/fingerprint', {
        fingerprintId: 'FP-001',
      });

      if (!isMountedRef.current) return;

      if (res.data?.success && res.data?.data) {
        const matched = res.data.data;
        setScanStatus('matched');
        setEmployee(matched);
        checkEmployeeSessions(matched);
        toast.success(`Matched: ${matched.fullName}`);
        setTimeout(() => {
          if (!isMountedRef.current) return;
          setScanStatus('idle');
          goToStep(2);
        }, 1000);
      } else {
        setScanStatus('nomatch');
        setLookupError('Fingerprint not recognized.');
        toast.error('Fingerprint not recognized');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setScanStatus('nomatch');
      setLookupError(err.response?.data?.message || 'Biometric lookup failed');
      toast.error(err.response?.data?.message || 'Biometric lookup failed');
    }
  };

  // ==========================================================================
  // STEP 3: MENU MANAGEMENT
  // ==========================================================================

  /**
   * Apply search filter to menu items
   */
  const applyMenuSearch = (searchTerm: string, items: MenuItem[]) => {
    if (!searchTerm.trim()) {
      setFilteredMenuItems(items);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
    );
    setFilteredMenuItems(filtered);
  };

  /**
   * Update paginated display of menu items
   */
  const updatePaginatedItems = (items: MenuItem[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);
    setDisplayedMenuItems(paginatedItems);
    setMenuPagination((prev) => ({
      ...prev,
      currentPage,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / itemsPerPage),
    }));
  };

  /**
   * Handle page change for menu pagination
   */
  const handleMenuPageChange = (newPage: number) => {
    if (newPage < 1 || newPage > menuPagination.totalPages) return;
    updatePaginatedItems(filteredMenuItems, newPage, menuPagination.itemsPerPage);
  };

  /**
   * Handle menu search input change
   */
  const handleMenuSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMenuSearchTerm(value);
    applyMenuSearch(value, allMenuItems);

    const filtered = value.trim()
      ? allMenuItems.filter(
          (item) =>
            item.name.toLowerCase().includes(value.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(value.toLowerCase()))
        )
      : allMenuItems;
    setFilteredMenuItems(filtered);
    updatePaginatedItems(filtered, 1, menuPagination.itemsPerPage);
  };

  /**
   * Fetch meal items from API with audience filter
   * Excludes drinks by filtering out items with mealtype 'DRINK'
   */
  useEffect(() => {
    if (cashierStep === 3) {
      const fetchMenus = async () => {
        setIsLoadingMenu(true);
        let allItems: any[] = [];
        let currentPage = 1;
        const pageSize = 50;

        // Determine audience filter based on employee type
        const isGuestUser = isGuest();
        const audienceFilter = isGuestUser ? 'GUEST' : 'EMPLOYEE';

        try {
          // Fetch all active menu items with audience filter
          const firstRes = await axiosInstance.get('/api/menus/active', {
            params: { 
              page: currentPage, 
              pageSize: pageSize,
              audience: audienceFilter,
            },
          });

          if (!isMountedRef.current) return;

          if (firstRes.data?.success && firstRes.data?.data) {
            const responseData = firstRes.data.data;
            const items = responseData.data || responseData.items || [];
            const pagination = responseData.pagination || {};

            allItems = [...items];

            const totalCount = pagination.totalCount || 0;
            const totalPages = pagination.totalPages || Math.ceil(totalCount / pageSize);

            if (totalPages > 1) {
              const pagePromises = [];
              for (let page = 2; page <= totalPages; page++) {
                pagePromises.push(
                  axiosInstance.get('/api/menus/active', {
                    params: { 
                      page: page, 
                      pageSize: pageSize,
                      audience: audienceFilter,
                    },
                  })
                );
              }

              const pageResults = await Promise.all(pagePromises);

              for (const result of pageResults) {
                if (result.data?.success && result.data?.data) {
                  const pageData = result.data.data;
                  const pageItems = pageData.data || pageData.items || [];
                  allItems = [...allItems, ...pageItems];
                }
              }
            }

            // Filter out drink items (mealtype === 'DRINK')
            const mealItems = allItems.filter((item: any) => {
              const mealType = (item.mealtype || item.mealType || '').toUpperCase();
              return mealType !== 'DRINK';
            });

            // Map items to MenuItem format
            const mappedItems = mealItems.map((item: any) => ({
              id: item.id,
              name: item.name,
              description: item.description || '',
              mealtype: item.mealtype || item.mealType || '',
              currentPrice: item.currentPrice || item.price || 0,
              active: item.active !== undefined ? item.active : true,
            }));

            if (!isMountedRef.current) return;

            setAllMenuItems(mappedItems);
            setFilteredMenuItems(mappedItems);
            updatePaginatedItems(mappedItems, 1, menuPagination.itemsPerPage);
          }
        } catch (error) {
          if (!isMountedRef.current) return;
          console.error('Error fetching menu items:', error);
          toast.error('Failed to load menu items');
        }

        if (!isMountedRef.current) return;
        setIsLoadingMenu(false);
      };
      fetchMenus();
    }
  }, [cashierStep, selectedEmployee]);

  // Auto-redirect from step 3 if meal is not available
  useEffect(() => {
    if (cashierStep === 3 && selectedEmployee) {
      const { mealAvailable, drinkAvailable } = getCurrentSessionAvailability();
      
      if (!mealAvailable) {
        if (drinkAvailable) {
          toast('Meal already consumed for this session. Please select a drink.', { icon: 'ℹ️' });
          goToStep(4);
        } else {
          toast.error('Both meal and drink already consumed for this session');
          goToStep(2);
        }
      }
    }
  }, [cashierStep, selectedEmployee]);

  // ==========================================================================
  // STEP 4: DRINK SELECTION
  // ==========================================================================

  /**
   * Fetch drink items from the API with audience filter
   * Only fetches items with mealtype 'DRINK'
   */
  const fetchDrinkItems = async () => {
    setIsLoadingDrinks(true);
    let allDrinks: MenuItem[] = [];
    let currentPage = 1;
    const pageSize = 50;

    // Determine audience filter based on employee type
    const isGuestUser = isGuest();
    const audienceFilter = isGuestUser ? 'GUEST' : 'EMPLOYEE';

    try {
      const firstRes = await axiosInstance.get('/api/menus/active', {
        params: { 
          page: currentPage, 
          pageSize: pageSize,
          audience: audienceFilter,
        },
      });

      if (!isMountedRef.current) return;

      if (firstRes.data?.success && firstRes.data?.data) {
        const responseData = firstRes.data.data;
        const items = responseData.data || responseData.items || [];
        const pagination = responseData.pagination || {};

        allDrinks = [...items];

        const totalCount = pagination.totalCount || 0;
        const totalPages = pagination.totalPages || Math.ceil(totalCount / pageSize);

        if (totalPages > 1) {
          const pagePromises = [];
          for (let page = 2; page <= totalPages; page++) {
            pagePromises.push(
              axiosInstance.get('/api/menus/active', {
                params: { 
                  page: page, 
                  pageSize: pageSize,
                  audience: audienceFilter,
                },
              })
            );
          }

          const pageResults = await Promise.all(pagePromises);

          for (const result of pageResults) {
            if (result.data?.success && result.data?.data) {
              const pageData = result.data.data;
              const pageItems = pageData.data || pageData.items || [];
              allDrinks = [...allDrinks, ...pageItems];
            }
          }
        }

        // Filter for drink items only (mealtype === 'DRINK')
        const drinkItemsOnly = allDrinks.filter((item: any) => {
          const mealType = (item.mealtype || item.mealType || '').toUpperCase();
          return mealType === 'DRINK';
        });

        // Map items to MenuItem format
        const mappedDrinks = drinkItemsOnly.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          mealtype: item.mealtype || item.mealType || '',
          currentPrice: item.currentPrice || item.price || 0,
          active: item.active !== undefined ? item.active : true,
        }));

        if (!isMountedRef.current) return;

        setDrinkItems(mappedDrinks);
        setFilteredDrinks(mappedDrinks);
        updateDrinkPaginatedItems(mappedDrinks, 1, drinkPagination.itemsPerPage);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error fetching drink items:', error);
      toast.error('Failed to load drink options');
    }

    if (!isMountedRef.current) return;
    setIsLoadingDrinks(false);
  };

  /**
   * Apply search filter to drink items
   */
  const applyDrinkSearch = (searchTerm: string, items: MenuItem[]) => {
    if (!searchTerm.trim()) {
      setFilteredDrinks(items);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
    );
    setFilteredDrinks(filtered);
    updateDrinkPaginatedItems(filtered, 1, drinkPagination.itemsPerPage);
  };

  /**
   * Update paginated display of drink items
   */
  const updateDrinkPaginatedItems = (items: MenuItem[], currentPage: number, itemsPerPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);
    setDisplayedDrinks(paginatedItems);
    setDrinkPagination((prev) => ({
      ...prev,
      currentPage,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / itemsPerPage),
    }));
  };

  /**
   * Handle drink page change
   */
  const handleDrinkPageChange = (newPage: number) => {
    if (newPage < 1 || newPage > drinkPagination.totalPages) return;
    updateDrinkPaginatedItems(filteredDrinks, newPage, drinkPagination.itemsPerPage);
  };

  /**
   * Handle drink search input change
   */
  const handleDrinkSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDrinkSearchTerm(value);
    applyDrinkSearch(value, drinkItems);
  };

  /**
   * Load drinks when reaching step 4
   */
  useEffect(() => {
    if (cashierStep === 4) {
      fetchDrinkItems();
    }
  }, [cashierStep, selectedEmployee]);

  // Auto-redirect from step 4 if drink is not available but meal is selected
  useEffect(() => {
    if (cashierStep === 4 && selectedEmployee && selectedMenu) {
      const { drinkAvailable } = getCurrentSessionAvailability();
      
      if (!drinkAvailable) {
        setSelectedDrink(null);
        goToStep(5);
      }
    }
  }, [cashierStep, selectedEmployee, selectedMenu]);

  // ==========================================================================
  // STEP 5: TRANSACTION SUBMISSION
  // ==========================================================================

  /**
   * Submit transaction to backend
   * Handles cases where meal, drink, or both may be skipped
   */
  const handleSubmitTransaction = async () => {
    // Validate required data
    if (!selectedEmployee || !selectedSession) {
      toast.error('Missing required employee or session information');
      return;
    }

    // Build items array - only include items with valid IDs
    const items: { menuItemId: string; quantity: number }[] = [];

    // Add meal if selected and has valid ID
    if (selectedMenu?.id) {
      items.push({
        menuItemId: selectedMenu.id,
        quantity: 1,
      });
    }

    // Add drink if selected and has valid ID
    if (selectedDrink?.id) {
      items.push({
        menuItemId: selectedDrink.id,
        quantity: 1,
      });
    }

    // Validate at least one item was selected
    if (items.length === 0) {
      toast.error('Please select at least a meal or a drink before submitting');
      return;
    }

    try {
      const mealSession = selectedSession.toUpperCase() as MealSession;

      const transactionData = {
        employeeId: selectedEmployee.id,
        mealSession: mealSession,
        items: items,
      };

      console.log('Submitting transaction:', transactionData);

      const response = await axiosInstance.post('/api/transactions', transactionData);

      if (!isMountedRef.current) return;

      if (response.data?.success) {
        const transactionId =
          response.data.data?.transactionId || 
          response.data.data?.id || 
          'TXN-UNKNOWN';
        
        toast.success(`Transaction successful! ID: ${transactionId}`);
        goToStep(6);
      } else {
        toast.error(response.data?.message || 'Failed to submit transaction');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      console.error('Transaction error:', err);

      // Extract error message from response
      const errorMessage = 
        err.response?.data?.message || 
        err.message || 
        'Failed to submit transaction. Please check your inputs.';

      // Handle specific error status codes
      switch (err.response?.status) {
        case 400:
          // Display backend validation message (e.g., group schedule mismatches)
          toast.error(errorMessage);
          break;
        case 409:
          toast.error('Employee has already consumed this meal session today');
          break;
        case 404:
          toast.error('Employee or menu item not found');
          break;
        case 403:
          toast.error('You do not have permission to perform this action');
          break;
        default:
          toast.error(errorMessage);
          break;
      }
    }
  };

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  /**
   * Handle new registration button click
   */
  const handleNewRegistration = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    resetCashierFlow();
  };

  // ==========================================================================
  // RENDER METHODS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // STEP 1: EMPLOYEE IDENTIFICATION
  // --------------------------------------------------------------------------
  if (cashierStep === 1) {
    return (
      <div className="w-full max-w-[800px] mx-auto mt-4 space-y-6 select-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Biometrics Scan Panel */}
          <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 flex flex-col items-center justify-between min-h-[360px]">
            <div className="text-center space-y-2">
              <h2 className="text-[18px] font-semibold text-brand-dark-green">Biometric Scan</h2>
              <p className="text-brand-gray-neutral text-xs px-4">
                Place employee's index finger flat on the scanner hardware to identify
              </p>
            </div>

            <div className="relative my-6">
              <button
                onClick={triggerFingerprintScan}
                disabled={scanStatus === 'scanning'}
                className={`w-[120px] h-[120px] rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                  scanStatus === 'scanning'
                    ? 'border-brand-gold bg-brand-gold/5 scale-105 animate-pulse'
                    : scanStatus === 'matched'
                      ? 'border-brand-dark-green bg-brand-dark-green/10 scale-105'
                      : scanStatus === 'nomatch'
                        ? 'border-brand-error-red bg-brand-error-red/10 scale-100'
                        : 'border-brand-light-green hover:border-brand-gold hover:scale-[1.02] bg-brand-white'
                }`}
              >
                <Fingerprint
                  size={64}
                  className={`transition-colors duration-300 ${
                    scanStatus === 'scanning'
                      ? 'text-brand-gold'
                      : scanStatus === 'matched'
                        ? 'text-brand-dark-green'
                        : scanStatus === 'nomatch'
                          ? 'text-brand-error-red'
                          : 'text-brand-dark-green'
                  }`}
                />
              </button>
            </div>

            <div className="text-center w-full">
              {scanStatus === 'scanning' && (
                <span className="text-brand-gold text-xs font-semibold animate-pulse">
                  Scanning fingerprint...
                </span>
              )}
              {scanStatus === 'matched' && (
                <span className="text-brand-dark-green text-xs font-semibold">Match found successfully</span>
              )}
              {scanStatus === 'nomatch' && (
                <span className="text-brand-error-red text-xs font-semibold">Scan rejected. Please try again.</span>
              )}
              {scanStatus === 'idle' && (
                <button
                  onClick={triggerFingerprintScan}
                  className="text-xs font-semibold text-brand-gold hover:underline"
                >
                  Click to Simulate Scan
                </button>
              )}
            </div>
          </div>

          {/* Manual ID Input Panel */}
          <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 flex flex-col justify-between min-h-[360px]">
            <div className="space-y-2">
              <h2 className="text-[18px] font-semibold text-brand-dark-green">Manual Lookup</h2>
              <p className="text-brand-gray-neutral text-xs">
                Enter the employee's ID number if biometrics scan fails or is unavailable
              </p>
            </div>

            {employeeSearchEnabled ? (
              <form onSubmit={handleManualLookup} className="space-y-4 my-auto">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-brand-dark-green uppercase">Employee ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      placeholder="e.g. EMP-1"
                      className="w-full h-[44px] pl-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/40"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral hover:text-brand-dark-green"
                    >
                      <MagnifyingGlass size={20} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !manualId.trim()}
                  className="w-full h-[44px] bg-brand-gold text-brand-white text-sm font-semibold rounded-[8px] hover:opacity-90 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search Employee'}
                </button>
              </form>
            ) : (
              <div className="my-auto border border-dashed border-gray-200 rounded-[8px] p-6 text-center text-xs text-brand-gray-neutral">
                <WarningCircle size={28} className="mx-auto mb-2 text-brand-gray-neutral" />
                Manual ID entry is disabled by system settings. Use Biometric Scan.
              </div>
            )}

            <div className="h-4">
              {lookupError && (
                <p className="text-brand-error-red text-xs text-center font-medium">{lookupError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 2: SESSION SELECTION
  // --------------------------------------------------------------------------
  if (cashierStep === 2) {
    if (!selectedEmployee) return null;

    const allConsumed =
      sessionStatus.Breakfast === 'Consumed' &&
      sessionStatus.Lunch === 'Consumed' &&
      sessionStatus.Dinner === 'Consumed';

    return (
      <div className="w-full max-w-[600px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
            <button
              onClick={() => {
                resetCashierFlow();
                goToStep(1);
              }}
              className="text-brand-gray-neutral hover:text-brand-dark-green"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold text-brand-dark-green">Select Meal Session</h2>
              <p className="text-brand-gray-neutral text-xs">
                Active for: <strong className="text-brand-dark-green">{selectedEmployee.fullName}</strong>
              </p>
              <div className="flex gap-3 mt-1 text-[10px] text-brand-gray-neutral">
                <span className="flex items-center gap-1">
                  <Coffee size={12} />
                  {sessionStatus.Breakfast === 'Consumed' ? (
                    <span className="text-brand-error-red">Consumed</span>
                  ) : (
                    <span className="text-brand-dark-green">Available</span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Sun size={12} />
                  {sessionStatus.Lunch === 'Consumed' ? (
                    <span className="text-brand-error-red">Consumed</span>
                  ) : (
                    <span className="text-brand-dark-green">Available</span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Moon size={12} />
                  {sessionStatus.Dinner === 'Consumed' ? (
                    <span className="text-brand-error-red">Consumed</span>
                  ) : (
                    <span className="text-brand-dark-green">Available</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {allConsumed ? (
            <div className="border border-brand-error-red/20 bg-brand-error-red/5 p-6 rounded-[8px] text-center space-y-3">
              <WarningCircle size={40} className="text-brand-error-red mx-auto" />
              <h3 className="text-brand-error-red font-semibold text-sm">Lockout Block</h3>
              <p className="text-xs text-brand-gray-neutral px-4">
                This employee has already consumed breakfast, lunch, and dinner sessions today. No further registrations
                allowed.
              </p>
              <button
                onClick={() => {
                  resetCashierFlow();
                  goToStep(1);
                }}
                className="px-4 py-2 border border-brand-error-red text-brand-error-red hover:bg-brand-error-red/5 text-xs font-semibold rounded"
              >
                Back to Scanner
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map((sessionName) => {
                const status = sessionStatus[sessionName];
                const isConsumed = status === 'Consumed';
                const isLocked = status === 'Locked';
                const isDisabled = isConsumed || isLocked;
                const isAvailable = status === 'Available';
                const sessionDetails = getSessionDetailedStatus(sessionName);
                
                const statusInfo = {
                  message: isConsumed ? 'Already consumed today' : isLocked ? 'Session is locked' : 'Available for registration',
                  color: isConsumed ? 'bg-brand-error-red/10 text-brand-error-red' : isLocked ? 'bg-brand-warning/10 text-brand-warning' : 'bg-brand-dark-green/10 text-brand-dark-green',
                };

                return (
                  <button
                    key={sessionName}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isAvailable) {
                        setSession(sessionName);
                        
                        // Check what's available for this session
                        const { mealAvailable, drinkAvailable } = getCurrentSessionAvailability();
                        
                        // If meal is not available, skip to drinks
                        if (!mealAvailable && drinkAvailable) {
                          goToStep(4);
                        } else if (mealAvailable) {
                          goToStep(3);
                        } else {
                          toast.error('No items available for this session');
                        }
                      } else {
                        toast.error(`${sessionName} is not available for this employee.`);
                      }
                    }}
                    className={`w-full p-4 rounded-[8px] border text-left flex items-center justify-between transition-all duration-200 ${
                      isDisabled
                        ? 'bg-gray-50 border-gray-200 text-brand-gray-neutral opacity-50 cursor-not-allowed'
                        : 'border-brand-light-green hover:border-brand-gold hover:bg-brand-light-green/5 text-brand-dark-green cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={isDisabled ? 'text-brand-gray-neutral' : 'text-brand-gold'}>
                        {sessionName === 'Breakfast' && <Coffee size={24} className={isDisabled ? 'text-brand-gray-neutral' : 'text-brand-gold'} />}
                        {sessionName === 'Lunch' && <Sun size={24} className={isDisabled ? 'text-brand-gray-neutral' : 'text-brand-gold'} />}
                        {sessionName === 'Dinner' && <Moon size={24} className={isDisabled ? 'text-brand-gray-neutral' : 'text-brand-gold'} />}
                      </div>
                      <div>
                        <span className="font-semibold text-sm block">{sessionName}</span>
                        <span className="text-[11px] text-brand-gray-neutral flex items-center gap-1">
                          {isConsumed ? <XCircle size={20} className="text-brand-error-red" /> : isLocked ? <Lock size={20} className="text-brand-warning" /> : <Check size={20} className="text-brand-dark-green" />}
                          {statusInfo.message}
                        </span>
                        {sessionDetails && !isConsumed && (
                          <span className="text-[10px] text-brand-gray-neutral mt-1 block">
                            {sessionDetails.mealConsumed && '• Meal consumed '}
                            {sessionDetails.drinkConsumed && '• Drink consumed '}
                            {!sessionDetails.mealConsumed && !sessionDetails.drinkConsumed && '• Nothing consumed yet'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 3: MENU ITEM SELECTION
  // --------------------------------------------------------------------------
  if (cashierStep === 3) {
    if (!selectedEmployee || !selectedSession) return null;

    const { mealAvailable, drinkAvailable } = getCurrentSessionAvailability();
    const isGuestUser = isGuest();
    
    // If meal is not available, show message and redirect
    if (!mealAvailable) {
      return (
        <div className="w-full max-w-[600px] mx-auto mt-4 select-none">
          <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
            <div className="text-center py-12 text-brand-gray-neutral">
              <div className="flex justify-center mb-3">
                <Coffee size={48} className="text-brand-gray-neutral/30" />
              </div>
              <p className="text-sm">Meal already consumed for this session</p>
              {drinkAvailable ? (
                <button
                  onClick={() => goToStep(4)}
                  className="mt-4 px-6 py-2 bg-brand-gold text-brand-white rounded-[8px] hover:opacity-90 transition"
                >
                  Continue to Drinks
                </button>
              ) : (
                <button
                  onClick={() => goToStep(2)}
                  className="mt-4 px-6 py-2 bg-brand-gray-neutral text-brand-white rounded-[8px] hover:opacity-90 transition"
                >
                  Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const { currentPage, totalPages, itemsPerPage, totalItems } = menuPagination;
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="w-full max-w-[600px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
            <button
              onClick={() => {
                goToStep(2);
              }}
              className="text-brand-gray-neutral hover:text-brand-dark-green"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold text-brand-dark-green">
                {isGuestUser ? 'Select Guest Menu' : 'Select Main Meal'}
              </h2>
              <p className="text-brand-gray-neutral text-xs">
                {isGuestUser ? 'Choose from guest menu items' : 'Choose your main menu item or skip to drinks'}
              </p>
              <p className="text-[11px] text-brand-gray-neutral mt-1">
                {totalItems} items available • Session: <strong className="text-brand-dark-green">{selectedSession}</strong>
                {isGuestUser && <span className="ml-2 text-brand-gold">(Guest Menu)</span>}
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={menuSearchTerm}
              onChange={handleMenuSearchChange}
              placeholder="Search menu items..."
              className="w-full h-[44px] pl-10 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/60"
            />
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
          </div>

          {isLoadingMenu ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`menu-skeleton-${i}`} className="h-14 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : displayedMenuItems.length === 0 ? (
            <div className="text-center py-12 text-brand-gray-neutral">
              <div className="flex justify-center mb-3">
                <Coffee size={48} className="text-brand-gray-neutral/30" />
              </div>
              <p className="text-sm">
                {menuSearchTerm ? 'No menu items match your search' : 'No menu items available'}
              </p>
              {drinkAvailable && !isGuestUser && (
                <button
                  onClick={() => {
                    setMenu(null);
                    goToStep(4);
                  }}
                  className="mt-4 text-brand-gold font-medium text-sm hover:underline"
                >
                  Skip meal and go to drinks
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                {displayedMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMenu(item);
                      goToStep(4);
                    }}
                    className="w-full p-4 border border-brand-light-green rounded-[8px] hover:border-brand-gold hover:bg-brand-light-green/5 text-left flex justify-between items-center transition-all duration-200 text-brand-dark-green"
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-sm block">{item.name}</span>
                      <span className="text-[11px] text-brand-gray-neutral">
                        {item.description || (isGuestUser ? 'Guest Menu Option' : 'Cafeteria Standard Option')}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-brand-gold ml-4">
                      {(item.currentPrice || 0).toFixed(2)} ETB
                    </span>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                  <div className="text-xs text-brand-gray-neutral">
                    Showing {startIndex} - {endIndex} of {totalItems}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMenuPageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-[8px] border border-gray-300 transition ${
                        currentPage === 1
                          ? 'text-brand-gray-neutral/40 cursor-not-allowed'
                          : 'text-brand-gray-neutral hover:border-brand-dark-green hover:text-brand-dark-green'
                      }`}
                    >
                      <CaretLeft size={16} />
                    </button>
                    <span className="text-xs text-brand-dark-green font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => handleMenuPageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-[8px] border border-gray-300 transition ${
                        currentPage === totalPages
                          ? 'text-brand-gray-neutral/40 cursor-not-allowed'
                          : 'text-brand-gray-neutral hover:border-brand-dark-green hover:text-brand-dark-green'
                      }`}
                    >
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Skip meal button - only show if drinks are available and user is not a guest */}
          {!isGuestUser && drinkAvailable && displayedMenuItems.length > 0 && (
            <button
              onClick={() => {
                setMenu(null);
                goToStep(4);
              }}
              className="w-full h-[44px] border border-dashed border-gray-300 text-brand-gray-neutral font-medium text-sm rounded-[8px] hover:bg-gray-50 transition"
            >
              Skip meal and go to drinks
            </button>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 4: DRINK SELECTION
  // --------------------------------------------------------------------------
  if (cashierStep === 4) {
    if (!selectedEmployee || !selectedSession) return null;

    const { drinkAvailable } = getCurrentSessionAvailability();
    const isGuestUser = isGuest();
    
    // Determine if drinks can be skipped (only if a meal IS selected and not a guest)
    const isDrinkMandatory = !selectedMenu || isGuestUser;
    const canSkipDrinks = selectedMenu !== null && drinkAvailable && !isGuestUser;

    // If drink is not available and no meal selected, go back
    if (!drinkAvailable && !selectedMenu) {
      toast.error('No items available for this session');
      goToStep(2);
      return null;
    }

    // If drink is not available but meal is selected, show message
    if (!drinkAvailable && selectedMenu) {
      return (
        <div className="w-full max-w-[600px] mx-auto mt-4 select-none">
          <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
            <div className="text-center py-12 text-brand-gray-neutral">
              <div className="flex justify-center mb-3">
                <span className="text-6xl">🥤</span>
              </div>
              <p className="text-sm">Drink already consumed for this session</p>
              <button
                onClick={() => {
                  setSelectedDrink(null);
                  goToStep(5);
                }}
                className="mt-4 px-6 py-2 bg-brand-gold text-brand-white rounded-[8px] hover:opacity-90 transition"
              >
                Continue to Review
              </button>
            </div>
          </div>
        </div>
      );
    }

    const { currentPage, totalPages, itemsPerPage, totalItems } = drinkPagination;
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="w-full max-w-[600px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
            <button
              onClick={() => {
                setSelectedDrink(null);
                
                // If meal was available, go back to step 3, otherwise go to step 2
                const { mealAvailable } = getCurrentSessionAvailability();
                if (mealAvailable) {
                  goToStep(3);
                } else {
                  goToStep(2);
                }
              }}
              className="text-brand-gray-neutral hover:text-brand-dark-green"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold text-brand-dark-green">
                {isDrinkMandatory ? 'Select a Drink (Required)' : 'Select a Drink (Optional)'}
              </h2>
              <p className="text-brand-gray-neutral text-xs">
                {isDrinkMandatory 
                  ? isGuestUser 
                    ? 'A drink selection is required for guest transactions' 
                    : 'A drink selection is required when no meal is selected'
                  : 'Choose a drink to accompany your meal or skip this step'}
              </p>
              {selectedMenu && (
                <p className="text-[11px] text-brand-gray-neutral mt-1">
                  Meal selected: <strong className="text-brand-dark-green">{selectedMenu.name}</strong>
                </p>
              )}
              {!selectedMenu && !isGuestUser && (
                <p className="text-[11px] text-brand-error-red mt-1">
                  No meal selected - drink is mandatory
                </p>
              )}
              {isGuestUser && (
                <p className="text-[11px] text-brand-gold mt-1">
                  Guest transaction - drink is required
                </p>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={drinkSearchTerm}
              onChange={handleDrinkSearchChange}
              placeholder="Search drinks..."
              className="w-full h-[44px] pl-10 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/60"
            />
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
          </div>

          {isLoadingDrinks ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`drink-skeleton-${i}`} className="h-14 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : displayedDrinks.length === 0 ? (
            <div className="text-center py-12 text-brand-gray-neutral">
              <div className="flex justify-center mb-3">
                <span className="text-6xl">🥤</span>
              </div>
              <p className="text-sm">
                {drinkSearchTerm ? 'No drinks match your search' : 'No drink items available'}
              </p>
              {canSkipDrinks && (
                <button
                  onClick={() => {
                    setSelectedDrink(null);
                    goToStep(5);
                  }}
                  className="mt-4 text-brand-gold font-medium text-sm hover:underline"
                >
                  Skip drink selection
                </button>
              )}
              {!canSkipDrinks && (
                <p className="text-xs text-brand-error-red mt-2">
                  A drink selection is mandatory for this transaction
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                {displayedDrinks.map((drink) => (
                  <button
                    key={drink.id}
                    onClick={() => {
                      setSelectedDrink(drink);
                      goToStep(5);
                    }}
                    className={`w-full p-4 border rounded-[8px] text-left flex justify-between items-center transition-all duration-200 ${
                      selectedDrink?.id === drink.id
                        ? 'border-brand-gold bg-brand-gold/5'
                        : 'border-brand-light-green hover:border-brand-gold hover:bg-brand-light-green/5'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-semibold text-sm block text-brand-dark-green">{drink.name}</span>
                      <span className="text-[11px] text-brand-gray-neutral">
                        {drink.description || 'Refreshing beverage'}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-brand-gold ml-4">
                      {(drink.currentPrice || 0).toFixed(2)} ETB
                    </span>
                  </button>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                  <div className="text-xs text-brand-gray-neutral">
                    Showing {startIndex} - {endIndex} of {totalItems}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDrinkPageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-[8px] border border-gray-300 transition ${
                        currentPage === 1
                          ? 'text-brand-gray-neutral/40 cursor-not-allowed'
                          : 'text-brand-gray-neutral hover:border-brand-dark-green hover:text-brand-dark-green'
                      }`}
                    >
                      <CaretLeft size={16} />
                    </button>
                    <span className="text-xs text-brand-dark-green font-medium px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => handleDrinkPageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-[8px] border border-gray-300 transition ${
                        currentPage === totalPages
                          ? 'text-brand-gray-neutral/40 cursor-not-allowed'
                          : 'text-brand-gray-neutral hover:border-brand-dark-green hover:text-brand-dark-green'
                      }`}
                    >
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Conditional skip button - only for non-guest users with meal selected */}
          {canSkipDrinks && (
            <button
              onClick={() => {
                setSelectedDrink(null);
                goToStep(5);
              }}
              className="w-full h-[44px] border border-dashed border-gray-300 text-brand-gray-neutral font-medium text-sm rounded-[8px] hover:bg-gray-50 transition"
            >
              Skip drink selection
            </button>
          )}
          
          {isDrinkMandatory && displayedDrinks.length > 0 && (
            <div className="text-center">
              <p className="text-xs text-brand-error-red mb-2">
                {isGuestUser ? 'Drink selection is mandatory for guest transactions' : 'Drink selection is mandatory when no meal is selected'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 5: REVIEW AND SUBMIT
  // --------------------------------------------------------------------------
  if (cashierStep === 5) {
    if (!selectedEmployee || !selectedSession) return null;
    
    // At least one of meal or drink must be selected
    if (!selectedMenu && !selectedDrink) {
      toast.error('Please select at least a meal or a drink');
      goToStep(3);
      return null;
    }

    const basePrice = selectedMenu?.currentPrice || 0;
    const drinkPrice = selectedDrink?.currentPrice || 0;
    const totalPrice = basePrice + drinkPrice;
    const employeeShare = (totalPrice * subsidyRates.employee) / 100;
    const companyShare = (totalPrice * subsidyRates.company) / 100;

    return (
      <div className="w-full max-w-[500px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-[6px] border-t-brand-gold rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
            <button
              onClick={() => {
                setSelectedDrink(null);
                
                // If drink was available, go back to step 4
                const { drinkAvailable } = getCurrentSessionAvailability();
                if (drinkAvailable) {
                  goToStep(4);
                } else {
                  // If drink wasn't available, go back to step 3
                  goToStep(3);
                }
              }}
              className="text-brand-gray-neutral hover:text-brand-dark-green"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold text-brand-dark-green">Review Registration</h2>
              <p className="text-brand-gray-neutral text-xs">Verify billing shares before submitting</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-100 rounded-[8px]">
            <div className="w-12 h-12 bg-brand-light-green/30 text-brand-dark-green rounded-full flex items-center justify-center font-bold text-lg">
              {selectedEmployee.fullName?.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-brand-dark-green">{selectedEmployee.fullName}</h3>
              <p className="text-[11px] text-brand-gray-neutral font-mono">ID: {selectedEmployee.employeeNumber}</p>
              {isGuest() && (
                <span className="text-[10px] text-brand-gold font-medium">Guest</span>
              )}
            </div>
          </div>

          <div className="border border-brand-light-green/30 bg-[#F9FAFB]/40 p-5 rounded-[8px] space-y-3.5 text-xs text-brand-dark-green">
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Meal Session</span>
              <span className="font-semibold uppercase">{selectedSession}</span>
            </div>
            
            {selectedMenu ? (
              <>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Selected Meal</span>
                  <span className="font-semibold">{selectedMenu.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Meal Price</span>
                  <span className="font-semibold">{basePrice.toFixed(2)} ETB</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Meal</span>
                <span className="text-brand-gray-neutral italic">Skipped</span>
              </div>
            )}
            
            {selectedDrink ? (
              <>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Drink</span>
                  <span className="font-semibold">{selectedDrink.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Drink Price</span>
                  <span className="font-semibold">{drinkPrice.toFixed(2)} ETB</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Drink</span>
                <span className="text-brand-gray-neutral italic">Skipped</span>
              </div>
            )}
            
            <div className="h-[1px] bg-brand-light-green/20 my-1" />

            <div className="flex justify-between text-brand-gold">
              <span>Employee Share ({subsidyRates.employee}%)</span>
              <span className="font-bold">{employeeShare.toFixed(2)} ETB</span>
            </div>
            <div className="flex justify-between text-brand-dark-green/75">
              <span>Company Share ({subsidyRates.company}%)</span>
              <span className="font-semibold">{companyShare.toFixed(2)} ETB</span>
            </div>

            <div className="h-[1px] bg-brand-light-green/30 my-1" />

            <div className="flex justify-between text-sm font-bold pt-1">
              <span>Total Price</span>
              <span>{totalPrice.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSubmitTransaction}
              className="w-full h-[48px] bg-brand-dark-green text-brand-white font-medium text-sm rounded-[8px] hover:opacity-90 active:scale-[0.99] transition shadow-md"
            >
              Confirm & Submit Registration
            </button>
            <button
              onClick={resetCashierFlow}
              className="w-full h-[48px] border border-gray-300 text-brand-gray-neutral font-medium text-sm rounded-[8px] hover:bg-gray-50 transition"
            >
              Cancel Flow
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // STEP 6: SUCCESS RECEIPT
  // --------------------------------------------------------------------------
  if (cashierStep === 6) {
    if (!selectedEmployee || !selectedSession) return null;
    
    // At least one should be selected
    if (!selectedMenu && !selectedDrink) {
      resetCashierFlow();
      return null;
    }

    const basePrice = selectedMenu?.currentPrice || 0;
    const drinkPrice = selectedDrink?.currentPrice || 0;
    const totalPrice = basePrice + drinkPrice;
    const employeeShare = (totalPrice * subsidyRates.employee) / 100;

    return (
      <div className="w-full max-w-[500px] mx-auto mt-4 select-none">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-[6px] border-t-brand-light-green rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-8 space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle size={64} className="text-brand-dark-green mx-auto" />
            <h2 className="text-[20px] font-semibold text-brand-dark-green">Transaction Successful</h2>
            <p className="text-brand-gray-neutral text-sm font-mono bg-gray-50 px-3 py-1 rounded inline-block border border-gray-100">
              ID: {lastTransactionId || 'TXN-UNKNOWN'}
            </p>
          </div>

          <div className="border border-brand-light-green/30 bg-[#F9FAFB]/40 p-4 rounded-[8px] space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Employee</span>
              <span className="text-brand-dark-green font-semibold">{selectedEmployee.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Employee ID</span>
              <span className="text-brand-dark-green font-mono">{selectedEmployee.employeeNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Session</span>
              <span className="text-brand-dark-green font-medium uppercase">{selectedSession}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Meal</span>
              <span className="text-brand-dark-green font-medium">
                {selectedMenu ? selectedMenu.name : 'Skipped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-gray-neutral">Drink</span>
              <span className="text-brand-dark-green font-medium">
                {selectedDrink ? selectedDrink.name : 'Skipped'}
              </span>
            </div>
            <div className="h-[1px] bg-brand-light-green/30 my-1" />
            <div className="flex justify-between text-base font-bold">
              <span className="text-brand-dark-green">Amount Charged</span>
              <span className="text-brand-dark-green">{employeeShare.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="text-center text-xs text-brand-gray-neutral bg-gray-50 py-2 rounded">
            Auto-resetting page in <span className="font-semibold text-brand-dark-green font-mono">{countdown}</span>{' '}
            seconds...
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleNewRegistration}
              className="w-full h-[48px] bg-brand-gold text-brand-white font-medium text-sm rounded-[8px] hover:opacity-90 active:scale-[0.99] transition"
            >
              New Registration
            </button>
            <button
              onClick={() => {
                resetCashierFlow();
                navigate('/cashier/transactions');
              }}
              className="w-full h-[48px] border border-brand-dark-green text-brand-dark-green font-medium text-sm rounded-[8px] hover:bg-brand-dark-green/5 transition"
            >
              View Today's Transactions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CashierFlow;