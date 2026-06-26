import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../db/db';
import { 
  Users, 
  ForkKnife, 
  FileText, 
  Fingerprint,
  ToggleLeft,
  ToggleRight
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [todayMealsCount, setTodayMealsCount] = useState(0);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0);
  const [activeMenuItemsCount, setActiveMenuItemsCount] = useState(0);
  
  // Dashboard setting: Allow manual Employee ID in cashier terminal
  const [allowManualId, setAllowManualId] = useState(true);

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
