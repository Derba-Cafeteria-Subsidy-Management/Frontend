import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import {
  SignOut,
  House,
  Users,
  ForkKnife,
  CheckSquare,
  FileText,
  UserGear,
  Sliders,
  Database,
  Check,
  // WifiHigh,
  // WifiSlash
} from '@phosphor-icons/react';
import logo from '../assets/logo.png';

export const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200 select-none">
      <button
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-[#1A5C3A] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('am')}
        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
          language === 'am'
            ? 'bg-[#1A5C3A] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        አማ
      </button>
    </div>
  );
};


// ================= AUTH LAYOUT =================
export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-white flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] border border-[rgba(50,100,50,0.1)] rounded-[12px] bg-brand-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Accent Top Border */}
        <div className="h-[4px] bg-brand-light-green w-full" />
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// ================= CASHIER LAYOUT =================
export const CashierLayout: React.FC = () => {
  const {
    currentUser,
    logout,
    // isOffline,
    // setOfflineMode,
    cashierStep,
    goToStep
  } = useApp();

  // Type alias for cashier step numbers
  type CashierStep = 1 | 2 | 3 | 4 | 5;
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isMainCashierFlow = location.pathname === '/cashier';

  // Step indicator data
  const steps = [
    { num: 1, label: t('ID'), activeOn: [1] },
    { num: 2, label: t('Session'), activeOn: [2] },
    { num: 3, label: t('Meal'), activeOn: [3] },
    { num: 4, label: t('Drink'), activeOn: [4] },
    { num: 5, label: t('Review'), activeOn: [5, 6] }, // remains review status or completed
  ];

  return (
    <div className="min-h-screen bg-brand-white flex flex-col">
      {/* Top Bar (64px height) */}
      <header className="h-[64px] border-b border-brand-light-green px-6 flex items-center justify-between bg-brand-white select-none">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/cashier')}>
          <span className="text-brand-gold text-2xl font-bold font-mono"><img width='50px' src={logo} /></span>
          <span className="text-brand-dark-green font-semibold text-lg font-sans tracking-wide">{t('Derba MIDROC Cement Cafeteria')}</span>
        </div>

        {/* Center: Title / Context */}
        {/* <div className="hidden md:flex items-center gap-4"> */}
          {/* <span className="text-brand-dark-green font-medium text-[18px]">Meal Registration</span> */}

          {/* Simulated Offline Toggle */}
          {/* <button
            onClick={() => setOfflineMode(!isOffline)}
            className={`text-xs py-1 px-3 rounded-full border transition-all duration-200 flex items-center gap-1 ${isOffline
                ? 'bg-brand-error-red/10 text-brand-error-red border-brand-error-red/30 hover:bg-brand-error-red/20'
                : 'bg-brand-dark-green/10 text-brand-dark-green border-brand-dark-green/20 hover:bg-brand-dark-green/20'
              }`}
          >
            {isOffline ? <WifiSlash size={14} /> : <WifiHigh size={14} />}
            <span>{isOffline ? 'Go Online' : 'Simulate Offline'}</span>
          </button> */}
        {/* </div> */}

        {/* Right: User + Status */}
        <div className="flex items-center gap-6">
          {/* Status Dot */}
          {/* <div className="flex items-center gap-2 text-sm">
            <span className={`w-3 h-3 rounded-full ${isOffline ? 'bg-orange-500 animate-pulse' : 'bg-brand-dark-green'}`} />
            <span className={`font-medium ${isOffline ? 'text-orange-500' : 'text-brand-dark-green'}`}>
              {isOffline ? 'Offline' : 'Online'}
            </span>
          </div> */}

          <LanguageToggle />
          <div className="flex items-center gap-4">
            <span className="text-brand-dark-green text-sm font-medium">
              {currentUser?.email || t('Cashier')}
            </span>
            <button
              onClick={handleLogout}
              className="text-brand-gold text-sm font-medium hover:underline focus:outline-none cursor-pointer"
            >
              {t('Logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Cashier Navigation Menu just below Topbar */}
      <div className="bg-brand-white border-b border-brand-light-green/30 px-6 py-2 flex items-center justify-between">
        <div className="flex gap-4">
          <Link
            to="/cashier"
            className={`text-sm py-1 px-3 rounded hover:bg-[#F9FAFB] transition ${location.pathname === '/cashier' ? 'text-brand-gold font-medium' : 'text-brand-dark-green'
              }`}
          >
            {t('Register Meal')}
          </Link>
          <Link
            to="/cashier/transactions"
            className={`text-sm py-1 px-3 rounded hover:bg-[#F9FAFB] transition ${location.pathname === '/cashier/transactions' ? 'text-brand-gold font-medium' : 'text-brand-dark-green'
              }`}
          >
            {t("Today's Transactions")}
          </Link>
          <Link
            to="/cashier/corrections"
            className={`text-sm py-1 px-3 rounded hover:bg-[#F9FAFB] transition ${location.pathname === '/cashier/corrections' ? 'text-brand-gold font-medium' : 'text-brand-dark-green'
              }`}
          >
            {t('Correction Requests')}
          </Link>
        </div>
      </div>

      {/* Step Indicator (Only for Meal Registration Workflow) */}
      {isMainCashierFlow && (
        <div className="w-full max-w-[600px] mx-auto mt-6 px-4">
          <div className="flex items-center justify-between relative">
            {/* Horizontal Line Connector */}
            <div className="absolute left-[20px] right-[20px] top-[14px] h-[2px] bg-gray-200 -z-10" />
            <div
              className="absolute left-[20px] top-[14px] h-[2px] bg-brand-dark-green transition-all duration-300 -z-10"
              style={{
                width: `${((Math.min(cashierStep, 4) - 1) / 3) * 100}%`
              }}
            />

            {/* Steps Rendering */}
            {steps.map((step) => {
              const isActive = cashierStep === step.num;
              const isCompleted = cashierStep > step.num;
              const isUpcoming = cashierStep < step.num;

              return (
                <div key={step.num} className="flex flex-col items-center flex-1">
                  {/* Circle */}
                  <button
                    disabled={isUpcoming || cashierStep === 5}
                    onClick={() => goToStep(step.num as CashierStep)}
                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all select-none ${isActive
                        ? 'border-brand-dark-green bg-brand-dark-green text-brand-white'
                        : isCompleted
                          ? 'border-brand-dark-green bg-brand-dark-green text-brand-white cursor-pointer'
                          : 'border-gray-300 bg-brand-white text-brand-gray-neutral cursor-not-allowed'
                      }`}
                  >
                    {isCompleted ? <Check size={14} weight="bold" /> : step.num}
                  </button>
                  {/* Label */}
                  <span className={`text-[12px] mt-1 font-sans ${isActive ? 'text-brand-dark-green font-medium' : 'text-brand-gray-neutral'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 flex flex-col items-center">
        <div className="w-full max-w-[1000px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

// ================= ADMIN & SUPER ADMIN LAYOUT =================
interface SidebarProps {
  title: string;
  navItems: Array<{
    label: string;
    path: string;
    icon: React.ComponentType<{ size: number; className?: string }>;
  }>;
}

const BaseAdminLayout: React.FC<SidebarProps> = ({ title, navItems }) => {
  const { currentUser, logout } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Helper function to check if route is active
  const isRouteActive = (itemPath: string, currentPath: string) => {
    // For dashboard (root admin path), only match exactly
    if (itemPath === '/admin') {
      return currentPath === '/admin';
    }
    // For other routes, match exact or children
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
  };

  return (
    <div className="h-screen overflow-hidden bg-brand-white flex">
      {/* Sidebar (240px wide) - Fixed */}
      <aside className="w-[240px] border-r border-brand-light-green flex flex-col justify-between bg-brand-white shrink-0 fixed h-full top-0 left-0 z-10">
        <div>
          {/* Logo Brand Area */}
          <div className="p-6 border-b border-brand-light-green/30 flex items-center gap-2">
            <span className="text-brand-gold text-2xl font-bold font-mono"><img width='50px' src={logo} /></span>
            <span className="text-brand-dark-green font-semibold font-sans tracking-wide">{t('Derba MIDROC Cement')}</span>
          </div>

          <div className="px-4 py-3">
            <span className="text-brand-gray-neutral text-xs font-semibold tracking-wider uppercase font-sans">
              {t(title)}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="mt-2 space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = isRouteActive(item.path, location.pathname);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-3 py-3 px-4 text-sm rounded transition-all select-none ${isActive
                      ? 'text-brand-gold font-medium bg-brand-light-green/10 border-l-[3px] border-brand-light-green'
                      : 'text-brand-dark-green hover:bg-[#F9FAFB]'
                    }`}
                >
                  <item.icon size={20} className={isActive ? 'text-brand-gold' : 'text-brand-dark-green'} />
                  <span className="font-sans">{t(item.label)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t border-brand-light-green/30 space-y-2 bg-[#F9FAFB]/50">
          <div className="text-xs">
            <p className="text-brand-dark-green font-semibold truncate">
              {currentUser?.email || t('User')}
            </p>
            <p className="text-brand-gray-neutral truncate">{currentUser?.email || ''}</p>
            <p className="text-[10px] text-brand-gold font-medium mt-0.5 tracking-wider uppercase">
              {t(currentUser?.role || '')}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-1.5">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium border border-brand-error-red/20 text-brand-error-red rounded hover:bg-brand-error-red/5 transition-colors cursor-pointer"
            >
              <SignOut size={16} />
              <span>{t('Sign Out')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 min-w-0 flex flex-col ml-[240px]">
        {/* Header bar (compact) */}
        <header className="h-[64px] border-b border-brand-light-green/30 px-8 flex items-center justify-between bg-brand-white select-none shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-dark-green" />
            <span className="text-sm font-medium text-brand-dark-green">{t('Management System Active')}</span>
          </div>
          <div className="flex items-center gap-6">
            <LanguageToggle />
            <div className="text-sm text-brand-gray-neutral font-medium">
              {t('System Date:')} {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <div className="flex-1 p-8 overflow-y-auto bg-brand-white">
          <div className="max-w-[1200px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

// Admin Menu Spec
export const AdminLayout: React.FC = () => {
  const adminNav = [
    { label: 'Dashboard', path: '/admin', icon: House },
    { label: 'Employees', path: '/admin/employees', icon: Users },
    { label: 'Menu Items', path: '/admin/menu', icon: ForkKnife },
    { label: 'Correction Adjudications', path: '/admin/corrections', icon: CheckSquare },
    { label: 'Reports Hub', path: '/admin/reports', icon: FileText },
    { label: 'Audit Logs', path: '/admin/audit', icon: Database },
  ];

  return <BaseAdminLayout title="Admin Portal" navItems={adminNav} />;
};

// Super Admin Menu Spec
export const SuperAdminLayout: React.FC = () => {
  const superAdminNav = [
    { label: 'Subsidy Config', path: '/super-admin/subsidy', icon: Sliders },
    { label: 'User Management', path: '/super-admin/users', icon: UserGear },
    { label: 'Audit Logs', path: '/super-admin/audit', icon: Database },
  ];

  return <BaseAdminLayout title="Super Admin Console" navItems={superAdminNav} />;
};
