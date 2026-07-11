import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ShieldWarning, Info, ArrowLeft } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import axiosInstance from '../../client/axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLanguage } from '../../context/LanguageContext';

const acceptSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type AcceptInput = z.infer<typeof acceptSchema>;

function decodeTokenPayload(token: string): { email?: string; role?: string } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export const AcceptInvitation: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [roleLabel, setRoleLabel] = useState<string>('User');
  const [email, setEmail] = useState('');
  const [pwdStrength, setPwdStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: 'None',
    color: 'bg-gray-200',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AcceptInput>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  useEffect(() => {
    if (!token) {
      setErrorMsg(t('Invalid or missing invitation token.'));
      return;
    }

    const loadInvitation = async () => {
      try {
        const res = await axiosInstance.get(`/api/invitations/verify?token=${encodeURIComponent(token)}`);
        if (res.data?.success && res.data?.data) {
          setRoleLabel(res.data.data.role || 'User');
          setEmail(res.data.data.email || '');
        }
      } catch (err) {
        // Fallback JWT decode
        const payload = decodeTokenPayload(token);
        if (payload?.role) {
          setRoleLabel(payload.role);
        }
        if (payload?.email) {
          setEmail(payload.email);
        }
      }
    };

    loadInvitation();
  }, [token, t]);

  // Track password strength
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

  const onSubmit = async (data: AcceptInput) => {
    if (!token) {
      setErrorMsg(t('Invalid or missing invitation token.'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Try activate first, then fallback to accept-invitation
      try {
        await axiosInstance.put('/api/invitations/activate', { token, password: data.password });
      } catch {
        await axiosInstance.post('/api/auth/accept-invitation', { token, password: data.password });
      }

      toast.success(t('Account activated successfully!'));
      navigate('/login', { state: { message: t('Account activated. Please sign in with your new password.') } });
    } catch (error: any) {
      const message = error.response?.data?.message || t('Failed to activate account.');
      setErrorMsg(t(message));
      toast.error(t(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 select-none">
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">{t('Set Up Your Account')}</h2>
        <p className="text-brand-gray-neutral text-sm">{t('Activate your cafeteria system credentials')}</p>
      </div>

      {errorMsg && (
        <div className="bg-brand-error-red/5 border border-brand-error-red/20 text-brand-error-red p-3 rounded-[8px] text-xs flex items-start gap-2">
          <ShieldWarning size={18} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {token && (
        <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-4 rounded-r-[8px] flex gap-3 text-brand-dark-green text-xs">
          <Info size={20} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">{t('Invitation Token Detected')}</p>
            <p>
              {t('You have been invited as a')} <span className="font-bold underline">{t(roleLabel)}</span>.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {email && (
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-brand-dark-green">{t('Email Address')}</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full h-[44px] px-3 bg-gray-50 border border-gray-300 text-brand-gray-neutral rounded-[8px] cursor-default text-sm"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">{t('Create Password')}</label>
          <input
            type="password"
            disabled={!token || isSubmitting}
            placeholder={t('Password (min 8 characters)')}
            autoComplete="new-password"
            {...register('password')}
            className={`w-full h-[44px] px-3 border rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green disabled:bg-gray-50 ${
              errors.password ? 'border-brand-error-red' : 'border-gray-300'
            }`}
          />
          {errors.password && (
            <p className="text-brand-error-red text-[11px] font-medium">{t(errors.password.message || '')}</p>
          )}

          {password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-brand-gray-neutral">{t('Strength:')}</span>
                <span
                  className={
                    pwdStrength.score >= 4
                      ? 'text-brand-dark-green font-semibold'
                      : pwdStrength.score >= 2
                        ? 'text-brand-gold font-semibold'
                        : 'text-brand-error-red font-semibold'
                  }
                >
                  {t(pwdStrength.label)}
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
          <label className="block text-[13px] font-medium text-brand-dark-green">{t('Confirm Password')}</label>
          <input
            type="password"
            disabled={!token || isSubmitting}
            placeholder={t('Re-enter password')}
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={`w-full h-[44px] px-3 border rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green disabled:bg-gray-50 ${
              errors.confirmPassword ? 'border-brand-error-red' : 'border-gray-300'
            }`}
          />
          {errors.confirmPassword && (
            <p className="text-brand-error-red text-[11px] font-medium">{t(errors.confirmPassword.message || '')}</p>
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
              <span>{t('Activating...')}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              <span>{t('Activate Account')}</span>
            </>
          )}
        </button>
      </form>

      <Link
        to="/login"
        className="flex items-center justify-center gap-1.5 text-brand-gold text-sm font-medium hover:underline"
      >
        <ArrowLeft size={16} />
        {t('Back to login')}
      </Link>
    </div>
  );
};
