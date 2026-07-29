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
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';

/**
 * TodayTransactions Component
 * Displays today's cafeteria transactions with filtering and correction request functionality
 */
export const TodayTransactions: React.FC = () => {
  const { isOffline } = useApp();

  // State for transactions and filtering
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [filterSession, setFilterSession] = useState<'All' | 'BREAKFAST' | 'LUNCH' | 'DINNER'>('All');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Correction request states
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [availableMenuItems, setAvailableMenuItems] = useState<any[]>([]);
  const [availableDrinkItems, setAvailableDrinkItems] = useState<any[]>([]);
  const [requestedItemId, setRequestedItemId] = useState<string>('');
  const [requestedDrinkId, setRequestedDrinkId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMenus, setIsLoadingMenus] = useState(false);

  /**
   * Fetch all menu items with pagination
   */
  const fetchAllMenuItems = async (): Promise<any[]> => {
    let allItems: any[] = [];
    let currentPage = 1;
    const pageSize = 50;

    try {
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

      const totalPages = pagination.totalPages || Math.ceil((pagination.totalCount || 0) / pageSize);

      allItems = [...firstItems];

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

      return allItems;

    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  };

  /**
   * Format time in Nairobi timezone (UTC+3)
   */
  const formatTime = (createdAt: string): string => {
    if (!createdAt) return '--:--';

    if (createdAt.length <= 10 && !createdAt.includes('T')) {
      return '--:--';
    }

    const date = new Date(createdAt);

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
  const getStatusBadge = (correctionStatus: string) => {
    if (correctionStatus === 'PENDING_CORRECTION') {
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
   * Extract meal and drink from items array
   */
  const extractItems = (items: any[]) => {
    let mealItem: any = null;
    let drinkItem: any = null;
    let mealPrice = 0;
    let drinkPrice = 0;

    if (items && Array.isArray(items) && items.length > 0) {
      items.forEach((item: any) => {
        // Get the item name - could be in item.menuItem.name or item.name
        const itemName = item?.menuItem?.name || item?.name || '';
        
        // Check if it's a drink based on name
        const isDrink = 
          itemName.toLowerCase().includes('drink') ||
          itemName.toLowerCase().includes('juice') ||
          itemName.toLowerCase().includes('soda') ||
          itemName.toLowerCase().includes('water') ||
          itemName.toLowerCase().includes('coffee') ||
          itemName.toLowerCase().includes('tea') ||
          itemName.toLowerCase().includes('milk') ||
          itemName.toLowerCase().includes('smoothie');

        if (isDrink) {
          drinkItem = item;
          drinkPrice = item.menuPrice || 0;
        } else {
          mealItem = item;
          mealPrice = item.menuPrice || 0;
        }
      });
    }

    return { mealItem, drinkItem, mealPrice, drinkPrice };
  };

  /**
   * Fetch today's transactions from the backend with date filtering
   */
  const fetchTodayTransactions = async () => {
    setLoading(true);
    try {
      if (isOffline) {
        toast.error('Currently offline. Live transactions cannot be retrieved.');
        setAllTransactions([]);
        setFilteredTransactions([]);
        setLoading(false);
        return;
      }

      const todayDate = getTodayDate();

      const response = await axiosInstance.get('/api/transactions', {
        params: {
          from: todayDate,
          to: todayDate,
          page: currentPage,
          pageSize: itemsPerPage
        }
      });

      if (response.data?.success && response.data?.data) {
        const list = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data.transactions || [];
        
        // Extract pagination info
        const pagination = response.data.data.pagination || {};
        const total = pagination.totalCount || pagination.total || list.length;
        const totalPg = pagination.totalPages || Math.ceil(total / itemsPerPage);
        
        setTotalItems(total);
        setTotalPages(totalPg);

        const mappedTransactions = list.map((transaction: any) => {
          // Extract meal and drink from items array
          const { mealItem, drinkItem, mealPrice, drinkPrice } = extractItems(transaction.items || []);
          
          // Get the names safely with type assertions
          const mealName = (mealItem as any)?.menuItem?.name || (mealItem as any)?.name || 'N/A';
          const drinkName = (drinkItem as any)?.menuItem?.name || (drinkItem as any)?.name || null;
          
          return {
            id: transaction.id || transaction.transactionId,
            employeeId: transaction.employeeId || 'N/A',
            employeeNumber: transaction.employeeNumber || 'N/A',
            fullName: transaction.fullName || 'Unknown',
            mealSession: transaction.mealSession || 'N/A',
            // Meal info
            menuItem: mealName,
            menuPrice: mealPrice || 0,
            // Drink info
            drinkItem: drinkName,
            drinkPrice: drinkPrice || 0,
            // Other fields
            items: transaction.items || [],
            totalMenuPrice: transaction.totalMenuPrice || 0,
            totalEmployeeShare: transaction.totalEmployeeShare || 0,
            totalCompanyShare: transaction.totalCompanyShare || 0,
            transactionDate: transaction.transactionDate,
            createdAt: transaction.createdAt,
            correctionStatus: transaction.correctionStatus || 'COMPLETE',
          };
        });

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
    (transactions: any[], session: string, search: string) => {
      let filtered = [...transactions];

      if (session !== 'All') {
        filtered = filtered.filter((transaction) => transaction.mealSession === session);
      }

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
   */
  const handleOpenCorrectionModal = async (transaction: any) => {
    setSelectedTxn(transaction);
    setReason('');
    setRequestedItemId('');
    setRequestedDrinkId('');
    setAvailableMenuItems([]);
    setAvailableDrinkItems([]);
    setIsLoadingMenus(true);

    try {
      if (isOffline) {
        toast.error('Cannot retrieve menus while offline');
        setIsLoadingMenus(false);
        return;
      }

      const allItems = await fetchAllMenuItems();

      // Filter meal items (non-drinks)
      const sessionMenus = allItems.filter(
        (item: any) => {
          const lowerName = item.name.toLowerCase();
          const lowerDesc = item.description?.toLowerCase() || '';
          const isDrink = 
            lowerName.includes('drink') ||
            lowerName.includes('juice') ||
            lowerName.includes('soda') ||
            lowerName.includes('water') ||
            lowerName.includes('coffee') ||
            lowerName.includes('tea') ||
            lowerName.includes('milk') ||
            lowerName.includes('smoothie') ||
            lowerDesc.includes('drink') ||
            lowerDesc.includes('beverage');
          
          return item.mealtype === "BREAKFAST" ||
                 item.mealtype === "LUNCH" ||
                 item.mealtype === "DINNER" && 
                 item.name !== transaction.menuItem && 
                 !isDrink;
        }
      );

      // Filter drink items
      const drinkItems = allItems.filter(
        (item: any) => {
          const lowerName = item.name.toLowerCase();
          const lowerDesc = item.description?.toLowerCase() || '';
          return (
            lowerName.includes('drink') ||
            lowerName.includes('juice') ||
            lowerName.includes('soda') ||
            lowerName.includes('water') ||
            lowerName.includes('coffee') ||
            lowerName.includes('tea') ||
            lowerName.includes('milk') ||
            lowerName.includes('smoothie') ||
            lowerDesc.includes('drink') ||
            lowerDesc.includes('beverage')
          );
        }
      );

      setAvailableMenuItems(sessionMenus);
      setAvailableDrinkItems(drinkItems);

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

    if (!selectedTxn) {
      toast.error('No transaction selected');
      return;
    }

    if (!requestedItemId && !requestedDrinkId) {
      toast.error('Please select at least one item to correct (meal or drink)');
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
      // The API expects corrections to be submitted per item
      // We need to send separate requests for meal and drink if both are selected
      
      if (requestedItemId) {
        // Find the meal item from the transaction's items array to get its transactionItemId
        const mealTransactionItem = selectedTxn.items?.find((item: any) => {
          const itemName = item?.menuItem?.name || item?.name || '';
          const isDrink = 
            itemName.toLowerCase().includes('drink') ||
            itemName.toLowerCase().includes('juice') ||
            itemName.toLowerCase().includes('soda') ||
            itemName.toLowerCase().includes('water') ||
            itemName.toLowerCase().includes('coffee') ||
            itemName.toLowerCase().includes('tea') ||
            itemName.toLowerCase().includes('milk') ||
            itemName.toLowerCase().includes('smoothie');
          return !isDrink;
        });

        if (mealTransactionItem?.id) {
          const mealCorrectionData = {
            transactionId: mealTransactionItem.id, // Use the transaction item ID
            newMenuItemId: requestedItemId,
            reason: reason.trim(),
          };

          await axiosInstance.post('/api/corrections', mealCorrectionData);
        } else {
          console.warn('Could not find meal transaction item ID');
        }
      }
      
      if (requestedDrinkId) {
        // Find the drink item from the transaction's items array to get its transactionItemId
        const drinkTransactionItem = selectedTxn.items?.find((item: any) => {
          const itemName = item?.menuItem?.name || item?.name || '';
          const isDrink = 
            itemName.toLowerCase().includes('drink') ||
            itemName.toLowerCase().includes('juice') ||
            itemName.toLowerCase().includes('soda') ||
            itemName.toLowerCase().includes('water') ||
            itemName.toLowerCase().includes('coffee') ||
            itemName.toLowerCase().includes('tea') ||
            itemName.toLowerCase().includes('milk') ||
            itemName.toLowerCase().includes('smoothie');
          return isDrink;
        });

        if (drinkTransactionItem?.id) {
          const drinkCorrectionData = {
            transactionId: drinkTransactionItem.id, // Use the transaction item ID
            newMenuItemId: requestedDrinkId,
            reason: reason.trim(),
          };

          await axiosInstance.post('/api/corrections', drinkCorrectionData);
        } else {
          console.warn('Could not find drink transaction item ID');
        }
      }

      toast.success('Correction request(s) submitted for admin review');
      setSelectedTxn(null);
      await fetchTodayTransactions();
    } catch (error) {
      console.error('Error submitting correction:', error);
      toast.error('Failed to submit correction request');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  /**
   * Handle items per page change
   */
  const handleItemsPerPageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newItemsPerPage = parseInt(event.target.value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  /**
   * Generate page numbers for pagination display
   */
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  };

  // Initialize data on mount
  useEffect(() => {
    fetchTodayTransactions();
  }, [isOffline, currentPage, itemsPerPage]);

  // Re-apply filters when they change
  useEffect(() => {
    applyFilters(allTransactions, filterSession, searchTerm);
  }, [filterSession, searchTerm, allTransactions, applyFilters]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  // Handle session filter change
  const handleSessionFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterSession(event.target.value as any);
    setCurrentPage(1);
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
   * Render pagination controls
   */
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = getPageNumbers();
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm text-brand-gray-neutral">
            Showing {startIndex} to {endIndex} of {totalItems} entries
          </span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-brand-gray-neutral">Show:</label>
            <select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              className="h-8 px-2 border border-gray-300 rounded-[6px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CaretLeft size={16} />
            <CaretLeft size={16} className="-ml-1" />
          </button>
          
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CaretLeft size={16} />
          </button>

          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              className={`h-8 min-w-[32px] px-2 flex items-center justify-center rounded-[6px] border transition-colors ${
                currentPage === pageNum
                  ? 'bg-brand-gold text-brand-white border-brand-gold'
                  : 'border-gray-300 text-brand-dark-green hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CaretRight size={16} />
          </button>

          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-gray-300 text-brand-gray-neutral hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CaretRight size={16} />
            <CaretRight size={16} className="-ml-1" />
          </button>
        </div>
      </div>
    );
  };

  /**
   * Render transaction table row
   */
  const renderTransactionRow = (transaction: any) => {
    const timeStr = formatTime(transaction.createdAt || transaction.transactionDate);
    const dateStr = formatDate(transaction.transactionDate, transaction.createdAt);
    const statusBadge = getStatusBadge(transaction.correctionStatus);
    const hasMeal = transaction.menuItem && transaction.menuItem !== 'N/A' && transaction.menuItem !== null;
    const hasDrink = transaction.drinkItem && transaction.drinkItem !== 'N/A' && transaction.drinkItem !== null;
    const isPending = transaction.correctionStatus === 'PENDING_CORRECTION';

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

        {/* Menu Item & Price Column (merged)
        <td className="p-4">
          {hasMeal ? (
            <div className="flex flex-col">
              <span className="text-brand-dark-green font-medium">{transaction.menuItem}</span>
              <span className="text-[11px] text-brand-gray-neutral">
                {(transaction.menuPrice || 0).toFixed(2)} ETB
              </span>
            </div>
          ):
            <span className="text-brand-gray-neutral/50 text-xs">No drink</span>
          }
          <div className="flex flex-col">
            <span className="text-brand-dark-green font-medium">{transaction.menuItem}</span>
            <span className="text-[11px] text-brand-gray-neutral">
              {(transaction.menuPrice || 0).toFixed(2)} ETB
            </span>
          </div>
        </td> */}

        {/* Drink & Drink Price Column */}
        <td className="p-4">
          {hasMeal ? (
            <div className="flex flex-col">
              <span className="text-brand-dark-green font-medium">{transaction.menuItem}</span>
              <span className="text-[11px] text-brand-gray-neutral">
                {(transaction.menuPrice || 0).toFixed(2)} ETB
              </span>
            </div>
          ) : (
            <span className="text-brand-gray-neutral/50 text-xs">No meal</span>
          )}
        </td>

        {/* Drink & Drink Price Column */}
        <td className="p-4">
          {hasDrink ? (
            <div className="flex flex-col">
              <span className="text-brand-dark-green font-medium">{transaction.drinkItem}</span>
              <span className="text-[11px] text-brand-gray-neutral">
                {(transaction.drinkPrice || 0).toFixed(2)} ETB
              </span>
            </div>
          ) : (
            <span className="text-brand-gray-neutral/50 text-xs">No drink</span>
          )}
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
          {!isPending ? (
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
            Showing {filteredTransactions.length} of {totalItems} transactions
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
              placeholder="Search by name or employee number..."
              className="h-10 w-72 px-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white placeholder-brand-gray-neutral/60 transition-colors"
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
          <>
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
                    <th className="p-4 whitespace-nowrap">Meal</th>
                    <th className="p-4 whitespace-nowrap">Drink</th>
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
            
            {/* Pagination */}
            {renderPagination()}
          </>
        )}
      </div>

      {/* Correction Request Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[480px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none sticky top-0 bg-white z-10">
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
                <span className="text-brand-gray-neutral font-medium">Session:</span>
                <span className="text-brand-dark-green font-semibold uppercase">
                  {selectedTxn.mealSession}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Original Meal:</span>
                <span className="text-brand-error-red font-semibold line-through">
                  {selectedTxn.menuItem} ({(selectedTxn.menuPrice || 0).toFixed(2)} ETB)
                </span>
              </div>
              {selectedTxn.drinkItem && selectedTxn.drinkItem !== 'N/A' && selectedTxn.drinkItem !== null && (
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral font-medium">Original Drink:</span>
                  <span className="text-brand-error-red font-semibold line-through">
                    {selectedTxn.drinkItem} ({(selectedTxn.drinkPrice || 0).toFixed(2)} ETB)
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Total Price:</span>
                <span className="text-brand-dark-green font-semibold">
                  {(selectedTxn.totalMenuPrice || 0).toFixed(2)} ETB
                </span>
              </div>
            </div>

            {/* Correction Form */}
            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              {/* Correct Meal selector */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Correct Meal <span className="text-brand-gray-neutral/60 text-xs">(Optional - skip to keep same)</span>
                </label>
                {isLoadingMenus ? (
                  <div className="h-[44px] flex items-center px-3 border border-gray-300 rounded-[8px] text-brand-gray-neutral text-sm">
                    Loading menu items...
                  </div>
                ) : (
                  <select
                    value={requestedItemId}
                    onChange={(e) => setRequestedItemId(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer transition-colors"
                  >
                    <option value="">-- Keep current meal --</option>
                    {availableMenuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({(item.currentPrice || 0).toFixed(2)} ETB)
                      </option>
                    ))}
                  </select>
                )}
                {!isLoadingMenus && availableMenuItems.length === 0 && (
                  <p className="text-[11px] text-brand-error-red">
                    No other active meal items found for this session.
                  </p>
                )}
              </div>

              {/* Correct Drink selector */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Correct Drink <span className="text-brand-gray-neutral/60 text-xs">(Optional - skip to keep same)</span>
                </label>
                {isLoadingMenus ? (
                  <div className="h-[44px] flex items-center px-3 border border-gray-300 rounded-[8px] text-brand-gray-neutral text-sm">
                    Loading drink items...
                  </div>
                ) : (
                  <select
                    value={requestedDrinkId}
                    onChange={(e) => setRequestedDrinkId(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer transition-colors"
                  >
                    <option value="">-- Keep current drink --</option>
                    {availableDrinkItems.length > 0 ? (
                      availableDrinkItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({(item.currentPrice || 0).toFixed(2)} ETB)
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No drinks available</option>
                    )}
                  </select>
                )}
                {!isLoadingMenus && availableDrinkItems.length === 0 && (
                  <p className="text-[11px] text-brand-gray-neutral">
                    No drink items available to select.
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
                disabled={isSubmitting || !selectedTxn || (!requestedItemId && !requestedDrinkId) || !reason.trim() || reason.trim().length < 10}
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