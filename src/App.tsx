import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { Toaster } from 'react-hot-toast';

// Layouts
import { 
  AuthLayout, 
  CashierLayout, 
  AdminLayout, 
  SuperAdminLayout 
} from './components/Layouts';

// Authentication Pages
import { Login } from './pages/auth/Login';
import { AcceptInvitation } from './pages/auth/AcceptInvitation';

// Cashier Pages
import { CashierFlow } from './pages/cashier/CashierFlow';
import { TodayTransactions } from './pages/cashier/TodayTransactions';
import { CorrectionRequests } from './pages/cashier/CorrectionRequests';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { EmployeeManagement } from './pages/admin/EmployeeManagement';
import { MenuManagement } from './pages/admin/MenuManagement';
import { CorrectionAdjudication } from './pages/admin/CorrectionAdjudication';
import { ReportsHub } from './pages/admin/ReportsHub';

// Super Admin Pages
import { UserManagement } from './pages/super-admin/UserManagement';
import { SubsidyConfig } from './pages/super-admin/SubsidyConfig';
import { AuditLogs } from './pages/super-admin/AuditLogs';

// Route Guards
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles: ('Cashier' | 'Admin' | 'Super Admin')[]; 
}> = ({ children, allowedRoles }) => {
  const { currentUser } = useApp();

  if (!currentUser) {
    // Save attempted URL or redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    // Cross-role redirect home
    if (currentUser.role === 'Cashier') return <Navigate to="/cashier" replace />;
    if (currentUser.role === 'Admin') return <Navigate to="/admin" replace />;
    if (currentUser.role === 'Super Admin') return <Navigate to="/super-admin" replace />;
  }

  return <>{children}</>;
};

// Root Fallback Redirector
const RootRedirector: React.FC = () => {
  const { currentUser } = useApp();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role === 'Cashier') return <Navigate to="/cashier" replace />;
  if (currentUser.role === 'Admin') return <Navigate to="/admin" replace />;
  if (currentUser.role === 'Super Admin') return <Navigate to="/super-admin" replace />;

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      {/* Toast Notification Container */}
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
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          },
          success: {
            iconTheme: {
              primary: '#326432',
              secondary: '#FFFFFF'
            }
          },
          error: {
            style: {
              color: '#DC2626',
              borderColor: 'rgba(220, 38, 38, 0.1)'
            },
            iconTheme: {
              primary: '#DC2626',
              secondary: '#FFFFFF'
            }
          }
        }} 
      />

      <Routes>
        {/* Public/Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
        </Route>

        {/* Cashier Workflow Routes */}
        <Route 
          path="/cashier" 
          element={
            <ProtectedRoute allowedRoles={['Cashier']}>
              <CashierLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CashierFlow />} />
          <Route path="transactions" element={<TodayTransactions />} />
          <Route path="corrections" element={<CorrectionRequests />} />
        </Route>

        {/* Admin Dashboard & Management Routes */}
        <Route 
          path="/admin" 
          element={
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
        </Route>

        {/* Super Admin Configuration Routes */}
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

        {/* Catch-all redirects */}
        <Route path="/" element={<RootRedirector />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
