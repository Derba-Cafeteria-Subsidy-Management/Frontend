import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../client/axios';
import { useApp } from '../../context/AppContext';
import {
  PaperPlane,
  MagnifyingGlass,
  Clock,
  User,
  UserCircle,
  Coffee,
  Sun,
  Moon,
  Receipt,
  X,
  PencilSimple,
  Warning,
  List,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { Transaction, MenuItem } from '../../types/api';

/**
 * TodayTransactions Component
 * Displays today's cafeteria transactions with filtering and correction request functionality
 */
export const TodayTransactions: React.FC = () => {
  const { isOffline } = useApp();

  // State for transactions and filtering
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [filterSession, setFilterSession] = useState<'All' | 'BREAKFAST' | 'LUNCH' | 'DINNER'>('All');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Correction request states
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [requestedItemId, setRequestedItemId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMenus, setIsLoadingMenus] = useState(false);

  /**
   * Fetch all menu items with pagination
   */
  const fetchAllMenuItems = async (): Promise<MenuItem[]> => {
    let allItems: MenuItem[] = [];
    let currentPage = 1;
    const pageSize = 50;

    try {
      // First, get the first page to know total pages
      const firstRes = await axiosInstance.get('/api/menus/active', {
        params: {
          page: currentPage,
          pageSize: pageSize
        }
      });

      if (!firstRes.data?.success || !firstRes.data?.data) {
        console.warn('Failed to fetch menu items');
        return [];
      }

      const firstData = firstRes.data.data;
      const firstItems = firstData.data || firstData.items || [];
      const pagination = firstData.pagination || {};

      // Get total pages from pagination
      const totalPages = pagination.totalPages || Math.ceil((pagination.totalCount || 0) / pageSize);

      console.log(`Total menu items: ${pagination.totalCount || 0}, Total pages: ${totalPages}`);

      // Add first page items
      allItems = [...firstItems];

      // Fetch remaining pages in parallel
      if (totalPages > 1) {
        const pagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(
            axiosInstance.get('/api/menus/active', {
              params: {
                page: page,
                pageSize: pageSize
              }
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

      console.log(`Total menu items fetched: ${allItems.length}`);
      return allItems;

    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  };

  /**
   * Format time in Nairobi timezone (UTC+3)
   * Uses the createdAt timestamp which contains the full date and time
   */
  const formatTime = (createdAt: string): string => {
    if (!createdAt) return '--:--';

    // If it's just a YYYY-MM-DD date string without timestamp intervals, we cannot extract time
    if (createdAt.length <= 10 && !createdAt.includes('T')) {
      return '--:--';
    }

    const date = new Date(createdAt);

    // Check for an invalid Date object
    if (isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });
  };

  /**
   * Format date in Nairobi timezone (UTC+3)
   * Uses createdAt if available (has full timestamp), otherwise falls back to transactionDate
   */
  const formatDate = (dateString: string, createdAt?: string): string => {
    const dateToUse = createdAt || dateString;
    if (!dateToUse) return 'N/A';
    const date = new Date(dateToUse);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Africa/Nairobi',
    });
  };

  /**
   * Get today's date in YYYY-MM-DD format in Nairobi timezone
   */
  const getTodayDate = (): string => {
    const today = new Date();
    return today.toLocaleDateString('en-CA', {
      timeZone: 'Africa/Nairobi'
    });
  };

  /**
   * Get the appropriate icon for a meal session
   */
  const getSessionIcon = (session: string) => {
    switch (session) {
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

  /**
   * Get the status badge style for a transaction
   */
  const getStatusBadge = (isCorrected: boolean) => {
    if (isCorrected) {
      return {
        className: 'bg-brand-warning/10 text-brand-warning',
        label: 'Pending Adjudication',
      };
    }
    return {
      className: 'bg-brand-dark-green/10 text-brand-dark-green',
      label: 'Complete',
    };
  };

  /**
   * Fetch today's transactions from the backend with date filtering
   */
  const fetchTodayTransactions = async () => {
    setLoading(true);
    try {
      // Check if offline
      if (isOffline) {
        toast.error('Currently offline. Live transactions cannot be retrieved.');
        setAllTransactions([]);
        setFilteredTransactions([]);
        setLoading(false);
        return;
      }

      const todayDate = getTodayDate();

      // Fetch transactions from API with date range filtering
      const response = await axiosInstance.get('/api/transactions', {
        params: {
          from: todayDate,
          to: todayDate
        }
      });

      if (response.data?.success && response.data?.data) {
        // Extract transaction list from response
        const list = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data.transactions || [];

        // Map and transform the transaction data
        const mappedTransactions = list.map((transaction: any) => ({
          id: transaction.id || transaction.transactionId,
          employeeId: transaction.employeeNumber || transaction.employeeId || 'N/A',
          employeeNumber: transaction.employeeNumber || transaction.employeeId || 'N/A',
          fullName: transaction.fullName || transaction.employeeName || 'Unknown',
          mealSession: transaction.mealSession || transaction.session || 'N/A',
          menuItem: transaction.menuItem || transaction.menuItemName || 'N/A',
          menuPrice: transaction.menuPrice || transaction.price || 0,
          transactionDate: transaction.transactionDate,
          createdAt: transaction.createdAt,
          correctionStatus: transaction.correctionStatus || 'COMPLETE',
        }));

        setAllTransactions(mappedTransactions);
        applyFilters(mappedTransactions, filterSession, searchTerm);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply session and search filters to transactions
   */
  const applyFilters = useCallback(
    (transactions: Transaction[], session: string, search: string) => {
      let filtered = [...transactions];

      // Apply session filter
      if (session !== 'All') {
        filtered = filtered.filter((transaction) => transaction.mealSession === session);
      }

      // Apply search filter (by name or employee number)
      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        filtered = filtered.filter(
          (transaction) =>
            transaction.fullName?.toLowerCase().includes(searchLower) ||
            transaction.employeeNumber?.toLowerCase().includes(searchLower)
        );
      }

      setFilteredTransactions(filtered);
    },
    []
  );

  /**
   * Handle correction request modal open
   * Fetches ALL menu items with pagination
   */
  const handleOpenCorrectionModal = async (transaction: Transaction) => {
    setSelectedTxn(transaction);
    setReason('');
    setRequestedItemId('');
    setAvailableMenuItems([]);
    setIsLoadingMenus(true);

    try {
      if (isOffline) {
        toast.error('Cannot retrieve menus while offline');
        setIsLoadingMenus(false);
        return;
      }

      // ✅ Fetch ALL menu items with pagination
      const allItems = await fetchAllMenuItems();

      // Filter items for the transaction's session
      const sessionMenus = allItems.filter(
        (item: MenuItem) =>
          (item as any).mealtype === transaction.mealSession &&
          item.name !== transaction.menuItem
      );

      console.log(`Found ${sessionMenus.length} menu items for session ${transaction.mealSession}`);
      setAvailableMenuItems(sessionMenus);

    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to load menu options for correction');
    } finally {
      setIsLoadingMenus(false);
    }
  };

  /**
   * Submit a correction request
   */
  const handleSubmitCorrection = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate form
    if (!selectedTxn || !requestedItemId) {
      toast.error('Please select a menu item');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please enter a reason for the correction');
      return;
    }

    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long');
      return;
    }

    if (reason.length > 250) {
      toast.error('Reason exceeds 250 characters limit');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('/api/corrections', {
        transactionId: selectedTxn.id,
        newMenuItemId: requestedItemId,
        reason: reason.trim(),
      });

      if (response.data?.success) {
        toast.success('Correction request submitted for admin review');
        setSelectedTxn(null);
        // Refresh transactions
        await fetchTodayTransactions();
      }
    } catch (error) {
      console.error('Error submitting correction:', error);
      toast.error('Failed to submit correction request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize data on mount
  useEffect(() => {
    fetchTodayTransactions();
  }, [isOffline]);

  // Re-apply filters when they change
  useEffect(() => {
    applyFilters(allTransactions, filterSession, searchTerm);
  }, [filterSession, searchTerm, allTransactions, applyFilters]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Handle session filter change
  const handleSessionFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterSession(event.target.value as any);
  };

  /**
   * Render loading skeleton
   */
  const renderLoading = () => (
    <div className="p-8 space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-12 bg-gray-50 rounded animate-pulse" />
      ))}
    </div>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="p-16 text-center select-none space-y-3">
      <div className="flex justify-center">
        <Receipt size={48} className="text-brand-gray-neutral/40" />
      </div>
      <p className="text-brand-gray-neutral text-sm">
        {searchTerm ? 'No transactions match your search' : 'No transactions recorded today'}
      </p>
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="text-brand-gold text-sm font-medium hover:underline"
        >
          Clear search
        </button>
      )}
    </div>
  );

  /**
   * Render transaction table row
   */
  const renderTransactionRow = (transaction: Transaction) => {
    const timeStr = formatTime(transaction.createdAt || transaction.transactionDate);
    const dateStr = formatDate(transaction.transactionDate, transaction.createdAt);
    const isCorrected = transaction.correctionStatus === 'PENDING_CORRECTION';
    const statusBadge = getStatusBadge(isCorrected);

    return (
      <tr
        key={transaction.id}
        className="hover:bg-brand-light-green/5 transition-colors duration-150"
      >
        {/* Time Column */}
        <td className="p-4 whitespace-nowrap">
          <div className="text-sm font-medium text-brand-dark-green">{timeStr}</div>
          <div className="text-[11px] text-brand-gray-neutral/60">{dateStr}</div>
        </td>

        {/* Employee Number Column */}
        <td className="p-4">
          <div className="flex items-center gap-2">
            <User size={14} className="text-brand-gray-neutral" />
            <span className="font-mono text-sm text-brand-dark-green">
              {transaction.employeeNumber}
            </span>
          </div>
        </td>

        {/* Name Column */}
        <td className="p-4">
          <div className="flex items-center gap-2">
            <UserCircle size={14} className="text-brand-gray-neutral" />
            <span className="font-medium text-brand-dark-green">{transaction.fullName}</span>
          </div>
        </td>

        {/* Session Column */}
        <td className="p-4">
          <span className="inline-flex items-center gap-1.5 bg-[#F3F4F6] text-brand-dark-green text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase">
            {getSessionIcon(transaction.mealSession)}
            {transaction.mealSession}
          </span>
        </td>

        {/* Menu Item Column */}
        <td className="p-4">
          <span className="text-brand-dark-green">{transaction.menuItem}</span>
        </td>

        {/* Price Column */}
        <td className="p-4 text-right">
          <span className="font-semibold text-brand-dark-green">
            {(transaction.menuPrice || 0).toFixed(2)} ETB
          </span>
        </td>

        {/* Status Column */}
        <td className="p-4 text-center">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </td>

        {/* Action Column */}
        <td className="p-4 text-center">
          {!isCorrected ? (
            <button
              onClick={() => handleOpenCorrectionModal(transaction)}
              className="inline-flex items-center gap-1.5 text-brand-gold font-medium hover:underline text-xs transition-colors"
            >
              <PencilSimple size={14} />
              Request Correction
            </button>
          ) : (
            <span className="text-brand-gray-neutral text-xs italic flex items-center justify-center gap-1">
              <Warning size={14} />
              Reviewing...
            </span>
          )}
        </td>
      </tr>
    );
  };

  // Main render
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none flex items-center gap-2">
            <List size={28} className="text-brand-gold" />
            Today's Transactions
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Showing {filteredTransactions.length} of {allTransactions.length} transactions
          </p>
        </div>

        {/* Filters Section */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name or number..."
              className="h-10 w-48 px-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white placeholder-brand-gray-neutral/60 transition-colors"
            />
            <MagnifyingGlass
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral"
            />
          </div>

          {/* Session Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[13px] font-medium text-brand-dark-green uppercase tracking-wide">
              Session:
            </label>
            <select
              value={filterSession}
              onChange={handleSessionFilterChange}
              className="h-10 px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer transition-colors"
            >
              <option value="All">All Sessions</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          renderLoading()
        ) : filteredTransactions.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                  <th className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock size={16} className="text-brand-gray-neutral" />
                      Time
                    </div>
                  </th>
                  <th className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User size={16} className="text-brand-gray-neutral" />
                      Employee Number
                    </div>
                  </th>
                  <th className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <UserCircle size={16} className="text-brand-gray-neutral" />
                      Name
                    </div>
                  </th>
                  <th className="p-4 whitespace-nowrap">Session</th>
                  <th className="p-4 whitespace-nowrap">Menu Item</th>
                  <th className="p-4 text-right whitespace-nowrap">Price</th>
                  <th className="p-4 text-center whitespace-nowrap">Status</th>
                  <th className="p-4 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map(renderTransactionRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction Request Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[480px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <PencilSimple size={20} className="text-brand-gold" />
                New Correction Request
              </h3>
              <button
                onClick={() => setSelectedTxn(null)}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            {/* Transaction Details */}
            <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-4 text-xs space-y-2 select-none">
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Transaction ID:</span>
                <span className="font-mono text-brand-dark-green font-semibold">
                  {selectedTxn.id?.substring(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Employee Number:</span>
                <span className="font-mono text-brand-dark-green font-semibold">
                  {selectedTxn.employeeNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Employee:</span>
                <span className="text-brand-dark-green font-semibold">
                  {selectedTxn.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Original Selection:</span>
                <span className="text-brand-error-red font-semibold line-through">
                  {selectedTxn.menuItem} ({(selectedTxn.menuPrice || 0).toFixed(2)} ETB)
                </span>
              </div>
            </div>

            {/* Correction Form */}
            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              {/* Menu Item Selection */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Correct Menu Item <span className="text-brand-error-red">*</span>
                </label>
                {isLoadingMenus ? (
                  <div className="h-[44px] flex items-center px-3 border border-gray-300 rounded-[8px] text-brand-gray-neutral text-sm">
                    Loading menu items...
                  </div>
                ) : (
                  <select
                    required
                    value={requestedItemId}
                    onChange={(e) => setRequestedItemId(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer transition-colors"
                  >
                    <option value="">-- Choose correct item --</option>
                    {availableMenuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({(item.currentPrice || 0).toFixed(2)} ETB)
                      </option>
                    ))}
                  </select>
                )}
                {!isLoadingMenus && availableMenuItems.length === 0 && (
                  <p className="text-[11px] text-brand-error-red">
                    No other active items found for this session.
                  </p>
                )}
                {!isLoadingMenus && availableMenuItems.length > 0 && (
                  <p className="text-[10px] text-brand-gray-neutral">
                    Showing {availableMenuItems.length} items for {selectedTxn.mealSession}
                  </p>
                )}
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[13px]">
                  <label className="font-medium text-brand-dark-green">Reason for Correction <span className="text-brand-error-red">*</span></label>
                  <span
                    className={`text-xs ${reason.length > 250 ? 'text-brand-error-red font-semibold' : 'text-brand-gray-neutral'
                      }`}
                  >
                    {reason.length}/250
                  </span>
                </div>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={250}
                  placeholder="Explain why this correction is necessary (min 10 characters)"
                  className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60 transition-colors"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !requestedItemId || !reason.trim() || reason.trim().length < 10}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-pulse">Submitting...</span>
                  </>
                ) : (
                  <>
                    <PaperPlane size={18} />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayTransactions;