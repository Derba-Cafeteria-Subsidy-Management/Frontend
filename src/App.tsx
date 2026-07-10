import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { Toaster } from 'react-hot-toast';

import {
  AuthLayout,
  CashierLayout,
  AdminLayout,
  SuperAdminLayout,
} from './components/Layouts';

import { Login } from './pages/auth/Login';
import { AcceptInvitation } from './pages/auth/AcceptInvitation';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';

import { CashierFlow } from './pages/cashier/CashierFlow';
import { TodayTransactions } from './pages/cashier/TodayTransactions';
import { CorrectionRequests } from './pages/cashier/CorrectionRequests';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAuditLogs } from './pages/admin/AuditLogs';
import { EmployeeManagement } from './pages/admin/EmployeeManagement';
import { MenuManagement } from './pages/admin/MenuManagement';
import { CorrectionAdjudication } from './pages/admin/CorrectionAdjudication';
import { ReportsHub } from './pages/admin/ReportsHub';

import { UserManagement } from './pages/super-admin/UserManagement';
import { SubsidyConfig } from './pages/super-admin/SubsidyConfig';
import { AuditLogs } from './pages/super-admin/AuditLogs';

type AppRole = 'Cashier' | 'Admin' | 'Super Admin';

const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-brand-white flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <svg className="animate-spin h-8 w-8 text-brand-dark-green" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-sm text-brand-gray-neutral">Loading session...</span>
    </div>
  </div>
);

/** Redirects to the home page for the user's own role. */
const getHomeForRole = (role: string) => {
  if (role === 'Admin') return '/admin';
  if (role === 'Super Admin') return '/super-admin';
  return '/cashier';
};

/**
 * Guards a route by role.
 * - Not logged in  → /login
 * - Wrong role     → user's own home (strict: no cross-role access)
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: AppRole[];
}> = ({ children, allowedRoles }) => {
  const { currentUser, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // currentUser.role is already the mapped friendly string ('Cashier' | 'Admin' | 'Super Admin')
  if (!allowedRoles.includes(currentUser.role as AppRole)) {
    return <Navigate to={getHomeForRole(currentUser.role)} replace />;
  }

  return <>{children}</>;
};

/**
 * Listens for the global 'auth:expired' event fired by the axios interceptor
 * when a 401 cannot be recovered via refresh, then redirects to /login.
 */
const SessionExpiryHandler: React.FC = () => {
  const { logout } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const handleExpiry = async () => {
      await logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:expired', handleExpiry);
    return () => window.removeEventListener('auth:expired', handleExpiry);
  }, [logout, navigate]);

  return null;
};

const RootRedirector: React.FC = () => {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role === 'CASHIER') return <Navigate to="/cashier" replace />;
  if (currentUser.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (currentUser.role === 'SUPER_ADMIN') return <Navigate to="/super-admin" replace />;

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            border: '1px solid rgba(50, 100, 50, 0.1)',
            padding: '12px 16px',
            color: '#326432',
            background: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#326432',
              secondary: '#FFFFFF',
            },
          },
          error: {
            style: {
              color: '#DC2626',
              borderColor: 'rgba(220, 38, 38, 0.1)',
            },
            iconTheme: {
              primary: '#DC2626',
              secondary: '#FFFFFF',
            },
          },
        }}
      />

      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        <Route
          path="/cashier"
          element={
            // Cashier-only — Admins and Super Admins must use their own portals
            <ProtectedRoute allowedRoles={['Cashier']}>
              <CashierLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CashierFlow />} />
          <Route path="transactions" element={<TodayTransactions />} />
          <Route path="corrections" element={<CorrectionRequests />} />
        </Route>

        <Route
          path="/admin"
          element={
            // Admin-only — Super Admins use /super-admin, Cashiers are redirected away
            <ProtectedRoute allowedRoles={['Admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="corrections" element={<CorrectionAdjudication />} />
          <Route path="reports" element={<ReportsHub />} />
          <Route path="audit" element={<AdminAuditLogs />} />
        </Route>

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['Super Admin']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<UserManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="subsidy" element={<SubsidyConfig />} />
          <Route path="audit" element={<AuditLogs />} />
        </Route>

        <Route path="/" element={<RootRedirector />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SessionExpiryHandler />
    </BrowserRouter>
  );
}

export default App;
