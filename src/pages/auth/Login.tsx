import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Eye, EyeSlash, ShieldWarning } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    // Simulate small delay for authentication
    setTimeout(async () => {
      // Find role
      let role: 'Admin' | 'Cashier' | 'Super Admin' = 'Cashier';
      if (username.includes('admin') && !username.includes('super')) {
        role = 'Admin';
      } else if (username.includes('super')) {
        role = 'Super Admin';
      }

      const success = await login(username.trim(), role);
      setIsLoading(false);
      
      if (success) {
        toast.success(`Welcome back, ${username}!`);
        if (role === 'Admin') {
          navigate('/admin');
        } else if (role === 'Super Admin') {
          navigate('/super-admin/subsidy');
        } else {
          navigate('/cashier');
        }
      } else {
        setErrorMsg('Invalid credentials or inactive account.');
        toast.error('Authentication failed.');
      }
    }, 800);
  };

  // Helper login function for testing
  const handleQuickLogin = async (usr: string, role: 'Admin' | 'Cashier' | 'Super Admin') => {
    setIsLoading(true);
    setErrorMsg(null);
    const success = await login(usr, role);
    setIsLoading(false);
    if (success) {
      toast.success(`Quick logged in as ${usr}`);
      if (role === 'Admin') {
        navigate('/admin');
      } else if (role === 'Super Admin') {
        navigate('/super-admin/subsidy');
      } else {
        navigate('/cashier');
      }
    } else {
      setErrorMsg('Quick login failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2 select-none">
        <div className="flex items-center justify-center gap-2">
          <span className="text-brand-gold text-3xl font-mono">☕</span>
          <span className="text-brand-dark-green font-bold text-2xl tracking-wide">Derba</span>
        </div>
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">
          Cafeteria Management System
        </h2>
        <p className="text-brand-gray-neutral text-sm">
          Sign in to your account
        </p>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
          <ShieldWarning size={18} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            placeholder="Enter username"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green disabled:bg-gray-50 placeholder-brand-gray-neutral/60 text-sm text-brand-dark-green"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[13px] font-medium text-brand-dark-green">
              Password
            </label>
            <Link
              to="/forgot-password"
              onClick={(e) => {
                e.preventDefault();
                toast('Contact IT Helpdesk to reset password.', { icon: 'ℹ️' });
              }}
              className="text-brand-gold text-xs font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter password"
              className="w-full h-[44px] pl-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green disabled:bg-gray-50 placeholder-brand-gray-neutral/60 text-sm text-brand-dark-green"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral hover:text-brand-dark-green focus:outline-none"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 accent-brand-dark-green border-gray-300 rounded focus:ring-0 focus:ring-offset-0 focus:outline-none"
          />
          <label htmlFor="remember-me" className="text-xs text-brand-gray-neutral select-none cursor-pointer">
            Remember me
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-brand-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            'Login'
          )}
        </button>
      </form>

      {/* Quick Login Helpers */}
      <div className="pt-4 border-t border-[rgba(50,100,50,0.1)]">
        <p className="text-[11px] font-medium text-brand-gray-neutral mb-2 uppercase tracking-wider text-center select-none">
          Demo Quick Login Profiles
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleQuickLogin('cashier', 'Cashier')}
            className="text-[11px] font-medium py-1.5 border border-brand-dark-green/20 rounded hover:bg-brand-dark-green/5 text-brand-dark-green"
          >
            Cashier
          </button>
          <button
            onClick={() => handleQuickLogin('admin', 'Admin')}
            className="text-[11px] font-medium py-1.5 border border-brand-dark-green/20 rounded hover:bg-brand-dark-green/5 text-brand-dark-green"
          >
            Admin
          </button>
          <button
            onClick={() => handleQuickLogin('superadmin', 'Super Admin')}
            className="text-[11px] font-medium py-1.5 border border-brand-dark-green/20 rounded hover:bg-brand-dark-green/5 text-brand-dark-green"
          >
            Super Admin
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[12px] text-brand-gray-neutral pt-2 select-none">
        © 2026 Derba Cement Cafeteria
      </div>
    </div>
  );
};
