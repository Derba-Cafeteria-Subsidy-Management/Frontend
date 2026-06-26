import React, { useState, useEffect } from 'react';
import { db, type User } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { UserPlus, Copy, Link as LinkIcon } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const UserManagement: React.FC = () => {
  const { currentUser } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'Cashier' | 'Admin'>('Cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generated Link details
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const list = await db.users.toArray();
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim() || !inviteEmail.trim()) {
      toast.error('All fields are required');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check duplicate
      const exist = await db.users.get(inviteUsername.trim().toLowerCase());
      if (exist) {
        toast.error('Username already registered');
        setIsSubmitting(false);
        return;
      }

      // Generate a mock token
      const token = `tok_${Math.floor(100000 + Math.random() * 900000)}`;

      // Save user record inside DB in Pending state
      const newUser: User = {
        username: inviteUsername.trim().toLowerCase(),
        password: '', // will be set on acceptance
        role: inviteRole,
        status: 'Pending',
        email: inviteEmail.trim().toLowerCase(),
        invitationToken: token
      };

      await db.users.add(newUser);

      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'superadmin',
        action: 'Invite User',
        entity: 'User',
        entityId: newUser.username,
        details: JSON.stringify({ role: inviteRole, email: inviteEmail })
      });

      // Construct simulation acceptance URL
      const acceptanceUrl = `${window.location.origin}/accept-invitation?token=${token}`;
      setInvitationLink(acceptanceUrl);
      
      toast.success(`Invitation recorded for ${inviteUsername}!`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      toast.success('Invitation link copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            User Management
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Supervise personnel access profiles, invite new cashiers, and control administrator roles
          </p>
        </div>

        <button
          onClick={() => {
            setShowInviteModal(true);
            setInvitationLink(null);
            setInviteUsername('');
            setInviteEmail('');
            setInviteRole('Cashier');
          }}
          className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus size={18} weight="bold" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Users table */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                  <th className="p-4">Username</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  return (
                    <tr 
                      key={u.username}
                      className="hover:bg-brand-light-green/5 transition-colors"
                    >
                      <td className="p-4 font-semibold text-brand-dark-green">{u.username}</td>
                      <td className="p-4 text-brand-gray-neutral">{u.email || 'N/A'}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase ${
                          u.role === 'Super Admin' 
                            ? 'bg-brand-gold text-brand-white' 
                            : u.role === 'Admin'
                            ? 'bg-brand-dark-green text-brand-white'
                            : 'bg-gray-100 text-brand-dark-green'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap select-none">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          u.status === 'Active' 
                            ? 'bg-brand-dark-green text-brand-white'
                            : u.status === 'Pending'
                            ? 'bg-brand-light-green text-brand-dark-green'
                            : 'bg-red-100 text-brand-error-red'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INVITE USER DIALOG MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[460px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Invite New User
              </h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {!invitationLink ? (
              <form onSubmit={handleSendInvite} className="space-y-4">
                
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-brand-dark-green">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. abebe_k"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-brand-dark-green">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. abebe@derba.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-brand-dark-green">
                    Access Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Invitation...' : 'Send Invitation'}
                </button>

              </form>
            ) : (
              // Invitation Link Created Display
              <div className="space-y-5">
                <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-xs text-brand-dark-green select-none">
                  Invitation recorded! Provide the link below to the user to configure their credential passwords.
                </div>

                <div className="space-y-1.5">
                  <span className="text-[12px] font-semibold text-brand-dark-green block">Simulation Invite Link:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={invitationLink}
                      className="flex-1 h-[40px] px-3 border border-gray-300 rounded-[8px] focus:outline-none bg-gray-50 text-xs text-brand-dark-green font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="h-[40px] w-[40px] bg-brand-gold hover:opacity-90 rounded-[8px] text-brand-white flex items-center justify-center shrink-0"
                      title="Copy to Clipboard"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2 select-none">
                  <a
                    href={invitationLink}
                    target="_blank"
                    rel="noreferrer"
                    className="h-[40px] bg-brand-dark-green text-brand-white px-5 rounded-[8px] text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5"
                  >
                    <LinkIcon size={14} />
                    <span>Test Registration Flow</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
