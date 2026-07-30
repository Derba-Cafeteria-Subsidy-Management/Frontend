import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ShieldWarning, ArrowLeft } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { resetPasswordRequest } from '../../lib/api/auth';
import { getErrorMessage } from '../../lib/api/errors';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pwdStrength, setPwdStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: 'None',
    color: 'bg-gray-200',
  });

  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid or missing reset token. Please request a new reset link.');
    }
  }, [token]);

  useEffect(() => {
    if (!password) {
      setPwdStrength({ score: 0, label: 'None', color: 'bg-gray-200' });
      return;
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let label = 'Weak';
    let color = 'bg-brand-error-red';

    if (score >= 4) {
      label = 'Strong';
      color = 'bg-brand-dark-green';
    } else if (score >= 2) {
      label = 'Medium';
      color = 'bg-brand-gold';
    }

    setPwdStrength({ score, label, color });
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMsg('Invalid or missing reset token.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await resetPasswordRequest(token, password);
      toast.success('Password changed successfully!');
      navigate('/login', { state: { message: 'Password reset successful. Please sign in.' } });
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      const message = getErrorMessage(status, {
        message: error instanceof Error ? error.message : undefined,
      });
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 select-none">
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">Reset Password</h2>
        <p className="text-brand-gray-neutral text-sm">Choose a new password for your account</p>
      </div>

      {errorMsg && (
        <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
          <ShieldWarning size={18} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">New Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!token || isSubmitting}
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green disabled:bg-gray-50"
          />

          {password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-brand-gray-neutral">Strength:</span>
                <span
                  className={
                    pwdStrength.score >= 4
                      ? 'text-brand-dark-green font-semibold'
                      : pwdStrength.score >= 2
                        ? 'text-brand-gold font-semibold'
                        : 'text-brand-error-red font-semibold'
                  }
                >
                  {pwdStrength.label}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${pwdStrength.color} transition-all duration-300`}
                  style={{ width: `${(pwdStrength.score / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">Confirm Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!token || isSubmitting}
            placeholder="Re-enter password"
            autoComplete="new-password"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green disabled:bg-gray-50"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-brand-error-red">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!token || isSubmitting}
          className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-brand-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Updating...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              <span>Reset Password</span>
            </>
          )}
        </button>
      </form>

      <Link
        to="/login"
        className="flex items-center justify-center gap-1.5 text-brand-gold text-sm font-medium hover:underline"
      >
        <ArrowLeft size={16} />
        Back to login
      </Link>
    </div>
  );
};
