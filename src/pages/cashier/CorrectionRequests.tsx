import React, { useState, useEffect } from 'react';
import axiosInstance from '../../client/axios';
import { useApp } from '../../context/AppContext';
import { Plus, PaperPlane, ClipboardText, Clock, Check, X, MagnifyingGlass } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { CorrectionRequest, MenuItem } from '../../types/api';

// Pagination component
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 text-sm text-brand-dark-green disabled:text-gray-400 hover:bg-gray-100 rounded transition disabled:hover:bg-transparent"
      >
        Previous
      </button>
      <div className="flex gap-1">
        {getPageNumbers().map((page, idx) => (
          <button
            key={idx}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            className={`px-3 py-1 text-sm rounded transition ${
              page === currentPage
                ? 'bg-brand-gold text-brand-white'
                : page === '...'
                ? 'text-gray-400 cursor-default'
                : 'hover:bg-gray-100 text-brand-dark-green'
            }`}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 text-sm text-brand-dark-green disabled:text-gray-400 hover:bg-gray-100 rounded transition disabled:hover:bg-transparent"
      >
        Next
      </button>
    </div>
  );
};

// Tab configuration
type TabType = 'pending' | 'approved' | 'rejected';

interface TabConfig {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  count: number;
  status: string;
  badgeColor: string;
  badgeBg: string;
}

export const CorrectionRequests: React.FC = () => {
  const { isOffline } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  
  // Data states
  const [pendingRequests, setPendingRequests] = useState<CorrectionRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<CorrectionRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search states per tab
  const [searchQuery, setSearchQuery] = useState<Record<TabType, string>>({
    pending: '',
    approved: '',
    rejected: ''
  });

  // Pagination states per tab
  const [currentPage, setCurrentPage] = useState<Record<TabType, number>>({
    pending: 1,
    approved: 1,
    rejected: 1
  });
  const itemsPerPage = 5;

  // New Request Wizard Modal State
  const [showWizard, setShowWizard] = useState(false);
  const [todaysTransactions, setTodaysTransactions] = useState<any[]>([]);
  const [selectedTxnId, setSelectedTxnId] = useState<string>('');
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [availableDrinkItems, setAvailableDrinkItems] = useState<MenuItem[]>([]);
  const [requestedItemId, setRequestedItemId] = useState<string>('');
  const [requestedDrinkId, setRequestedDrinkId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMenus, setIsLoadingMenus] = useState(false);
  
  // Tooltip state
  const [tooltipText, setTooltipText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  // Get filtered and paginated data for current tab
  const getFilteredData = (tab: TabType) => {
    const dataMap = {
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests
    };
    const data = dataMap[tab];
    const query = searchQuery[tab].toLowerCase().trim();

    if (!query) return data;

    return data.filter(req => {
      const searchableText = [
        req.employee || 'Employee',
        req.oldValue?.menuItemName || '',
        req.newValue?.menuItemName || '',
        req.reason,
        new Date(req.createdAt).toLocaleDateString('en-US', { 
          day: 'numeric', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      ].join(' ').toLowerCase();

      return searchableText.includes(query);
    });
  };

  const getPaginatedData = (tab: TabType) => {
    const filtered = getFilteredData(tab);
    const page = currentPage[tab];
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      data: filtered.slice(start, end),
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(prev => ({
      ...prev,
      [activeTab]: 1
    }));
  }, [searchQuery[activeTab]]);

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
   * Fetch correction requests by status
   */
  const fetchRequestsByStatus = async (status: string) => {
    try {
      const res = await axiosInstance.get('/api/corrections', {
        params: { status }
      });
      if (res.data?.success && res.data?.data) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : raw.corrections || raw.data || [];
        return list;
      }
      return [];
    } catch (e) {
      console.error(`Failed to load ${status} correction requests:`, e);
      toast.error(`Failed to load ${status} correction requests`);
      return [];
    }
  };

  // Fetch all correction requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      if (isOffline) {
        toast.error('Currently offline. Cannot fetch corrections history.');
        setPendingRequests([]);
        setApprovedRequests([]);
        setRejectedRequests([]);
        setLoading(false);
        return;
      }

      const [pending, approved, rejected] = await Promise.all([
        fetchRequestsByStatus('PENDING'),
        fetchRequestsByStatus('APPROVED'),
        fetchRequestsByStatus('REJECTED')
      ]);
      
      setPendingRequests(pending);
      setApprovedRequests(approved);
      setRejectedRequests(rejected);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [isOffline]);

  /**
   * Fetch all menu items with pagination
   */
  const fetchAllMenuItems = async (): Promise<MenuItem[]> => {
    let allItems: MenuItem[] = [];
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

  // Load today's transactions for the creation wizard
  const handleOpenWizard = async () => {
    if (isOffline) {
      toast.error('Cannot create corrections while offline');
      return;
    }
    setShowWizard(true);
    setSelectedTxnId('');
    setSelectedTxn(null);
    setReason('');
    setRequestedItemId('');
    setRequestedDrinkId('');

    try {
      const todayDate = getTodayDate();

      const response = await axiosInstance.get('/api/transactions', {
        params: {
          from: todayDate,
          to: todayDate
        }
      });

      if (response.data?.success && response.data?.data) {
        const list = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.data.transactions || [];

        const mappedTransactions = list.map((transaction: any) => {
          const items = transaction.items || [];
          let mealPrice = 0;
          let drinkPrice = 0;
          let mealName = 'N/A';
          let drinkName: string | null = null;

          if (items.length > 0) {
            items.forEach((item: any) => {
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

              if (isDrink) {
                drinkPrice = item.menuPrice || 0;
                drinkName = itemName;
              } else {
                mealPrice = item.menuPrice || 0;
                mealName = itemName;
              }
            });
          }

          return {
            id: transaction.id || transaction.transactionId,
            employeeId: transaction.employeeNumber || transaction.employeeId || 'N/A',
            employeeNumber: transaction.employeeNumber || transaction.employeeId || 'N/A',
            fullName: transaction.fullName || transaction.employeeName || 'Unknown',
            mealSession: transaction.mealSession || transaction.session || 'N/A',
            menuItem: mealName,
            menuPrice: mealPrice,
            drinkItem: drinkName,
            drinkPrice: drinkPrice,
            items: items,
            transactionDate: transaction.transactionDate,
            createdAt: transaction.createdAt,
            correctionStatus: transaction.correctionStatus || 'COMPLETE',
          };
        });

        const eligible = mappedTransactions.filter(
          (t: any) => t.correctionStatus !== 'PENDING_CORRECTION'
        );

        setTodaysTransactions(eligible);
        
        if (eligible.length === 0) {
          toast('No eligible transactions found for today', {
            icon: 'ℹ️',
            duration: 3000,
          });
        }
      } else {
        setTodaysTransactions([]);
        toast.error('No transactions available');
      }
    } catch (err) {
      console.error(err);
      const isAxiosError = err && typeof err === 'object' && 'response' in err;
      
      if (isAxiosError && (err as any).response?.status !== 404) {
        toast.error('Failed to load today\'s transactions');
      } else {
        setTodaysTransactions([]);
      }
    }
  };

  // When a transaction is selected in wizard
  useEffect(() => {
    const loadTxnDetails = async () => {
      if (selectedTxnId) {
        const txn = todaysTransactions.find((t) => t.id === selectedTxnId);
        if (txn) {
          setSelectedTxn(txn);
          setIsLoadingMenus(true);
          setAvailableMenuItems([]);
          setAvailableDrinkItems([]);
          setRequestedItemId('');
          setRequestedDrinkId('');
          
          try {
            const allItems = await fetchAllMenuItems();
            
            const sessionMenus = allItems.filter(
              (item: MenuItem) => {
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
                
                return (item as any).mealtype === "BREAKFAST" ||
                       item.mealtype === "LUNCH" || 
                       item.mealtype === "DINNER" && 
                       item.name !== txn.menuItem && 
                       !isDrink;
              }
            );
            
            const drinkItems = allItems.filter(
              (item: MenuItem) => {
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
          } catch (e) {
            console.error(e);
            toast.error('Failed to load alternative menu items');
          } finally {
            setIsLoadingMenus(false);
          }
        }
      } else {
        setSelectedTxn(null);
        setAvailableMenuItems([]);
        setAvailableDrinkItems([]);
        setIsLoadingMenus(false);
      }
    };
    loadTxnDetails();
  }, [selectedTxnId, todaysTransactions]);

  const handleSubmitWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTxn) {
      toast.error('No transaction selected');
      return;
    }
    
    if (!requestedItemId && !requestedDrinkId) {
      toast.error('Please select at least one item to correct (meal or drink)');
      return;
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for the correction');
      return;
    }
    
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long');
      return;
    }
    
    if (reason.length > 250) {
      toast.error('Reason must not exceed 250 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = selectedTxn.items || [];
      
      if (requestedItemId) {
        const mealTransactionItem = items.find((item: any) => {
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
            transactionId: mealTransactionItem.id,
            newMenuItemId: requestedItemId,
            reason: reason.trim(),
          };

          await axiosInstance.post('/api/corrections', mealCorrectionData);
        } else {
          console.warn('Could not find meal transaction item ID');
          toast.error('Could not find meal item in transaction');
        }
      }
      
      if (requestedDrinkId) {
        const drinkTransactionItem = items.find((item: any) => {
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
            transactionId: drinkTransactionItem.id,
            newMenuItemId: requestedDrinkId,
            reason: reason.trim(),
          };

          await axiosInstance.post('/api/corrections', drinkCorrectionData);
        } else {
          console.warn('Could not find drink transaction item ID');
          toast.error('Could not find drink item in transaction');
        }
      }

      toast.success('Correction request(s) submitted for admin review');
      setShowWizard(false);
      
      // Refresh only pending requests
      const pending = await fetchRequestsByStatus('PENDING');
      setPendingRequests(pending);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit correction request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tooltip handlers
  const handleMouseEnter = (e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipText(text);
    setTooltipPosition({
      x: rect.left,
      y: rect.top - 10
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      key: 'pending',
      label: 'Pending',
      icon: <Clock size={18} className="text-brand-gold" />,
      count: pendingRequests.length,
      status: 'PENDING',
      badgeColor: 'text-brand-dark-green',
      badgeBg: 'bg-brand-light-green'
    },
    {
      key: 'approved',
      label: 'Approved',
      icon: <Check size={18} className="text-green-600" />,
      count: approvedRequests.length,
      status: 'APPROVED',
      badgeColor: 'text-brand-white',
      badgeBg: 'bg-brand-dark-green'
    },
    {
      key: 'rejected',
      label: 'Rejected',
      icon: <X size={18} className="text-brand-error-red" />,
      count: rejectedRequests.length,
      status: 'REJECTED',
      badgeColor: 'text-brand-error-red',
      badgeBg: 'bg-red-100'
    }
  ];

  // Render table rows
  const renderTableRows = (requests: CorrectionRequest[], tab: TabType) => {
    if (requests.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="p-8 text-center select-none space-y-2">
              <ClipboardText size={32} className="text-brand-gray-neutral mx-auto opacity-50" />
              <p className="text-brand-gray-neutral text-sm">No {tab} correction requests</p>
            </div>
          </td>
        </tr>
      );
    }

    const statusConfig = tabs.find(t => t.key === tab)!;

    return requests.map((req) => {
      const dateStr = new Date(req.createdAt).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      const oldItemName = req.oldValue?.menuItemName || 'Original Item';
      const oldPrice = req.oldValue?.menuPrice || 0;
      const newItemName = req.newValue?.menuItemName || 'Requested Item';
      const newPrice = req.newValue?.menuPrice || 0;

      return (
        <tr key={req.id} className="hover:bg-brand-light-green/5 transition-colors">
          <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{dateStr}</td>
          <td className="p-4 font-medium text-brand-dark-green whitespace-nowrap">
            {req.employee || 'Employee'}
          </td>
          <td className="p-4 text-brand-error-red line-through whitespace-nowrap">
            {oldItemName} ({oldPrice.toFixed(2)})
          </td>
          <td className="p-4 text-brand-dark-green font-semibold whitespace-nowrap">
            {newItemName} ({newPrice.toFixed(2)})
          </td>
          <td className="p-4 text-brand-gray-neutral text-xs max-w-[200px]">
            <div 
              className="truncate cursor-help relative"
              onMouseEnter={(e) => handleMouseEnter(e, req.reason)}
              onMouseLeave={handleMouseLeave}
            >
              {req.reason}
            </div>
          </td>
          <td className="p-4 text-center whitespace-nowrap select-none">
            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${statusConfig.badgeBg} ${statusConfig.badgeColor}`}>
              {statusConfig.status}
            </span>
          </td>
        </tr>
      );
    });
  };

  // Render data table for a tab
  const renderTabContent = (tab: TabType) => {
    const { data, totalItems, totalPages } = getPaginatedData(tab);

    return (
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-brand-light-green bg-[#F9FAFB]/30">
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
            <input
              type="text"
              value={searchQuery[tab]}
              onChange={(e) => setSearchQuery(prev => ({
                ...prev,
                [tab]: e.target.value
              }))}
              placeholder={`Search ${tab} requests...`}
              className="w-full pl-10 pr-4 h-[40px] border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                <th className="p-4">Submission Date</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Original Selection</th>
                <th className="p-4">Requested Selection</th>
                <th className="p-4">Reason</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderTableRows(data, tab)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage[tab]}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(prev => ({
            ...prev,
            [tab]: page
          }))}
        />
        
        {/* Results count */}
        <div className="px-4 py-2 text-xs text-brand-gray-neutral border-t border-gray-200 bg-gray-50/30">
          Showing {data.length} of {totalItems} results
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tooltip */}
      {showTooltip && (
        <div 
          className="fixed z-[9999] bg-brand-dark-green text-brand-white text-xs rounded-lg p-3 max-w-md whitespace-normal break-words shadow-lg border border-brand-light-green/20"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y - 8}px`,
            transform: 'translateY(-100%)',
            maxWidth: '400px',
            minWidth: '200px'
          }}
        >
          {tooltipText}
          <div 
            className="absolute bottom-[-6px] left-4 w-3 h-3 bg-brand-dark-green rotate-45"
          ></div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Correction Requests
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Submit and track modification requests for incorrect meal records
          </p>
        </div>

        <button
          onClick={handleOpenWizard}
          className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={18} weight="bold" />
          <span>New Request</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-light-green/30">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
              activeTab === tab.key
                ? 'border-brand-gold text-brand-dark-green'
                : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-brand-light-green/30 text-brand-dark-green' : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        renderTabContent(activeTab)
      )}

      {/* New Request Creation Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[480px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none sticky top-0 bg-white z-10">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">Create Correction Request</h3>
              <button
                onClick={() => setShowWizard(false)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWizard} className="space-y-4">
              {/* Step 1: Select Today's Transaction */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Select Transaction (Today's Only)
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedTxnId}
                    onChange={(e) => setSelectedTxnId(e.target.value)}
                    className="w-full h-[44px] px-3 pr-8 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer appearance-none"
                  >
                    <option value="">-- Select Transaction --</option>
                    {todaysTransactions.map((t: any) => {
                      const time = new Date(t.transactionDate || t.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <option key={t.id} value={t.id}>
                          [{time}] {t.fullName} - {t.menuItem} ({(t.menuPrice || 0).toFixed(2)} ETB)
                          {t.drinkItem && ` + ${t.drinkItem}`}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
                {todaysTransactions.length === 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-[8px] p-3 text-sm">
                    <p className="text-blue-700 font-medium">No transactions available today</p>
                    <p className="text-blue-600 text-xs mt-1">
                      You can only request corrections for transactions made today. 
                      Please complete a meal transaction first before submitting a correction request.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Show original details and input form */}
              {selectedTxn && (
                <>
                  <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-4 text-xs space-y-2 select-none">
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Employee Name:</span>
                      <span className="text-brand-dark-green font-semibold">{selectedTxn.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Session:</span>
                      <span className="text-brand-dark-green uppercase font-semibold">{selectedTxn.mealSession}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Original Meal:</span>
                      <span className="text-brand-error-red font-semibold line-through">
                        {selectedTxn.menuItem} ({(selectedTxn.menuPrice || 0).toFixed(2)} ETB)
                      </span>
                    </div>
                    {selectedTxn.drinkItem && selectedTxn.drinkItem !== 'N/A' && (
                      <div className="flex justify-between">
                        <span className="text-brand-gray-neutral font-medium">Original Drink:</span>
                        <span className="text-brand-error-red font-semibold line-through">
                          {selectedTxn.drinkItem} ({(selectedTxn.drinkPrice || 0).toFixed(2)} ETB)
                        </span>
                      </div>
                    )}
                  </div>

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
                      <div className="relative">
                        <select
                          value={requestedItemId}
                          onChange={(e) => setRequestedItemId(e.target.value)}
                          className="w-full h-[44px] px-3 pr-8 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer appearance-none"
                        >
                          <option value="">-- Keep current meal --</option>
                          {availableMenuItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({(item.currentPrice || 0).toFixed(2)} ETB)
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </div>
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
                      <div className="relative">
                        <select
                          value={requestedDrinkId}
                          onChange={(e) => setRequestedDrinkId(e.target.value)}
                          className="w-full h-[44px] px-3 pr-8 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer appearance-none"
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
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </div>
                    )}
                    {!isLoadingMenus && availableDrinkItems.length === 0 && (
                      <p className="text-[11px] text-brand-gray-neutral">
                        No drink items available to select.
                      </p>
                    )}
                  </div>

                  {/* Reason Text */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[13px]">
                      <label className="font-medium text-brand-dark-green">Reason for Correction</label>
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
                      className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-20 resize-none placeholder-brand-gray-neutral/60"
                    />
                  </div>
                </>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedTxn || (!requestedItemId && !requestedDrinkId) || !reason.trim() || todaysTransactions.length === 0}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 sticky bottom-0"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <PaperPlane size={18} />
                    <span>Submit Correction Request</span>
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