import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../db/db';
import { 
  Users, 
  ForkKnife, 
  FileText, 
  Fingerprint,
  ToggleLeft,
  ToggleRight,
  ChartBar
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [todayMealsCount, setTodayMealsCount] = useState(0);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0);
  const [activeMenuItemsCount, setActiveMenuItemsCount] = useState(0);
  
  // Monthly stats
  const [monthlyStats, setMonthlyStats] = useState<{ month: string; count: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // Dashboard setting: Allow manual Employee ID in cashier terminal
  const [allowManualId, setAllowManualId] = useState(true);

  // Get month names
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Fetch monthly statistics
  const fetchMonthlyStats = async (year: number) => {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      
      // Get all transactions for the year
      const transactions = await db.transactions
        .where('timestamp')
        .between(startDate, endDate, true, true)
        .toArray();

      // Group by month
      const monthCounts = new Array(12).fill(0);
      transactions.forEach(txn => {
        const month = new Date(txn.timestamp).getMonth();
        monthCounts[month]++;
      });

      // Format data for display
      const stats = monthNames.map((month, index) => ({
        month,
        count: monthCounts[index]
      }));

      setMonthlyStats(stats);
    } catch (e) {
      console.error('Error fetching monthly stats:', e);
    }
  };

  // Get available years from transactions
  const fetchAvailableYears = async () => {
    try {
      const allTransactions = await db.transactions.toArray();
      const years = allTransactions.map(txn => new Date(txn.timestamp).getFullYear());
      const uniqueYears = [...new Set(years)].sort((a, b) => b - a);
      
      // If no transactions, use current year
      if (uniqueYears.length === 0) {
        uniqueYears.push(new Date().getFullYear());
      }
      
      setAvailableYears(uniqueYears);
      setSelectedYear(uniqueYears[0]); // Set to most recent year
      await fetchMonthlyStats(uniqueYears[0]);
    } catch (e) {
      console.error('Error fetching available years:', e);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Today's meals count
        const mealsToday = await db.transactions
          .where('timestamp')
          .between(startOfDay, endOfDay, true, true)
          .count();
        setTodayMealsCount(mealsToday);

        // 2. Pending corrections count
        const pending = await db.correctionRequests
          .where('status')
          .equals('Pending')
          .count();
        setPendingCorrectionsCount(pending);

        // 3. Active menu items count
        const activeMenus = await db.menuItems
          .where('isActive')
          .equals(1)
          .count();
        setActiveMenuItemsCount(activeMenus);

        // 4. Fetch available years and monthly stats
        await fetchAvailableYears();
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();

    // Load setting
    const savedSetting = localStorage.getItem('allow_manual_id');
    if (savedSetting !== null) {
      setAllowManualId(savedSetting === 'true');
    }
  }, []);

  const handleToggleManualId = () => {
    const newVal = !allowManualId;
    setAllowManualId(newVal);
    localStorage.setItem('allow_manual_id', String(newVal));
    
    // Log action
    db.auditLogs.add({
      timestamp: new Date(),
      user: 'admin',
      action: newVal ? 'Enable Manual ID Lookup' : 'Disable Manual ID Lookup',
      entity: 'SystemConfig',
      entityId: 'allow_manual_id',
      details: JSON.stringify({ allowManualId: newVal })
    }).catch(console.error);

    toast.success(newVal ? 'Manual ID Lookup enabled on cashier terminal' : 'Manual ID Lookup disabled on cashier terminal');
  };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    await fetchMonthlyStats(year);
  };

  // Find max count for chart scaling
  const maxCount = Math.max(...monthlyStats.map(item => item.count), 1);

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

      {/* Summary Cards (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Today's Meals Card */}
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

        {/* Pending Corrections Card */}
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

        {/* Active Menu Items Card */}
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

      {/* Monthly Consumption Graph */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
          <div className="flex items-center gap-3">
            <ChartBar size={24} className="text-brand-dark-green" />
            <h3 className="text-brand-dark-green font-semibold text-lg select-none">
              Monthly Consumption
            </h3>
          </div>
          
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="yearSelect" className="text-sm text-brand-gray-neutral select-none">
              Year:
            </label>
            <select
              id="yearSelect"
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-[8px] text-sm text-brand-dark-green bg-brand-white focus:outline-none focus:border-brand-gold cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-[200px] w-full">
          <div className="flex h-full items-end gap-2">
            {monthlyStats.map((item, index) => {
              const heightPercent = item.count > 0 ? (item.count / maxCount) * 100 : 4;
              const isActive = item.count > 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  {/* Bar with tooltip */}
                  <div className="relative w-full group">
                    <div 
                      className={`w-full rounded-t-[4px] transition-all duration-500 hover:opacity-80 cursor-pointer ${
                        isActive ? 'bg-brand-light-green' : 'bg-gray-100'
                      }`}
                      style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                    >
                      {/* Tooltip */}
                      {item.count > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-brand-dark-green text-brand-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {item.count} meals
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Month Label */}
                  <span className={`text-[10px] mt-1 select-none ${
                    item.count > 0 ? 'text-brand-dark-green' : 'text-brand-gray-neutral'
                  }`}>
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-brand-gray-neutral select-none">
            Total meals in {selectedYear}: <strong className="text-brand-dark-green">
              {monthlyStats.reduce((sum, item) => sum + item.count, 0)}
            </strong>
          </span>
          <span className="text-[10px] text-brand-gray-neutral select-none">
            Hover bars for details
          </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
        <h3 className="text-brand-dark-green font-semibold text-lg border-b border-gray-100 pb-3 mb-4 select-none">
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