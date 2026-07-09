import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../client/axios';
import {
  Users,
  ForkKnife,
  FileText,
  Fingerprint,
  ToggleLeft,
  ToggleRight,
  ChartBar,
  Calendar,
  CurrencyDollar,
  Coffee,
  Receipt
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import toast from 'react-hot-toast';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement
);

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Dashboard stats state (these don't change with tabs)
  const [todayMealsCount, setTodayMealsCount] = useState(0);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0);
  const [activeMenuItemsCount, setActiveMenuItemsCount] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Analytics state
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [chartType, setChartType] = useState<'transactions' | 'revenue' | 'cost'>('transactions');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears] = useState<number[]>([
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
    new Date().getFullYear() - 3
  ]);

  // Get month names
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Analytics data from API
  const [analyticsData, setAnalyticsData] = useState<{
    labels: string[];
    transactions: number[];
    companyRevenue: number[];
    employeeCost: number[];
  }>({
    labels: [],
    transactions: [],
    companyRevenue: [],
    employeeCost: []
  });
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  
  // Cache for analytics data to prevent refetching
  const analyticsCache = useRef<Map<string, any>>(new Map());

  // Dashboard setting: Allow manual Employee ID in cashier terminal
  const [allowManualId, setAllowManualId] = useState(true);

  // Fetch dashboard stats only once
  const fetchDashboardStats = useCallback(async () => {
    if (statsLoaded) return; // Skip if already loaded
    
    try {
      // Fetch transactions for today
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Get today's transactions
      const txnsRes = await axiosInstance.get('/api/transactions', {
        params: { from: todayStr, to: todayStr }
      }).catch(() => ({ data: { data: { transactions: [] } } }));

      // Get pending corrections
      const correctionsRes = await axiosInstance.get('/api/corrections', {
        params: { status: 'PENDING' }
      }).catch(() => ({ data: { data: { corrections: [] } } }));

      // Get ALL active menu items using the pagination info
      const fetchAllMenuItems = async () => {
        let allItems: any[] = [];
        let currentPage = 1;
        const pageSize = 100;
        let totalCount = 0;

        try {
          const firstResponse = await axiosInstance.get('/api/menus', {
            params: { 
              activeOnly: true,
              page: currentPage,
              pageSize: pageSize
            }
          });

          if (firstResponse.data?.success && firstResponse.data?.data) {
            const responseData = firstResponse.data.data;
            
            if (responseData.data && Array.isArray(responseData.data)) {
              allItems = responseData.data;
            }
            
            if (responseData.pagination && responseData.pagination.totalCount) {
              totalCount = responseData.pagination.totalCount;
            }
          }

          const totalPages = Math.ceil(totalCount / pageSize);
          
          for (let page = 2; page <= totalPages; page++) {
            try {
              const response = await axiosInstance.get('/api/menus', {
                params: { 
                  activeOnly: true,
                  page: page,
                  pageSize: pageSize
                }
              });

              if (response.data?.success && response.data?.data) {
                const responseData = response.data.data;
                if (responseData.data && Array.isArray(responseData.data)) {
                  allItems = [...allItems, ...responseData.data];
                }
              }
            } catch (error) {
              console.error(`Error fetching page ${page}:`, error);
            }
          }

          return allItems;
        } catch (error) {
          console.error('Error fetching menu items:', error);
          return [];
        }
      };

      // Get active menu items
      const menuItems = await fetchAllMenuItems();
      setActiveMenuItemsCount(menuItems.length);

      // Today's count
      let todayTxns: any[] = [];
      if (txnsRes.data?.data) {
        if (Array.isArray(txnsRes.data.data)) {
          todayTxns = txnsRes.data.data;
        } else if (txnsRes.data.data.transactions) {
          todayTxns = txnsRes.data.data.transactions;
        }
      }
      setTodayMealsCount(todayTxns.length);

      // Pending corrections
      let pendingCorrections: any[] = [];
      if (correctionsRes.data?.data) {
        if (Array.isArray(correctionsRes.data.data)) {
          pendingCorrections = correctionsRes.data.data;
        } else if (correctionsRes.data.data.corrections) {
          pendingCorrections = correctionsRes.data.data.corrections;
        }
      }
      const pending = pendingCorrections.filter((c: any) => c.status === 'PENDING');
      setPendingCorrectionsCount(pending.length);
      
      setStatsLoaded(true);

    } catch (e) {
      console.error('Error fetching dashboard summary:', e);
      setTodayMealsCount(0);
      setPendingCorrectionsCount(0);
      setActiveMenuItemsCount(0);
      setStatsLoaded(true);
    }
  }, [statsLoaded]);

  // Generate cache key for analytics
  const getAnalyticsCacheKey = useCallback(() => {
    let key = `${viewMode}`;
    if (viewMode === 'daily') key += `_${selectedDate}`;
    else if (viewMode === 'weekly') key += `_${selectedDate}_${selectedYear}`;
    else if (viewMode === 'monthly') key += `_${selectedMonth}_${selectedYear}`;
    else if (viewMode === 'yearly') key += `_${selectedYear}`;
    return key;
  }, [viewMode, selectedDate, selectedMonth, selectedYear]);

  const fetchAnalytics = useCallback(async () => {
    const cacheKey = getAnalyticsCacheKey();
    
    // Check cache first
    if (analyticsCache.current.has(cacheKey)) {
      const cachedData = analyticsCache.current.get(cacheKey);
      setAnalyticsData(cachedData);
      return;
    }

    setIsLoadingAnalytics(true);
    try {
      let params: any = { mode: viewMode };

      if (viewMode === 'daily') {
        params.date = selectedDate;
      } else if (viewMode === 'weekly') {
        const date = new Date(selectedDate);
        const dayOfWeek = date.getDay();
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        params.from = startOfWeek.toISOString().split('T')[0];
        params.to = endOfWeek.toISOString().split('T')[0];
        params.date = selectedDate;
        params.year = selectedYear;
      } else if (viewMode === 'monthly') {
        params.year = selectedYear;
        params.month = selectedMonth;
      } else if (viewMode === 'yearly') {
        params.year = selectedYear;
      }

      const res = await axiosInstance.get('/api/reports/analytics', { params });

      let data;
      if (res.data?.success && res.data?.data) {
        data = res.data.data;
        
        // Map labels for yearly view - convert "M1", "M2", etc. to month names
        let labels = data.labels || [];
        if (viewMode === 'yearly' && labels.length > 0) {
          const monthNamesFull = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          labels = labels.map((label: string) => {
            // Check if label is in format "M1", "M2", etc.
            const match = label.match(/^M(\d+)$/);
            if (match) {
              const monthIndex = parseInt(match[1]) - 1;
              return monthNamesFull[monthIndex] || label;
            }
            return label;
          });
        }
        
        const formattedData = {
          labels: labels,
          transactions: data.transactions || [],
          companyRevenue: data.companyRevenue || [],
          employeeCost: data.employeeCost || []
        };
        setAnalyticsData(formattedData);
        // Cache the data
        analyticsCache.current.set(cacheKey, formattedData);
      } else {
        // Fallback mock data
        const mockLabels = viewMode === 'yearly' 
          ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          : ['BREAKFAST', 'LUNCH', 'DINNER'];
        const mockData = {
          labels: mockLabels,
          transactions: Array(mockLabels.length).fill(0).map(() => Math.floor(Math.random() * 50) + 10),
          companyRevenue: Array(mockLabels.length).fill(0).map(() => Math.random() * 100 + 50),
          employeeCost: Array(mockLabels.length).fill(0).map(() => Math.random() * 80 + 30)
        };
        setAnalyticsData(mockData);
        analyticsCache.current.set(cacheKey, mockData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Fallback mock data
      const mockLabels = viewMode === 'yearly' 
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        : ['BREAKFAST', 'LUNCH', 'DINNER'];
      const mockData = {
        labels: mockLabels,
        transactions: Array(mockLabels.length).fill(0).map(() => Math.floor(Math.random() * 50) + 10),
        companyRevenue: Array(mockLabels.length).fill(0).map(() => Math.random() * 100 + 50),
        employeeCost: Array(mockLabels.length).fill(0).map(() => Math.random() * 80 + 30)
      };
      setAnalyticsData(mockData);
      analyticsCache.current.set(cacheKey, mockData);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [viewMode, selectedDate, selectedMonth, selectedYear, getAnalyticsCacheKey]);

  // Load dashboard stats only once on mount
  useEffect(() => {
    fetchDashboardStats();

    // Load manual ID setting
    const savedSetting = localStorage.getItem('allow_manual_id');
    if (savedSetting !== null) {
      setAllowManualId(savedSetting === 'true');
    }
  }, [fetchDashboardStats]);

  // Fetch analytics when view mode or filters change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleToggleManualId = async () => {
    const newVal = !allowManualId;
    setAllowManualId(newVal);
    localStorage.setItem('allow_manual_id', String(newVal));

    try {
      await axiosInstance.patch('/api/system-settings/authentication', {
        employeeSearchEnabled: newVal,
        fingerprintEnabled: true
      });
    } catch (error) {
      console.warn('Could not update system settings:', error);
    }

    toast.success(newVal ? 'Manual ID Lookup enabled on cashier terminal' : 'Manual ID Lookup disabled on cashier terminal');
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
  };

  const handleViewModeChange = (mode: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setViewMode(mode);
  };

  // Format currency in Birr
  const formatCurrency = (amount: number): string => {
    return amount.toFixed(2) + ' ETB';
  };

  // Get title based on view mode
  const getChartTitle = () => {
    switch (viewMode) {
      case 'daily':
        return `Daily Analytics - ${selectedDate}`;
      case 'weekly':
        return `Weekly Analytics - Week of ${selectedDate}`;
      case 'monthly':
        return `Monthly Analytics - ${monthNames[selectedMonth - 1]} ${selectedYear}`;
      case 'yearly':
        return `Yearly Analytics - ${selectedYear}`;
      default:
        return 'Analytics';
    }
  };

  // Get chart data based on selected chart type with brand colors
  const getChartData = () => {
    const colors = {
      transactions: {
        background: [
          `rgba(212, 175, 55, 0.7)`,
          `rgba(46, 125, 50, 0.7)`,
          `rgba(212, 175, 55, 0.5)`
        ],
        border: [
          `rgba(212, 175, 55, 1)`,
          `rgba(46, 125, 50, 1)`,
          `rgba(212, 175, 55, 0.8)`
        ],
        label: 'Transactions',
        data: analyticsData.transactions,
        format: (value: number) => value.toString()
      },
      revenue: {
        background: [
          `rgba(46, 125, 50, 0.7)`,
          `rgba(46, 125, 50, 0.5)`,
          `rgba(46, 125, 50, 0.3)`
        ],
        border: [
          `rgba(46, 125, 50, 1)`,
          `rgba(46, 125, 50, 0.8)`,
          `rgba(46, 125, 50, 0.6)`
        ],
        label: 'Company Revenue',
        data: analyticsData.companyRevenue,
        format: (value: number) => formatCurrency(value)
      },
      cost: {
        background: [
          `rgba(212, 175, 55, 0.7)`,
          `rgba(212, 175, 55, 0.5)`,
          `rgba(212, 175, 55, 0.3)`
        ],
        border: [
          `rgba(212, 175, 55, 1)`,
          `rgba(212, 175, 55, 0.8)`,
          `rgba(212, 175, 55, 0.6)`
        ],
        label: 'Total Cost',
        data: analyticsData.employeeCost,
        format: (value: number) => formatCurrency(value)
      }
    };

    const selected = colors[chartType];
    return {
      labels: analyticsData.labels,
      datasets: [
        {
          label: selected.label,
          data: selected.data,
          backgroundColor: selected.background,
          borderColor: selected.border,
          borderWidth: 2,
          borderRadius: 6,
        }
      ],
      format: selected.format
    };
  };

  const chartData = getChartData();

  // Chart options with brand colors
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 13,
            weight: 'bold' as const
          },
          color: '#2E7D32'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            let value = context.parsed.y || context.parsed.x || 0;
            return label + ': ' + chartData.format(value);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 12
          },
          color: '#616161',
          callback: function(value: any) {
            if (chartType === 'revenue' || chartType === 'cost') {
              return formatCurrency(value);
            }
            return value;
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
            weight: 'bold' as const
          },
          color: '#2E7D32'
        }
      },
    },
  };

  const getTotal = () => {
    switch (chartType) {
      case 'transactions':
        return analyticsData.transactions.reduce((sum, val) => sum + val, 0);
      case 'revenue':
        return analyticsData.companyRevenue.reduce((sum, val) => sum + val, 0);
      case 'cost':
        return analyticsData.employeeCost.reduce((sum, val) => sum + val, 0);
      default:
        return 0;
    }
  };

  if (isLoadingAnalytics && analyticsData.labels.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Dashboard
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Overview of cafeteria activities, system metrics, and quick actions
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6">
          <div className="h-80 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-60 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
          Dashboard
        </h1>
        <p className="text-brand-gray-neutral text-sm mt-2">
          Overview of cafeteria activities, system metrics, and quick actions
        </p>
      </div>

      {/* Summary Cards (3 Columns) - These don't reload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-4 border-t-brand-light-green rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[140px]">
          <div>
            <span className="text-[13px] font-medium text-brand-gray-neutral uppercase tracking-wider block">
              Today's Meals
            </span>
            <span className="text-brand-dark-green text-[36px] font-bold block mt-2 font-mono leading-none">
              {todayMealsCount}
            </span>
          </div>
          <div className="text-xs text-brand-gray-neutral pt-2 select-none">
            Registered meals today
          </div>
        </div>

        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-4 border-t-brand-gold rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[140px]">
          <div>
            <span className="text-[13px] font-medium text-brand-gray-neutral uppercase tracking-wider block">
              Pending Corrections
            </span>
            <span className="text-brand-gold text-[36px] font-bold block mt-2 font-mono leading-none">
              {pendingCorrectionsCount}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-brand-gray-neutral select-none">Awaiting adjudication</span>
            <Link
              to="/admin/corrections"
              className="text-brand-gold text-xs font-semibold hover:underline"
            >
              Review →
            </Link>
          </div>
        </div>

        <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-t-4 border-t-brand-light-green rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[140px]">
          <div>
            <span className="text-[13px] font-medium text-brand-gray-neutral uppercase tracking-wider block">
              Active Menu Items
            </span>
            <span className="text-brand-dark-green text-[36px] font-bold block mt-2 font-mono leading-none">
              {activeMenuItemsCount}
            </span>
          </div>
          <div className="text-xs text-brand-gray-neutral pt-2 select-none">
            Items currently active on menus
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-light-green pb-3 mb-6 gap-3">
          <div className="flex items-center gap-3">
            <ChartBar size={24} className="text-brand-dark-green flex-shrink-0" />
            <h3 className="text-brand-dark-green font-semibold text-lg select-none">
              Analytics Dashboard
            </h3>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-[8px] overflow-hidden border border-brand-light-green">
              <button
                onClick={() => handleViewModeChange('daily')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'daily'
                    ? 'bg-brand-dark-green text-brand-white'
                    : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => handleViewModeChange('weekly')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'weekly'
                    ? 'bg-brand-dark-green text-brand-white'
                    : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => handleViewModeChange('monthly')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'monthly'
                    ? 'bg-brand-dark-green text-brand-white'
                    : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => handleViewModeChange('yearly')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'yearly'
                    ? 'bg-brand-dark-green text-brand-white'
                    : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10'
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {viewMode !== 'yearly' && (
            <div className="flex items-center gap-2 bg-brand-white border border-brand-light-green rounded-[8px] px-3 py-1.5 focus-within:border-brand-gold transition-colors">
              <Calendar size={20} className="text-brand-dark-green flex-shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm text-brand-dark-green focus:outline-none w-full min-w-[140px]"
                style={{ colorScheme: 'light' }}
              />
            </div>
          )}

          {(viewMode === 'monthly' || viewMode === 'yearly') && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-brand-gray-neutral whitespace-nowrap font-medium">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="px-3 py-1.5 border border-brand-light-green rounded-[8px] text-sm text-brand-dark-green bg-brand-white focus:outline-none focus:border-brand-gold cursor-pointer transition-colors"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-brand-gray-neutral whitespace-nowrap font-medium">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="px-3 py-1.5 border border-brand-light-green rounded-[8px] text-sm text-brand-dark-green bg-brand-white focus:outline-none focus:border-brand-gold cursor-pointer transition-colors"
              >
                {monthNames.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Chart Type Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setChartType('transactions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-medium transition-all ${
              chartType === 'transactions'
                ? 'bg-brand-dark-green text-brand-white shadow-md'
                : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10 border border-brand-light-green'
            }`}
          >
            <Coffee size={18} />
            Transactions
          </button>
          <button
            onClick={() => setChartType('revenue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-medium transition-all ${
              chartType === 'revenue'
                ? 'bg-brand-dark-green text-brand-white shadow-md'
                : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10 border border-brand-light-green'
            }`}
          >
            <CurrencyDollar size={18} />
            Company Revenue
          </button>
          <button
            onClick={() => setChartType('cost')}
            className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-medium transition-all ${
              chartType === 'cost'
                ? 'bg-brand-dark-green text-brand-white shadow-md'
                : 'bg-brand-white text-brand-gray-neutral hover:bg-brand-light-green/10 border border-brand-light-green'
            }`}
          >
            <Receipt size={18} />
            Total Cost
          </button>
        </div>

        {/* Single Bar Chart */}
        {analyticsData.labels.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-brand-dark-green">{getChartTitle()}</h4>
              <div className="text-sm text-brand-gray-neutral">
                Total: <span className="font-semibold text-brand-dark-green">
                  {chartType === 'transactions' 
                    ? getTotal() 
                    : formatCurrency(getTotal())}
                </span>
              </div>
            </div>
            
            <div className="border border-brand-light-green rounded-[8px] p-4 bg-brand-white">
              <div className="h-[350px]">
                <Bar data={chartData} options={barChartOptions} />
              </div>
            </div>
          </div>
        )}

        {!isLoadingAnalytics && analyticsData.labels.length === 0 && (
          <div className="text-center py-12 text-brand-gray-neutral">
            <ChartBar size={48} className="mx-auto text-brand-gray-neutral/30 mb-2" />
            <p className="text-sm">No analytics data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
        <h3 className="text-brand-dark-green font-semibold text-lg border-b border-brand-light-green pb-3 mb-4 select-none">
          Quick Actions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/employees')}
            className="flex flex-col items-start p-4 border border-gray-200 hover:border-brand-gold rounded-[8px] transition text-left group"
          >
            <Users size={24} className="text-brand-dark-green mb-2 group-hover:text-brand-gold" />
            <span className="font-semibold text-sm text-brand-dark-green">Register Employee</span>
            <span className="text-brand-gray-neutral text-xs mt-1">Manage personnel files and biometric registrations</span>
          </button>

          <button
            onClick={() => navigate('/admin/menu')}
            className="flex flex-col items-start p-4 border border-gray-200 hover:border-brand-gold rounded-[8px] transition text-left group"
          >
            <ForkKnife size={24} className="text-brand-dark-green mb-2 group-hover:text-brand-gold" />
            <span className="font-semibold text-sm text-brand-dark-green">Add Menu Item</span>
            <span className="text-brand-gray-neutral text-xs mt-1">Configure breakfasts, lunches, and dinner meals</span>
          </button>

          <button
            onClick={() => navigate('/admin/reports')}
            className="flex flex-col items-start p-4 border border-gray-200 hover:border-brand-gold rounded-[8px] transition text-left group"
          >
            <FileText size={24} className="text-brand-dark-green mb-2 group-hover:text-brand-gold" />
            <span className="font-semibold text-sm text-brand-dark-green">View Reports</span>
            <span className="text-brand-gray-neutral text-xs mt-1">Download payroll deduction and billing statements</span>
          </button>

          {/* Special ID Lookup Toggler action */}
          <div className="flex flex-col items-start p-4 border border-gray-200 rounded-[8px] text-left">
            <Fingerprint size={24} className="text-brand-dark-green mb-2" />
            <div className="w-full flex items-center justify-between">
              <span className="font-semibold text-sm text-brand-dark-green">Cashier ID Lookup</span>
              <button
                onClick={handleToggleManualId}
                className="text-brand-gold focus:outline-none"
                aria-label="Toggle manual ID lookup"
              >
                {allowManualId ? (
                  <ToggleRight size={32} weight="fill" className="text-brand-dark-green" />
                ) : (
                  <ToggleLeft size={32} className="text-brand-gray-neutral" />
                )}
              </button>
            </div>
            <span className="text-brand-gray-neutral text-xs mt-1">
              {allowManualId ? 'Manual entry box visible' : 'Biometrics-only (Manual ID hidden)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;