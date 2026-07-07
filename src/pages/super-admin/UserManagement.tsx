import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { UserPlus, MagnifyingGlass, CaretLeft, CaretRight } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import { inviteUserRequest } from '../../lib/api/auth';
import { getErrorMessage } from '../../lib/api/errors';
import { mapAppRoleToApiRole } from '../../lib/auth/roleUtils';
import axiosInstance from '../../client/axios';

interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER';
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLogin?: string;
  invitedBy?: string;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const UserManagement: React.FC = () => {
  const { currentUser } = useApp();

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Cashier' | 'Admin'>('Cashier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // ✅ Fetch users from backend
  const fetchUsers = async (page: number = currentPage, search: string = searchTerm) => {
    setLoading(true);
    try {
      const params: any = {
        page: page,
        limit: pagination.limit
      };

      if (search.trim()) {
        // Check if search is an email
        if (search.includes('@')) {
          params.email = search.trim();
        } else {
          // Search by role or status
          const upperSearch = search.trim().toUpperCase();
          if (['SUPER_ADMIN', 'ADMIN', 'CASHIER'].includes(upperSearch)) {
            params.role = upperSearch;
          } else if (['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(upperSearch)) {
            params.status = upperSearch;
          }
        }
      }

      const res = await axiosInstance.get('/api/users', { params });

      if (res.data?.success && res.data?.data) {
        const userData = res.data.data;
        setUsers(Array.isArray(userData) ? userData : userData.users || []);

        if (userData.pagination) {
          setPagination(userData.pagination);
        } else if (userData.users && userData.pagination) {
          setPagination(userData.pagination);
        }
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load users list');
      setUsers([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUsers(1, '');
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      fetchUsers(1, searchTerm);
    }, 500);

    setSearchTimeout(timeout);

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
      fetchUsers(newPage, searchTerm);
    }
  };

  // ✅ Handle invite user
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiRole = mapAppRoleToApiRole(inviteRole) as 'ADMIN' | 'CASHIER';
      await inviteUserRequest(inviteEmail.trim().toLowerCase(), apiRole);

      setInviteSuccess(true);
      toast.success(`Invitation sent to ${inviteEmail}!`);

      // Refresh the user list after a short delay
      setTimeout(() => {
        fetchUsers(currentPage, searchTerm);
      }, 1000);
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      toast.error(
        getErrorMessage(status, {
          message: error instanceof Error ? error.message : undefined,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Get status badge color
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      'ACTIVE': { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
      'INACTIVE': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactive' },
      'PENDING': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      'SUSPENDED': { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspended' },
    };
    return statusMap[status] || statusMap['INACTIVE'];
  };

  // ✅ Get role badge color
  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { bg: string; text: string }> = {
      'SUPER_ADMIN': { bg: 'bg-purple-100', text: 'text-purple-700' },
      'ADMIN': { bg: 'bg-brand-dark-green', text: 'text-brand-white' },
      'CASHIER': { bg: 'bg-gray-100', text: 'text-brand-dark-green' },
    };
    return roleMap[role] || roleMap['CASHIER'];
  };

  return (
    <div className="space-y-6">
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
            setInviteSuccess(false);
            setInviteEmail('');
            setInviteRole('Cashier');
          }}
          className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus size={18} weight="bold" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-4 rounded-r-[8px] text-xs text-brand-dark-green">
        Invitations are sent by email through the backend. Users complete registration via the link in
        their inbox.
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search by email, role, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
        />
        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-brand-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-brand-gray-neutral text-sm">
            Loading users...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4">Invited By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-brand-gray-neutral text-sm">
                        {searchTerm ? 'No users matching search criteria' : 'No users found'}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const statusBadge = getStatusBadge(user.status);
                      const roleBadge = getRoleBadge(user.role);
                      return (
                        <tr key={user.id} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-semibold text-brand-dark-green">{user.email}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase ${roleBadge.bg} ${roleBadge.text}`}
                            >
                              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text}`}
                            >
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="p-4 text-brand-gray-neutral">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                          </td>
                          <td className="p-4 text-brand-gray-neutral text-xs">
                            {user.invitedBy || 'System'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="border-t border-gray-100 p-4 flex items-center justify-between select-none bg-gray-50/50">
                <span className="text-[11px] text-brand-gray-neutral">
                  {users.length > 0 ? (
                    <>Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users</>
                  ) : (
                    <>0 of {pagination.total}</>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1 || loading}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <CaretLeft size={18} className="text-brand-gray-neutral" />
                  </button>
                  <span className="text-[11px] text-brand-dark-green font-medium px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages || loading}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <CaretRight size={18} className="text-brand-gray-neutral" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[460px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">Invite New User</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {!inviteSuccess ? (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-brand-dark-green">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. abebe@derba.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-brand-dark-green">Access Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'Cashier' | 'Admin')}
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-xs text-brand-dark-green select-none">
                  Invitation sent successfully! The user will receive an email with a registration link.
                </div>

                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full h-[48px] bg-brand-dark-green text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {currentUser && (
        <p className="text-[11px] text-brand-gray-neutral">
          Logged in as {currentUser.email} ({currentUser.role})
        </p>
      )}
    </div>
  );
};