import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { ShieldCheck, Info } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const AcceptInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || 'demo_token';

  const [role, setRole] = useState<'Cashier' | 'Admin'>('Cashier');
  const [email, setEmail] = useState('employee@company.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [pwdStrength, setPwdStrength] = useState<{ score: number; label: string; color: string }>({
    score: 0,
    label: 'None',
    color: 'bg-gray-200'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse invite parameters from token (simple simulation)
  useEffect(() => {
    if (token) {
      if (token.toLowerCase().includes('admin')) {
        setRole('Admin');
        setEmail('new_admin@company.com');
      } else {
        setRole('Cashier');
        setEmail('new_cashier@company.com');
      }
    }
  }, [token]);

  // Check password strength
  useEffect(() => {
    if (!password) {
      setPwdStrength({ score: 0, label: 'None', color: 'bg-gray-200' });
      return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
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

    if (!username) {
      toast.error('Please choose a username');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user already exists
      const existing = await db.users.get(username.trim());
      if (existing) {
        toast.error('Username already taken. Please choose another.');
        setIsSubmitting(false);
        return;
      }

      // Add to users table
      await db.users.add({
        username: username.trim(),
        email: email,
        role: role,
        status: 'Active',
        password: password,
        lastLogin: new Date().toLocaleString()
      });

      // Add audit log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: username.trim(),
        action: 'Accept Invite',
        entity: 'User',
        entityId: username.trim(),
        details: JSON.stringify({ role, token })
      });

      toast.success('Account activated successfully!');
      setIsSubmitting(false);
      
      // Auto login and redirect
      localStorage.setItem('cafeteria_user', JSON.stringify({
        username: username.trim(),
        email: email,
        role: role,
        status: 'Active'
      }));
      
      setTimeout(() => {
        if (role === 'Admin') {
          navigate('/admin');
        } else {
          navigate('/cashier');
        }
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.error('Activation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 select-none">
        <h2 className="text-[20px] font-semibold text-brand-dark-green font-sans">
          Set Up Your Account
        </h2>
        <p className="text-brand-gray-neutral text-sm">
          Activate your cafeteria system credentials
        </p>
      </div>

      {/* Info box: Invited as role */}
      <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-4 rounded-r-[8px] flex gap-3 text-brand-dark-green">
        <Info size={20} className="shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5">
          <p className="font-semibold">Invitation Token Detected</p>
          <p>You have been invited as a <span className="font-bold underline">{role}</span>.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email - Disabled */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full h-[44px] px-3 bg-gray-50 border border-gray-300 text-brand-gray-neutral rounded-[8px] cursor-default text-sm"
          />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">
            Choose Username
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">
            Create Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green"
          />
          
          {/* Password Strength Indicator */}
          {password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-brand-gray-neutral">Strength:</span>
                <span className={pwdStrength.score >= 4 ? 'text-brand-dark-green font-semibold' : pwdStrength.score >= 2 ? 'text-brand-gold font-semibold' : 'text-brand-error-red font-semibold'}>
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-brand-dark-green">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-2 focus:border-brand-dark-green text-sm text-brand-dark-green"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-brand-error-red">Passwords do not match</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-brand-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Activating...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              <span>Activate Account</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
