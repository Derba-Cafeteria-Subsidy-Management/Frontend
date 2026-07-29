import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../../client/axios';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Coffee,
  Sun,
  Moon,
  Plus,
  Minus,
  Trash,
  MagnifyingGlass,
  Receipt,
  User,
  Clock,
  Check,
  X,
  Printer,
  CaretLeft,
  CaretRight,
  List,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { Employee, MenuItem } from '../../types/api';

export const GuestTransactionFlow: React.FC = () => {
  const { t } = useLanguage();
  const { isOffline } = useApp();

  // Tabs State
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');

  // ==========================================
  // TAB 1: REGISTER GUEST TRANSACTION STATE
  // ==========================================
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const employeeSearchRef = useRef<HTMLDivElement>(null);

  const [mealSession, setMealSession] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>('LUNCH');
  const [reason, setReason] = useState('');

  const [activeMenuItems, setActiveMenuItems] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  
  // Cart state: mapping of menuItem.id -> quantity
  const [cart, setCart] = useState<Array<{ item: MenuItem; quantity: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTransaction, setSubmittedTransaction] = useState<any | null>(null);

  // ==========================================
  // TAB 2: TRANSACTION HISTORY STATE
  // ==========================================
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 50;

  // Detail Modal State
  const [selectedHistoryTxnId, setSelectedHistoryTxnId] = useState<string | null>(null);
  const [historyTxnDetail, setHistoryTxnDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // ==========================================
  // CLICK OUTSIDE SEARCH RESULTS HANDLER
  // ==========================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeSearchRef.current && !employeeSearchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==========================================
  // EMPLOYEE LOOKUP DEBOUNCED SEARCH
  // ==========================================
  const fetchEmployees = async (search: string) => {
    const cleanSearch = search.trim();
    if (cleanSearch.length < 2) {
      setEmployeeResults([]);
      return;
    }

    setIsSearchingEmployees(true);
    try {
      const params: any = { page: 1, limit: 10 };
      if (/^EMP-\d+$/.test(cleanSearch) || /^\d+$/.test(cleanSearch)) {
        params.employeeNumber = cleanSearch;
      } else {
        params.name = cleanSearch;
      }

      const res = await axiosInstance.get('/api/employees', { params });
      if (res.data?.success && res.data?.data) {
        setEmployeeResults(res.data.data.employees || []);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error('Failed to search employees:', err);
    } finally {
      setIsSearchingEmployees(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (employeeSearch) {
        fetchEmployees(employeeSearch);
      } else {
        setEmployeeResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [employeeSearch]);

  // ==========================================
  // ACTIVE GUEST MENU ITEMS FETCH
  // ==========================================
  const fetchGuestMenuItems = useCallback(async () => {
    setIsLoadingMenu(true);
    try {
      if (isOffline) {
        toast.error('Currently offline. Menu options cannot be retrieved.');
        setIsLoadingMenu(false);
        return;
      }

      const res = await axiosInstance.get('/api/menus/active', {
        params: { page: 1, pageSize: 100, audience: 'GUEST' },
      });

      if (res.data?.success && res.data?.data) {
        const items = res.data.data.data || res.data.data.items || [];
        const mapped = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          mealtype: (item.mealtype || item.mealType || 'LUNCH').toUpperCase(),
          currentPrice: item.currentPrice || item.price || 0,
          active: item.active !== undefined ? item.active : true,
        }));
        setActiveMenuItems(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch menu items:', err);
      toast.error('Failed to load guest menu items');
    } finally {
      setIsLoadingMenu(false);
    }
  }, [isOffline]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchGuestMenuItems();
    }
  }, [activeTab, fetchGuestMenuItems]);

  // ==========================================
  // CART ACTIONS
  // ==========================================
  const handleUpdateCartQuantity = (item: MenuItem, change: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        const newQty = existing.quantity + change;
        if (newQty <= 0) {
          return prev.filter((c) => c.item.id !== item.id);
        }
        return prev.map((c) => (c.item.id === item.id ? { ...c, quantity: newQty } : c));
      } else if (change > 0) {
        return [...prev, { item, quantity: 1 }];
      }
      return prev;
    });
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const getCartTotalAmount = () => {
    return cart.reduce((total, cartItem) => total + cartItem.item.currentPrice * cartItem.quantity, 0);
  };

  const getCartTotalQuantity = () => {
    return cart.reduce((total, cartItem) => total + cartItem.quantity, 0);
  };

  // ==========================================
  // TRANSACTION SUBMISSION (POST)
  // ==========================================
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployee) {
      toast.error('Please select an inviting employee');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please enter a reason for the guest visit');
      return;
    }

    if (reason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }

    if (cart.length === 0) {
      toast.error('Please add at least one menu item to the cart');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        invitedByEmployeeId: selectedEmployee.id,
        reason: reason.trim(),
        mealSession: mealSession,
        items: cart.map((cartItem) => ({
          menuItemId: cartItem.item.id,
          quantity: cartItem.quantity,
        })),
      };

      const res = await axiosInstance.post('/api/guest-transactions', payload);
      if (res.data?.success && res.data?.data) {
        toast.success('Guest transaction registered successfully!');
        setSubmittedTransaction(res.data.data);
        
        // Reset registration states
        setSelectedEmployee(null);
        setEmployeeSearch('');
        setReason('');
        setCart([]);
      }
    } catch (err: any) {
      console.error('Failed to submit guest transaction:', err);
      // axios interceptor will already toast the error if it contains response.data.message
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // TRANSACTION HISTORY GET
  // ==========================================
  const fetchTransactionHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      if (isOffline) {
        toast.error('Offline. Guest transaction history cannot be retrieved.');
        setHistoryLoading(false);
        return;
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayFormatted = today.toISOString().split('T')[0];

      const res = await axiosInstance.get('/api/guest-transactions', {
        params: { 
          page: currentPage, 
          limit: itemsPerPage,
          from: todayFormatted,
          to: todayFormatted
        },
      });

      if (res.data?.success && res.data?.data) {
        const transactionsList = res.data.data.transactions || [];
        setHistoryTransactions(transactionsList);

        const total = res.data.data.pagination?.total || res.data.data.totalCount || res.data.data.total || transactionsList.length;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / itemsPerPage) || 1);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      toast.error('Failed to load guest transaction history');
    } finally {
      setHistoryLoading(false);
    }
  }, [currentPage, isOffline]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchTransactionHistory();
    }
  }, [activeTab, fetchTransactionHistory]);

  // ==========================================
  // FETCH DETAILS OF TRANSACTION (GET ID)
  // ==========================================
  const fetchTransactionDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    setHistoryTxnDetail(null);
    try {
      const res = await axiosInstance.get(`/api/guest-transactions/${id}`);
      if (res.data?.success && res.data?.data) {
        setHistoryTxnDetail(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch transaction details:', err);
      toast.error('Failed to load transaction details');
      setSelectedHistoryTxnId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHistoryTxnId) {
      fetchTransactionDetail(selectedHistoryTxnId);
    }
  }, [selectedHistoryTxnId, fetchTransactionDetail]);

  // ==========================================
  // HELPERS
  // ==========================================
  const getSessionIcon = (session: string) => {
    switch (session.toUpperCase()) {
      case 'BREAKFAST':
        return <Coffee size={16} className="text-brand-gold" />;
      case 'LUNCH':
        return <Sun size={16} className="text-brand-gold" />;
      case 'DINNER':
        return <Moon size={16} className="text-brand-gold" />;
      default:
        return <Clock size={16} className="text-brand-gray-neutral" />;
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Africa/Nairobi',
    });
  };

  const formatTime = (dateString: string): string => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });
  };

  // Filter menu items based on session & type
  const sessionMeals = activeMenuItems.filter(
    (item) => (item.mealtype as string) === mealSession && (item.mealtype as string) !== 'DRINK'
  );
  
  const drinks = activeMenuItems.filter(
    (item) => (item.mealtype as string) === 'DRINK'
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none flex items-center gap-2">
            <Receipt size={28} className="text-brand-gold" />
            {t('Guest Transactions')}
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            {t('Register meals for external guests and audit history')}
          </p>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-gray-100 rounded-full p-1 border border-gray-200 select-none">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-brand-dark-green text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t('Register Guest Meal')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-brand-dark-green text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t('Guest Transactions History')}
          </button>
        </div>
      </div>

      {/* ==========================================
          TAB 1: REGISTER GUEST TRANSACTION FORM
          ========================================== */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Config */}
          <div className="lg:col-span-5 space-y-6">
            {/* Inviting Employee Search */}
            <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
              <h3 className="text-brand-dark-green font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-brand-gold" />
                1. {t('Inviting Employee')}
              </h3>

              {!selectedEmployee ? (
                <div ref={employeeSearchRef} className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder={t('Search Employee...')}
                      className="w-full h-11 px-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white placeholder-brand-gray-neutral/60 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      {isSearchingEmployees ? (
                        <svg className="animate-spin h-5 w-5 text-brand-dark-green" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <MagnifyingGlass size={18} className="text-brand-gray-neutral" />
                      )}
                    </div>
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSearchResults && employeeResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-[8px] shadow-lg z-20 divide-y divide-gray-100">
                      {employeeResults.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowSearchResults(false);
                            setEmployeeSearch('');
                          }}
                          className="w-full text-left p-3 hover:bg-brand-light-green/10 transition-colors flex items-center justify-between text-sm cursor-pointer"
                        >
                          <div>
                            <div className="font-semibold text-brand-dark-green">{emp.fullName}</div>
                            <div className="text-xs text-brand-gray-neutral font-mono">{emp.employeeNumber}</div>
                          </div>
                          {emp.department && (
                            <span className="text-[11px] bg-gray-100 text-brand-dark-green px-2 py-0.5 rounded font-medium">
                              {emp.department}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {showSearchResults && employeeSearch.trim().length >= 2 && employeeResults.length === 0 && !isSearchingEmployees && (
                    <div className="absolute left-0 right-0 mt-1 p-3 bg-white border border-gray-200 rounded-[8px] shadow-lg z-20 text-center text-xs text-brand-gray-neutral">
                      No employees found matching search.
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Employee Card */
                <div className="bg-brand-light-green/5 border border-brand-light-green/20 rounded-[8px] p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-brand-gold font-semibold uppercase tracking-wider">
                      <Check size={12} weight="bold" />
                      Selected
                    </div>
                    <div className="font-semibold text-brand-dark-green">{selectedEmployee.fullName}</div>
                    <div className="text-xs text-brand-gray-neutral font-mono">{selectedEmployee.employeeNumber}</div>
                    {selectedEmployee.department && (
                      <div className="text-xs text-brand-gray-neutral">{selectedEmployee.department}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployee(null)}
                    className="text-xs text-brand-error-red font-medium hover:underline focus:outline-none cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Session & Reason */}
            <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-5">
              <div className="space-y-3">
                <h3 className="text-brand-dark-green font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-brand-gold" />
                  2. {t('Session')}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((session) => {
                    const isSelected = mealSession === session;
                    const label = session === 'BREAKFAST' ? t('Breakfast') : session === 'LUNCH' ? t('Lunch') : t('Dinner');
                    const icon = session === 'BREAKFAST' ? <Coffee size={18} /> : session === 'LUNCH' ? <Sun size={18} /> : <Moon size={18} />;

                    return (
                      <button
                        key={session}
                        type="button"
                        onClick={() => setMealSession(session)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-[8px] border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-dark-green text-white border-brand-dark-green shadow-sm'
                            : 'border-gray-200 bg-brand-white text-brand-dark-green hover:bg-gray-50'
                        }`}
                      >
                        {icon}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <h3 className="text-brand-dark-green font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                    <List size={16} className="text-brand-gold" />
                    3. {t('Reason for Visit')}
                  </h3>
                  <span className={`text-[11px] ${reason.length > 250 ? 'text-brand-error-red font-semibold' : 'text-brand-gray-neutral'}`}>
                    {reason.length}/250
                  </span>
                </div>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={250}
                  placeholder={t('Enter reason for visit...')}
                  className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Menu Items Selection & Cart */}
          <div className="lg:col-span-7 space-y-6">
            {/* Guest Menu List */}
            <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
              <h3 className="text-brand-dark-green font-semibold text-sm uppercase tracking-wider flex items-center gap-2 select-none">
                <Receipt size={16} className="text-brand-gold" />
                4. {t('Guest Menu Items')}
              </h3>

              {isLoadingMenu ? (
                <div className="py-8 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-14 bg-gray-50 rounded-[8px] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Meals Group */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-brand-gold uppercase tracking-wider border-b border-gray-100 pb-1 flex items-center gap-1 select-none">
                      {getSessionIcon(mealSession)}
                      <span>{mealSession} {t('Meals')}</span>
                    </div>

                    {sessionMeals.length === 0 ? (
                      <p className="text-xs text-brand-gray-neutral italic py-2">
                        {t('No guest menu items available for this session')}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {sessionMeals.map((item) => {
                          const cartEntry = cart.find((c) => c.item.id === item.id);
                          const quantity = cartEntry?.quantity || 0;

                          return (
                            <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold text-brand-dark-green">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-brand-gray-neutral line-clamp-1">{item.description}</div>
                                )}
                                <div className="text-xs font-semibold text-brand-gold font-mono">
                                  {item.currentPrice.toFixed(2)} ETB
                                </div>
                              </div>

                              {/* Stepper */}
                              <div className="flex items-center gap-2 shrink-0">
                                {quantity > 0 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCartQuantity(item, -1)}
                                      className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-brand-dark-green hover:bg-gray-50 cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="w-8 text-center text-sm font-bold text-brand-dark-green font-mono">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCartQuantity(item, 1)}
                                      className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-brand-dark-green hover:bg-gray-50 cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartQuantity(item, 1)}
                                    className="px-3 py-1.5 text-xs font-semibold border border-brand-dark-green text-brand-dark-green rounded-[6px] hover:bg-brand-dark-green/5 cursor-pointer active:scale-95 transition-all"
                                  >
                                    {t('Add')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Drinks Group */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-brand-gold uppercase tracking-wider border-b border-gray-100 pb-1 select-none">
                      🥤 {t('Drinks & Beverages')}
                    </div>

                    {drinks.length === 0 ? (
                      <p className="text-xs text-brand-gray-neutral italic py-2">
                        No guest drinks available
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {drinks.map((item) => {
                          const cartEntry = cart.find((c) => c.item.id === item.id);
                          const quantity = cartEntry?.quantity || 0;

                          return (
                            <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold text-brand-dark-green">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-brand-gray-neutral line-clamp-1">{item.description}</div>
                                )}
                                <div className="text-xs font-semibold text-brand-gold font-mono">
                                  {item.currentPrice.toFixed(2)} ETB
                                </div>
                              </div>

                              {/* Stepper */}
                              <div className="flex items-center gap-2 shrink-0">
                                {quantity > 0 ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCartQuantity(item, -1)}
                                      className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-brand-dark-green hover:bg-gray-50 cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="w-8 text-center text-sm font-bold text-brand-dark-green font-mono">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateCartQuantity(item, 1)}
                                      className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-brand-dark-green hover:bg-gray-50 cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCartQuantity(item, 1)}
                                    className="px-3 py-1.5 text-xs font-semibold border border-brand-dark-green text-brand-dark-green rounded-[6px] hover:bg-brand-dark-green/5 cursor-pointer active:scale-95 transition-all"
                                  >
                                    {t('Add')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cart Summary */}
            <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex justify-between items-center select-none">
                <h3 className="text-brand-dark-green font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  🛒 {t('Items in Cart')} ({getCartTotalQuantity()})
                </h3>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-xs text-brand-error-red hover:underline flex items-center gap-1 cursor-pointer focus:outline-none"
                  >
                    <Trash size={14} />
                    {t('Clear Cart')}
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-[8px] text-brand-gray-neutral/60 text-sm select-none">
                  Cart is empty. Select guest items from above.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected list */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 pr-1">
                    {cart.map((cartItem) => (
                      <div key={cartItem.item.id} className="py-2.5 flex justify-between items-center text-sm">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-brand-dark-green">{cartItem.item.name}</span>
                          <div className="text-xs text-brand-gray-neutral">
                            {cartItem.quantity} × {cartItem.item.currentPrice.toFixed(2)} ETB
                          </div>
                        </div>
                        <span className="font-bold text-brand-dark-green font-mono">
                          {(cartItem.item.currentPrice * cartItem.quantity).toFixed(2)} ETB
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pricing breakdown */}
                  <div className="bg-gray-50 rounded-[8px] p-4 text-sm space-y-2 select-none border border-gray-100">
                    <div className="flex justify-between font-semibold text-brand-dark-green">
                      <span>Total Items:</span>
                      <span className="font-mono">{getCartTotalQuantity()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-brand-dark-green text-base border-t border-gray-200 pt-2">
                      <span>{t('Total Amount')}:</span>
                      <span className="text-brand-gold font-mono">{getCartTotalAmount().toFixed(2)} ETB</span>
                    </div>
                  </div>

                  {/* Submission form */}
                  <form onSubmit={handleSubmitTransaction}>
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedEmployee || !reason.trim() || reason.trim().length < 5 || cart.length === 0}
                      className="w-full h-12 bg-brand-gold text-brand-white rounded-[8px] font-semibold text-sm hover:opacity-90 transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{t('Submitting...')}</span>
                        </>
                      ) : (
                        <>
                          <Check size={18} weight="bold" />
                          <span>{t('Submit Guest Transaction')}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: GUEST TRANSACTION HISTORY
          ========================================== */}
      {activeTab === 'history' && (
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Today's filter indicator */}
          <div className="bg-brand-light-green/5 border-b border-brand-light-green/20 px-4 py-2 flex items-center gap-2">
            <Clock size={14} className="text-brand-gold" />
            <span className="text-xs text-brand-dark-green font-medium">
              Showing today's transactions ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
            </span>
          </div>
          
          {historyLoading ? (
            /* Loading skeletons */
            <div className="p-8 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : historyTransactions.length === 0 ? (
            /* Empty State */
            <div className="p-16 text-center select-none space-y-3">
              <div className="flex justify-center">
                <Receipt size={48} className="text-brand-gray-neutral/40" />
              </div>
              <p className="text-brand-gray-neutral text-sm">
                No guest transactions recorded today.
              </p>
            </div>
          ) : (
            /* History Table */
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                      <th className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={16} className="text-brand-gray-neutral" />
                          Time
                        </div>
                      </th>
                      <th className="p-4 whitespace-nowrap">Transaction ID</th>
                      <th className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User size={16} className="text-brand-gray-neutral" />
                          Invited By (Employee)
                        </div>
                      </th>
                      <th className="p-4 whitespace-nowrap">Session</th>
                      <th className="p-4 whitespace-nowrap">Reason</th>
                      <th className="p-4 text-center whitespace-nowrap">Total Qty</th>
                      <th className="p-4 text-right whitespace-nowrap">Total Amount</th>
                      <th className="p-4 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyTransactions.map((tx) => {
                      const timeStr = formatTime(tx.createdAt || tx.transactionDate);
                      const dateStr = formatDate(tx.transactionDate || tx.createdAt);
                      
                      return (
                        <tr key={tx.transactionId || tx.id} className="hover:bg-brand-light-green/5 transition-colors duration-150">
                          <td className="p-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-brand-dark-green">{timeStr}</div>
                            <div className="text-[11px] text-brand-gray-neutral/60">{dateStr}</div>
                          </td>
                          <td className="p-4 whitespace-nowrap font-mono text-xs text-brand-dark-green">
                            {tx.transactionId || tx.id}
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-brand-dark-green">
                              {tx.invitedEmployee?.fullName || 'N/A'}
                            </div>
                            <div className="text-xs text-brand-gray-neutral font-mono">
                              {tx.invitedEmployee?.employeeNumber || 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 bg-[#F3F4F6] text-brand-dark-green text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase">
                              {getSessionIcon(tx.session || tx.mealSession)}
                              {tx.session || tx.mealSession}
                            </span>
                          </td>
                          <td className="p-4 max-w-[200px] truncate text-brand-dark-green" title={tx.reason}>
                            {tx.reason}
                          </td>
                          <td className="p-4 text-center font-mono text-sm text-brand-dark-green">
                            {tx.totalQuantity || tx.totalQty || 0}
                          </td>
                          <td className="p-4 text-right font-semibold font-mono text-brand-gold">
                            {(tx.totalAmount || tx.amount || 0).toFixed(2)} ETB
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedHistoryTxnId(tx.transactionId || tx.id)}
                              className="text-xs text-brand-gold font-medium hover:underline focus:outline-none cursor-pointer"
                            >
                              View Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 select-none">
                  <span className="text-sm text-brand-gray-neutral">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <CaretLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-8 min-w-[32px] px-2 flex items-center justify-center rounded-[6px] border transition-colors cursor-pointer text-xs font-semibold ${
                            currentPage === pageNum
                              ? 'bg-brand-gold text-brand-white border-brand-gold'
                              : 'border-gray-300 text-brand-dark-green hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <CaretRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL 1: SUBMISSION SUCCESS RECEIPT
          ========================================== */}
      {submittedTransaction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-white rounded-[12px] border border-[rgba(50,100,50,0.15)] shadow-2xl p-6 max-w-[440px] w-full max-h-[90vh] overflow-y-auto space-y-6">
            
            {/* Success Banner */}
            <div className="text-center space-y-2 select-none border-b border-gray-100 pb-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-brand-dark-green/10 text-brand-dark-green">
                <Check size={26} weight="bold" />
              </div>
              <h2 className="text-brand-dark-green font-bold text-lg">{t('Transaction successful!')}</h2>
              <p className="text-brand-gray-neutral text-xs">
                Transaction ID: <span className="font-mono font-semibold">{submittedTransaction.transactionId}</span>
              </p>
            </div>

            {/* Printable Receipt Layout */}
            <div className="bg-gray-50 border border-gray-200 rounded-[8px] p-5 space-y-4 text-xs font-sans">
              <div className="text-center font-bold text-sm text-brand-dark-green uppercase border-b border-dashed border-gray-300 pb-2 select-none">
                {t('Derba MIDROC Cement Cafeteria')}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">Date:</span>
                  <span className="font-semibold text-brand-dark-green">
                    {formatDate(submittedTransaction.createdAt)} {formatTime(submittedTransaction.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">{t('Inviting Employee')}:</span>
                  <span className="font-semibold text-brand-dark-green text-right">
                    {submittedTransaction.invitedEmployee?.fullName} ({submittedTransaction.invitedEmployee?.employeeNumber})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">Cashier Username:</span>
                  <span className="font-semibold text-brand-dark-green">
                    {submittedTransaction.cashier?.username || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">{t('Session')}:</span>
                  <span className="font-semibold text-brand-dark-green uppercase">
                    {submittedTransaction.session || submittedTransaction.mealSession}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">{t('Reason')}:</span>
                  <span className="font-semibold text-brand-dark-green max-w-[200px] text-right italic break-words">
                    {submittedTransaction.reason}
                  </span>
                </div>
              </div>

              {/* Totals Box */}
              <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 select-none">
                <div className="flex justify-between text-brand-dark-green">
                  <span>Guest Quantity:</span>
                  <span className="font-bold font-mono">{submittedTransaction.totalQuantity}</span>
                </div>
                <div className="flex justify-between text-brand-dark-green font-bold text-sm border-t border-gray-200 pt-1.5">
                  <span>{t('Total Amount')}:</span>
                  <span className="font-mono text-brand-gold">{(submittedTransaction.totalAmount || 0).toFixed(2)} ETB</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 border border-brand-dark-green text-brand-dark-green rounded-[8px] font-semibold text-sm hover:bg-brand-dark-green/5 transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
              >
                <Printer size={16} />
                {t('Print')}
              </button>
              <button
                type="button"
                onClick={() => setSubmittedTransaction(null)}
                className="flex-1 h-11 bg-brand-dark-green text-white rounded-[8px] font-semibold text-sm hover:opacity-90 transition flex items-center justify-center cursor-pointer focus:outline-none"
              >
                {t('Close')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: HISTORY DETAIL RECEIPT
          ========================================== */}
      {selectedHistoryTxnId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-white rounded-[12px] border border-[rgba(50,100,50,0.15)] shadow-2xl p-6 max-w-[480px] w-full max-h-[90vh] overflow-y-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <Receipt size={22} className="text-brand-gold" />
                {t('Transaction Receipt')}
              </h3>
              <button
                onClick={() => {
                  setSelectedHistoryTxnId(null);
                  setHistoryTxnDetail(null);
                }}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-12 flex justify-center">
                <svg className="animate-spin h-8 w-8 text-brand-dark-green" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : historyTxnDetail ? (
              <div className="space-y-5">
                {/* Printable receipt segment */}
                <div className="bg-gray-50 border border-gray-200 rounded-[8px] p-5 space-y-4 text-xs font-sans">
                  <div className="text-center font-bold text-sm text-brand-dark-green uppercase border-b border-dashed border-gray-300 pb-2 select-none">
                    {t('Derba MIDROC Cement Cafeteria')}
                  </div>

                  {/* Info fields */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Transaction ID:</span>
                      <span className="font-mono font-semibold text-brand-dark-green">{historyTxnDetail.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Date:</span>
                      <span className="font-semibold text-brand-dark-green">
                        {formatDate(historyTxnDetail.createdAt)} {formatTime(historyTxnDetail.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">{t('Inviting Employee')}:</span>
                      <span className="font-semibold text-brand-dark-green text-right">
                        {historyTxnDetail.invitedEmployee?.fullName} ({historyTxnDetail.invitedEmployee?.employeeNumber})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Cashier Username:</span>
                      <span className="font-semibold text-brand-dark-green">
                        {historyTxnDetail.cashier?.username || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">{t('Session')}:</span>
                      <span className="font-semibold text-brand-dark-green uppercase">
                        {historyTxnDetail.session || historyTxnDetail.mealSession}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">{t('Reason')}:</span>
                      <span className="font-semibold text-brand-dark-green max-w-[200px] text-right italic break-words">
                        {historyTxnDetail.reason}
                      </span>
                    </div>
                  </div>

                  {/* Items breakdown list */}
                  <div className="border-t border-dashed border-gray-300 pt-3">
                    <div className="text-[10px] font-bold text-brand-gold uppercase tracking-wider mb-2 select-none">
                      Registered Items
                    </div>
                    <table className="w-full text-left font-sans">
                      <thead>
                        <tr className="border-b border-gray-200 text-brand-dark-green font-semibold select-none">
                          <th className="pb-1 text-left">Item Name</th>
                          <th className="pb-1 text-center">Qty</th>
                          <th className="pb-1 text-right">Price</th>
                          <th className="pb-1 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historyTxnDetail.items?.map((itemObj: any, index: number) => (
                          <tr key={index} className="text-brand-dark-green">
                            <td className="py-1.5">{itemObj.menuItem?.name || 'N/A'}</td>
                            <td className="py-1.5 text-center font-mono">{itemObj.quantity}</td>
                            <td className="py-1.5 text-right font-mono">{itemObj.unitPrice.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-mono">{(itemObj.unitPrice * itemObj.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 select-none">
                    <div className="flex justify-between text-brand-dark-green">
                      <span>Total Quantity:</span>
                      <span className="font-bold font-mono">
                        {historyTxnDetail.totals?.totalQuantity || historyTxnDetail.totalQuantity}
                      </span>
                    </div>
                    <div className="flex justify-between text-brand-dark-green">
                      <span>Company Expense Share:</span>
                      <span className="font-semibold font-mono">
                        {(historyTxnDetail.totals?.totalCompanyExpense || historyTxnDetail.totalAmount || 0).toFixed(2)} ETB
                      </span>
                    </div>
                    <div className="flex justify-between text-brand-dark-green font-bold text-sm border-t border-gray-200 pt-1.5">
                      <span>{t('Total Amount')}:</span>
                      <span className="font-mono text-brand-gold">
                        {(historyTxnDetail.totals?.totalCompanyExpense || historyTxnDetail.totalAmount || 0).toFixed(2)} ETB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Print action */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full h-11 border border-brand-dark-green text-brand-dark-green rounded-[8px] font-semibold text-sm hover:bg-brand-dark-green/5 transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
                >
                  <Printer size={16} />
                  {t('Print')}
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-brand-error-red">
                Failed to load transaction data.
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default GuestTransactionFlow;