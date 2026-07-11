import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Eye, EyeSlash, ShieldWarning } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import logo from '../../assets/logo.png';

export const Login: React.FC = () => {
  const { login } = useApp();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message;
    if (message) {
      toast.success(t(message));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const result = await login(email.trim(), password, rememberMe);
    setIsLoading(false);

    if (result.success) {
      toast.success(t('Welcome back!'));
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || result.redirectTo || '/');
    } else {
      setErrorMsg(result.error || t('Invalid credentials or inactive account.'));
      toast.error(result.error || t('Authentication failed.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 select-none">
        <div className="flex items-center justify-center">
          <span className="text-brand-gold text-2xl font-bold font-mono">
            <img width="50px" src={logo} alt="Derba MIDROC Cement logo" />
          </span>
          <span className="text-brand-dark-green font-bold text-[20px] tracking-wide">{t('Derba MIDROC Cement')}</span>
        </div>
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">
          {t('Cafeteria Management System')}
        </h2>
        <p className="text-brand-gray-neutral text-sm">{t('Sign in to your account')}</p>
      </div>

      {errorMsg && (
        <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
          <ShieldWarning size={18} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">{t('Email')}</label>
          <input
            type="email"
            disabled={isLoading}
            placeholder={t('Enter email address')}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green disabled:bg-gray-50 placeholder-brand-gray-neutral/60 text-sm text-brand-dark-green"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[13px] font-medium text-brand-dark-green">{t('Password')}</label>
            <Link
              to="/forgot-password"
              className="text-brand-gold text-xs font-medium hover:underline"
            >
              {t('Forgot password?')}
            </Link>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              disabled={isLoading}
              placeholder={t('Enter password')}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-[44px] pl-3 pr-10 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green disabled:bg-gray-50 placeholder-brand-gray-neutral/60 text-sm text-brand-dark-green"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral hover:text-brand-dark-green focus:outline-none cursor-pointer"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 accent-brand-dark-green border-gray-300 rounded focus:ring-0 focus:ring-offset-0 focus:outline-none"
          />
          <label htmlFor="remember-me" className="text-xs text-brand-gray-neutral select-none cursor-pointer">
            {t('Remember me')}
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-brand-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{t('Processing...')}</span>
            </>
          ) : (
            t('Login')
          )}
        </button>
      </form>

      <div className="text-center text-[12px] text-brand-gray-neutral pt-2 select-none">
        © 2026 Derba Cement Cafeteria
      </div>
    </div>
  );
};