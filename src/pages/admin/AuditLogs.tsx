import React, { useState, useEffect } from 'react';
import axiosInstance from '../../client/axios';
import { MagnifyingGlass, ClipboardText, Eye, CaretLeft, CaretRight } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Modal State for Details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // ✅ Fetch logs from backend
  const fetchLogs = async (page: number = currentPage, search: string = searchTerm) => {
    setLoading(true);
    try {
      const params: any = {
        page: page,
        limit: pagination.limit
      };

      // Add search filters if search term exists
      if (search.trim()) {
        // Check if search matches known action types
        const upperSearch = search.trim().toUpperCase();
        const actionTypes = [
          'USER_INVITED', 'INVITATION_ACCEPTED', 'LOGIN_SUCCESS', 'LOGIN_FAILURE',
          'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'LOGOUT', 'LOGOUT_ALL',
          'USER_STATUS_CHANGED', 'ROLE_CHANGED', 'MENU_ITEM_CREATED', 'MENU_ITEM_UPDATED',
          'MENU_ITEM_DELETED', 'PRICE_HISTORY_CREATED', 'CREATE_TRANSACTION', 'CREATE_EMPLOYEE',
          'UPDATE_EMPLOYEE', 'DEACTIVATE_EMPLOYEE', 'ACTIVATE_EMPLOYEE', 'EMPLOYEE_DELETED',
          'CREATE_CORRECTION_REQUEST', 'APPROVE_CORRECTION', 'REJECT_CORRECTION',
          'CREATE_SUBSIDY_CONFIG', 'OFFLINE_SYNC_BATCH', 'SYSTEM_SETTINGS_UPDATED'
        ];

        // Check if search looks like an action
        if (actionTypes.some(action => action.includes(upperSearch) || upperSearch.includes(action))) {
          params.action = upperSearch;
        }
        // Check if search looks like an entity type
        else if (['USER', 'TRANSACTION', 'EMPLOYEE', 'MENU', 'SUBSIDY', 'SYSTEM'].includes(upperSearch)) {
          params.entityType = upperSearch;
        }
        // Check if search looks like a user ID or email
        else if (search.includes('@') || search.length > 30) {
          params.userId = search;
        }
        // Otherwise treat as generic search
        else {
          // Try entityId search
          params.entityId = search;
        }
      }

      const res = await axiosInstance.get('/api/audit-logs', { params });

      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setLogs(data.logs || []);

        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        setLogs([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs(1, '');
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      fetchLogs(1, searchTerm);
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
      fetchLogs(newPage, searchTerm);
    }
  };

  // ✅ Format action for display
  const formatAction = (action: string) => {
    return action
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // ✅ Get action badge color
  const getActionColor = (action: string) => {
    const actionMap: Record<string, string> = {
      'LOGIN_SUCCESS': 'text-green-700 bg-green-100',
      'LOGIN_FAILURE': 'text-red-700 bg-red-100',
      'LOGOUT': 'text-gray-700 bg-gray-100',
      'USER_INVITED': 'text-blue-700 bg-blue-100',
      'INVITATION_ACCEPTED': 'text-blue-700 bg-blue-100',
      'CREATE_TRANSACTION': 'text-purple-700 bg-purple-100',
      'CREATE_EMPLOYEE': 'text-teal-700 bg-teal-100',
      'UPDATE_EMPLOYEE': 'text-teal-700 bg-teal-100',
      'DEACTIVATE_EMPLOYEE': 'text-red-700 bg-red-100',
      'ACTIVATE_EMPLOYEE': 'text-green-700 bg-green-100',
      'EMPLOYEE_DELETED': 'text-red-700 bg-red-100',
      'MENU_ITEM_CREATED': 'text-amber-700 bg-amber-100',
      'MENU_ITEM_UPDATED': 'text-amber-700 bg-amber-100',
      'MENU_ITEM_DELETED': 'text-red-700 bg-red-100',
      'PRICE_HISTORY_CREATED': 'text-amber-700 bg-amber-100',
      'CREATE_CORRECTION_REQUEST': 'text-orange-700 bg-orange-100',
      'APPROVE_CORRECTION': 'text-green-700 bg-green-100',
      'REJECT_CORRECTION': 'text-red-700 bg-red-100',
      'CREATE_SUBSIDY_CONFIG': 'text-indigo-700 bg-indigo-100',
      'SYSTEM_SETTINGS_UPDATED': 'text-indigo-700 bg-indigo-100',
    };
    return actionMap[action] || 'text-brand-dark-green bg-gray-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            System Audit Logs
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Track and monitor administrator and cashier activities across the system
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] select-none">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search by user, action, entity, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green"
          />
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-4 w-4 text-brand-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center select-none space-y-2">
            <ClipboardText size={48} className="text-brand-gray-neutral mx-auto opacity-75" />
            <p className="text-brand-gray-neutral text-sm">
              {searchTerm ? 'No audit logs matching search criteria' : 'No audit logs found'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Entity</th>
                    <th className="p-4 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const dateStr = new Date(log.createdAt).toLocaleString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                    const actionColor = getActionColor(log.action);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-brand-light-green/5 transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{dateStr}</td>
                        <td className="p-4 font-semibold text-brand-dark-green whitespace-nowrap">
                          {log.user?.email || 'System'}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${actionColor}`}>
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">
                          {log.entityType}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap select-none">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="text-brand-gold font-medium hover:underline text-xs flex items-center justify-center gap-1 mx-auto"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="border-t border-gray-100 p-4 flex items-center justify-between select-none bg-gray-50/50">
                <span className="text-[11px] text-brand-gray-neutral">
                  {logs.length > 0 ? (
                    <>Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs</>
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

      {/* AUDIT LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[600px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">

            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Audit Log Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Log Details */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider">Action</span>
                  <strong className="text-brand-dark-green block mt-1">{formatAction(selectedLog.action)}</strong>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider">Performed By</span>
                  <strong className="text-brand-dark-green block mt-1">{selectedLog.user?.email || 'System'}</strong>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider">Entity Type</span>
                  <strong className="text-brand-dark-green block mt-1">{selectedLog.entityType}</strong>
                </div>
                <div className="bg-gray-50 p-2 rounded col-span-2">
                  <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider">Timestamp</span>
                  <strong className="text-brand-dark-green block mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </strong>
                </div>
                {selectedLog.ipAddress && (
                  <div className="bg-gray-50 p-2 rounded col-span-2">
                    <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider">IP Address</span>
                    <strong className="text-brand-dark-green block mt-1 font-mono">{selectedLog.ipAddress}</strong>
                  </div>
                )}
              </div>

              {/* JSON Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-brand-gray-neutral block text-[10px] uppercase tracking-wider select-none">Metadata Payload:</span>
                  <pre className="p-4 bg-gray-50 border border-gray-200 rounded-[8px] overflow-x-auto text-[11px] font-mono text-brand-dark-green max-h-[200px]">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div className="text-[10px] text-brand-gray-neutral/60 pt-1 border-t border-gray-100">
                  <span>User Agent: </span>
                  <span className="font-mono">{selectedLog.userAgent}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end select-none">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 h-[40px] bg-brand-dark-green text-brand-white rounded-[8px] text-xs font-medium hover:opacity-90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};