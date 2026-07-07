import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnvelopeSimple, ShieldWarning, ArrowLeft } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { forgotPasswordRequest } from '../../lib/api/auth';
import { getErrorMessage } from '../../lib/api/errors';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await forgotPasswordRequest(email.trim());
      setSubmitted(true);
      toast.success('Reset email sent. Check your inbox.');
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      const message = getErrorMessage(status, {
        message: error instanceof Error ? error.message : undefined,
      });
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 select-none">
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">Forgot Password</h2>
        <p className="text-brand-gray-neutral text-sm">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {errorMsg && (
        <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
          <ShieldWarning size={18} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {submitted ? (
        <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-4 rounded-r-[8px] text-xs text-brand-dark-green space-y-2">
          <p className="font-semibold">Reset email sent</p>
          <p>
            If an account exists for <span className="font-medium">{email}</span>, you will receive
            password reset instructions shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-brand-dark-green">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green disabled:bg-gray-50 placeholder-brand-gray-neutral/60 text-sm text-brand-dark-green"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                <span>Sending...</span>
              </>
            ) : (
              <>
                <EnvelopeSimple size={18} />
                <span>Send Reset Link</span>
              </>
            )}
          </button>
        </form>
      )}

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
