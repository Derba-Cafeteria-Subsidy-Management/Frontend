import React, { useState, useEffect } from 'react';
import axiosInstance from '../../client/axios';
import { Clock, ChatCenteredText, X, Check, WarningCircle, CaretDown, CaretRight, Spinner, MagnifyingGlass } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { CorrectionRequest } from '../../types/api';

// Extend the CorrectionRequest interface with optional fields
interface PopulatedCorrectionRequest extends Partial<CorrectionRequest> {
  id: string;
  transactionId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  cashierName?: string;
  employeeName?: string;
  employeeNumber?: string;
  transactiondate?: string;
  session?: string;
  originalItemName?: string;
  originalPrice?: number;
  requestedItemName?: string;
  requestedPrice?: number;
  rejectionReason?: string;
  oldValue?: {
    menuPrice: number;
    menuItemId: string;
    companyShare: number;
    menuItemName: string;
    employeeShare: number;
  };
  newValue?: {
    menuPrice: number;
    menuItemId: string;
    companyShare: number;
    menuItemName: string;
    employeeShare: number;
  };
}

// Pagination component
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 text-sm text-brand-dark-green disabled:text-gray-400 hover:bg-gray-100 rounded transition disabled:hover:bg-transparent"
      >
        Previous
      </button>
      <div className="flex gap-1">
        {getPageNumbers().map((page, idx) => (
          <button
            key={idx}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            className={`px-3 py-1 text-sm rounded transition ${
              page === currentPage
                ? 'bg-brand-gold text-brand-white'
                : page === '...'
                ? 'text-gray-400 cursor-default'
                : 'hover:bg-gray-100 text-brand-dark-green'
            }`}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 text-sm text-brand-dark-green disabled:text-gray-400 hover:bg-gray-100 rounded transition disabled:hover:bg-transparent"
      >
        Next
      </button>
    </div>
  );
};

// Tab configuration
type TabType = 'pending' | 'approved' | 'rejected';

interface TabConfig {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  count: number;
  status: string;
  badgeColor: string;
  badgeBg: string;
}

export const CorrectionAdjudication: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  
  // Data states
  const [pendingRequests, setPendingRequests] = useState<PopulatedCorrectionRequest[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<PopulatedCorrectionRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<PopulatedCorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search states per tab
  const [searchQuery, setSearchQuery] = useState<Record<TabType, string>>({
    pending: '',
    approved: '',
    rejected: ''
  });

  // Pagination states per tab
  const [currentPage, setCurrentPage] = useState<Record<TabType, number>>({
    pending: 1,
    approved: 1,
    rejected: 1
  });
  const itemsPerPage = 5;

  // Rejection modal state
  const [rejectReq, setRejectReq] = useState<PopulatedCorrectionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Get filtered data for current tab
  const getFilteredData = (tab: TabType) => {
    const dataMap = {
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests
    };
    const data = dataMap[tab];
    const query = searchQuery[tab].toLowerCase().trim();

    if (!query) return data;

    return data.filter(req => {
      const searchableText = [
        req.employeeName || 'Employee',
        req.employeeNumber || '',
        req.originalItemName || '',
        req.requestedItemName || '',
        req.reason || '',
        req.cashierName || '',
        req.session || '',
        req.rejectionReason || '',
        new Date(req.transactiondate || req.createdAt || '').toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      ].join(' ').toLowerCase();

      return searchableText.includes(query);
    });
  };

  const getPaginatedData = (tab: TabType) => {
    const filtered = getFilteredData(tab);
    const page = currentPage[tab];
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      data: filtered.slice(start, end),
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(prev => ({
      ...prev,
      [activeTab]: 1
    }));
  }, [searchQuery[activeTab]]);

  /**
   * Fetch correction requests by status
   */
  const fetchRequestsByStatus = async (status: string) => {
    try {
      const res = await axiosInstance.get('/api/corrections', {
        params: { status }
      });
      if (res.data?.success && res.data?.data) {
        const raw = res.data.data;
        const list = Array.isArray(raw) ? raw : raw.corrections || raw.data || [];
        return list.map((req: any) => ({
          ...req,
          cashierName: req.cashierName ?? req.cashier?.email ?? 'Cashier',
          employeeName: req.employee ?? req.transaction?.employee?.fullName ?? req.transaction?.fullName ?? 'Employee',
          employeeNumber: req.employeeNumber ?? req.transaction?.employee?.employeeNumber ?? 'N/A',
          transactiondate: req.transactiondate ?? req.transaction?.date ?? req.createdAt,
          session: req.session ?? req.transaction?.mealSession ?? req.old_values?.mealSession ?? 'N/A',
          originalItemName: req.oldValue?.menuItemName ?? req.originalItemName ?? req.old_values?.menuItem ?? req.transaction?.menuItem ?? '—',
          originalPrice: req.oldValue?.menuPrice ?? req.originalPrice ?? req.old_values?.menuPrice ?? req.transaction?.menuPrice ?? 0,
          requestedItemName: req.newValue?.menuItemName ?? req.requestedItemName ?? req.new_values?.menuItem ?? req.newMenuItem?.name ?? '—',
          requestedPrice: req.newValue?.menuPrice ?? req.requestedPrice ?? req.new_values?.menuPrice ?? req.newMenuItem?.currentPrice ?? 0,
          oldValue: req.oldValue,
          newValue: req.newValue,
          rejectionReason: req.rejectionReason || req.rejection_reason || undefined,
        }));
      }
      return [];
    } catch (e) {
      console.error(`Failed to load ${status} correction requests:`, e);
      toast.error(`Failed to load ${status} correction requests`);
      return [];
    }
  };

  /**
   * Fetch all correction requests
   */
  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const [pending, approved, rejected] = await Promise.all([
        fetchRequestsByStatus('PENDING'),
        fetchRequestsByStatus('APPROVED'),
        fetchRequestsByStatus('REJECTED')
      ]);

      setPendingRequests(pending);
      setApprovedRequests(approved);
      setRejectedRequests(rejected);
    } catch (e) {
      console.error('Failed to fetch correction requests:', e);
      toast.error('Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  /**
   * Approve a correction request - uses POST
   */
  const handleApprove = async (req: PopulatedCorrectionRequest) => {
    setProcessingId(req.id);
    toast.loading('Processing approval...', { id: `approve-${req.id}` });
    try {
      await axiosInstance.post(`/api/corrections/${req.id}/approve`);
      toast.success('Correction approved successfully!', { id: `approve-${req.id}` });

      // Remove from pending and add to approved locally
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      setApprovedRequests(prev => [...prev, { ...req, status: 'APPROVED' }]);
      setExpandedId(null);
    } catch (err: any) {
      console.error('Approval error:', err);
      toast.error(err.response?.data?.message || 'Failed to approve request', { id: `approve-${req.id}` });
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Reject a correction request - uses POST with reason in body
   */
  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReq || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    if (rejectionReason.trim().length < 10) {
      toast.error('Rejection reason must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setProcessingId(rejectReq.id);
    toast.loading('Processing rejection...', { id: `reject-${rejectReq.id}` });

    try {
      await axiosInstance.post(`/api/corrections/${rejectReq.id}/reject`, {
        reason: rejectionReason.trim()
      });
      toast.success('Correction request rejected.', { id: `reject-${rejectReq.id}` });

      // Remove from pending and add to rejected locally
      setPendingRequests(prev => prev.filter(r => r.id !== rejectReq.id));
      setRejectedRequests(prev => [...prev, { ...rejectReq, status: 'REJECTED', rejectionReason: rejectionReason.trim() }]);

      setRejectReq(null);
      setRejectionReason('');
      setExpandedId(null);
    } catch (err: any) {
      console.error('Rejection error:', err);
      toast.error(err.response?.data?.message || 'Failed to reject request', { id: `reject-${rejectReq.id}` });
    } finally {
      setIsSubmitting(false);
      setProcessingId(null);
    }
  };

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      key: 'pending',
      label: 'Pending',
      icon: <Clock size={18} className="text-brand-gold" />,
      count: pendingRequests.length,
      status: 'PENDING',
      badgeColor: 'text-brand-gold',
      badgeBg: 'bg-brand-gold/10'
    },
    {
      key: 'approved',
      label: 'Approved',
      icon: <Check size={18} className="text-green-600" />,
      count: approvedRequests.length,
      status: 'APPROVED',
      badgeColor: 'text-green-600',
      badgeBg: 'bg-green-50'
    },
    {
      key: 'rejected',
      label: 'Rejected',
      icon: <X size={18} className="text-brand-error-red" />,
      count: rejectedRequests.length,
      status: 'REJECTED',
      badgeColor: 'text-brand-error-red',
      badgeBg: 'bg-red-50'
    }
  ];

  // Render pending request items with expandable details
  const renderPendingRequests = (requests: PopulatedCorrectionRequest[]) => {
    if (requests.length === 0) {
      return (
        <div className="p-8 text-center bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] text-brand-gray-neutral text-xs select-none">
          All requests have been adjudicated. No pending items.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {requests.map((req) => {
          const isProcessing = processingId === req.id;
          return (
            <div key={req.id} className={`bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}>
              {/* Single-line clickable row */}
              <div
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-[#F9FAFB]/60 transition-colors ${isProcessing ? 'cursor-not-allowed' : ''}`}
                onClick={() => !isProcessing && setExpandedId(expandedId === req.id ? null : req.id)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <button className="shrink-0 text-brand-gray-neutral hover:text-brand-dark-green">
                    {expandedId === req.id ? (
                      <CaretDown size={18} />
                    ) : (
                      <CaretRight size={18} />
                    )}
                  </button>

                  <div className="flex items-center gap-4 flex-1 min-w-0 text-sm">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-medium text-brand-dark-green truncate">
                        {req.employeeName}
                      </span>
                      <span className="text-brand-gray-neutral text-xs shrink-0">
                        {req.employeeNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-brand-gray-neutral shrink-0">
                      <span className="hidden sm:inline">
                        {req.transactiondate ? new Date(req.transactiondate).toLocaleString() : 'N/A'}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-brand-gray-neutral/30 hidden sm:inline" />
                      <span className="text-brand-error-red line-through">
                        {Number(req.originalPrice ?? 0).toFixed(2)}
                      </span>
                      <span className="text-brand-gray-neutral">→</span>
                      <span className="text-brand-dark-green font-semibold">
                        {Number(req.requestedPrice ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold">
                    PENDING
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === req.id && (
                <div className="border-t border-[rgba(50,100,50,0.1)] p-4 space-y-4 bg-[#F9FAFB]/20">
                  {/* Request Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-brand-gray-neutral text-xs block">Employee Details</span>
                        <strong className="text-brand-dark-green block">{req.employeeName}</strong>
                        <span className="text-brand-gray-neutral text-xs">ID: {req.employeeNumber}</span>
                      </div>
                      <div>
                        <span className="text-brand-gray-neutral text-xs block">Transaction Date</span>
                        <span className="text-brand-dark-green text-sm">
                          {req.transactiondate ? new Date(req.transactiondate).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-brand-gray-neutral text-xs block">Cashier</span>
                        <span className="text-brand-dark-green font-medium">{req.cashierName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 p-3 bg-white rounded-[8px] border border-gray-100">
                        <div>
                          <span className="text-brand-gray-neutral text-[11px] block">Original Registration</span>
                          <span className="text-brand-error-red line-through font-medium">
                            {req.originalItemName} ({Number(req.originalPrice ?? 0).toFixed(2)} ETB)
                          </span>
                        </div>
                        <span className="text-brand-gray-neutral">➔</span>
                        <div>
                          <span className="text-brand-gray-neutral text-[11px] block">Requested Correction</span>
                          <span className="text-brand-dark-green font-bold">
                            {req.requestedItemName} ({Number(req.requestedPrice ?? 0).toFixed(2)} ETB)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="text-xs text-brand-dark-green flex items-start gap-2 bg-brand-light-green/10 p-3 rounded-[6px]">
                    <ChatCenteredText size={18} className="shrink-0 mt-0.5 text-brand-dark-green/70" />
                    <div>
                      <span className="font-semibold block text-brand-dark-green/80 select-none">Cashier Reason:</span>
                      <p className="mt-0.5 leading-relaxed">{req.reason}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 select-none pt-2">
                    <button
                      onClick={() => {
                        setRejectReq(req);
                        setRejectionReason('');
                      }}
                      disabled={isProcessing}
                      className="h-[36px] border border-brand-error-red text-brand-error-red font-medium text-xs px-4 rounded-[8px] hover:bg-brand-error-red/5 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X size={14} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="h-[36px] bg-brand-dark-green text-brand-white font-medium text-xs px-4 rounded-[8px] hover:opacity-95 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <Spinner size={14} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          Approve & Apply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render table for approved/rejected requests
  const renderTableData = (requests: PopulatedCorrectionRequest[], tab: TabType) => {
    const isRejected = tab === 'rejected';

    if (requests.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <div className="p-8 text-center select-none space-y-2">
              <p className="text-brand-gray-neutral text-sm">No {tab} correction requests found.</p>
            </div>
          </td>
        </tr>
      );
    }

    return requests.map((req) => (
      <tr key={req.id} className="hover:bg-brand-light-green/5 transition-colors">
        <td className="p-4 font-medium text-brand-dark-green">{req.employeeName}</td>
        <td className="p-4 text-xs text-brand-gray-neutral">{req.employeeNumber}</td>
        <td className="p-4 text-brand-error-red line-through text-xs">
          {req.originalItemName} ({Number(req.originalPrice ?? 0).toFixed(2)})
        </td>
        <td className="p-4 text-brand-dark-green font-semibold text-xs">
          {req.requestedItemName} ({Number(req.requestedPrice ?? 0).toFixed(2)})
        </td>
        <td className="p-4 text-xs text-brand-gray-neutral">
          {req.transactiondate ? new Date(req.transactiondate).toLocaleDateString() : 'N/A'}
        </td>
        <td className="p-4 text-xs max-w-[150px]">
          <div 
            className={`truncate ${isRejected ? 'text-brand-error-red' : 'text-brand-gray-neutral'}`} 
            title={isRejected ? (req.rejectionReason || req.reason) : req.reason}
          >
            {isRejected ? (req.rejectionReason || req.reason) : req.reason}
          </div>
        </td>
      </tr>
    ));
  };

  // Render tab content
  const renderTabContent = (tab: TabType) => {
    const { data, totalItems, totalPages } = getPaginatedData(tab);

    if (tab === 'pending') {
      return (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
            <input
              type="text"
              value={searchQuery[tab]}
              onChange={(e) => setSearchQuery(prev => ({
                ...prev,
                [tab]: e.target.value
              }))}
              placeholder="Search pending requests..."
              className="w-full pl-10 pr-4 h-[44px] border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/60"
            />
          </div>

          {/* Pending Cards */}
          {renderPendingRequests(data)}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage[tab]}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(prev => ({
              ...prev,
              [tab]: page
            }))}
          />
          
          {/* Results count */}
          <div className="text-xs text-brand-gray-neutral">
            Showing {data.length} of {totalItems} results
          </div>
        </div>
      );
    }

    // Approved and Rejected use table view
    return (
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-brand-light-green bg-[#F9FAFB]/30">
          <div className="relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
            <input
              type="text"
              value={searchQuery[tab]}
              onChange={(e) => setSearchQuery(prev => ({
                ...prev,
                [tab]: e.target.value
              }))}
              placeholder={`Search ${tab} requests...`}
              className="w-full pl-10 pr-4 h-[40px] border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green placeholder-brand-gray-neutral/60"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                <th className="p-4">Employee</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Original</th>
                <th className="p-4">Requested</th>
                <th className="p-4">Date</th>
                <th className="p-4">{tab === 'rejected' ? 'Rejection Reason' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renderTableData(data, tab)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage[tab]}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(prev => ({
            ...prev,
            [tab]: page
          }))}
        />
        
        {/* Results count */}
        <div className="px-4 py-2 text-xs text-brand-gray-neutral border-t border-gray-200 bg-gray-50/30">
          Showing {data.length} of {totalItems} results
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-light-green/30 pb-4 select-none">
        <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none flex items-center gap-2">
          <WarningCircle size={28} className="text-brand-gold" />
          Correction Adjudication
        </h1>
        <p className="text-brand-gray-neutral text-sm mt-2">
          Review, approve, or reject cashier correction requests to ensure billing accuracy
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-light-green/30">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
              activeTab === tab.key
                ? 'border-brand-gold text-brand-dark-green'
                : 'border-transparent text-brand-gray-neutral hover:text-brand-dark-green'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-brand-light-green/30 text-brand-dark-green' : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-12 bg-gray-50 border border-gray-100 rounded-[12px] animate-pulse" />
          ))}
        </div>
      ) : (
        renderTabContent(activeTab)
      )}

      {/* Rejection Modal */}
      {rejectReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[420px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <X size={20} className="text-brand-error-red" />
                Reject Correction Request
              </h3>
              <button
                onClick={() => setRejectReq(null)}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRejection} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Reason for Rejection <span className="text-brand-error-red">*</span>
                </label>
                <textarea
                  required
                  placeholder="Explain why this correction request is being rejected (min 10 characters)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60"
                />
                <div className="flex justify-between text-[10px] text-brand-gray-neutral">
                  <span>Min 10 characters</span>
                  <span>{rejectionReason.length}/250</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setRejectReq(null)}
                  className="px-4 h-[40px] border border-gray-300 rounded-[8px] text-xs text-brand-dark-green hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rejectionReason.trim().length < 10}
                  className="px-5 h-[40px] bg-brand-error-red text-brand-white rounded-[8px] text-xs font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size={14} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <X size={14} />
                      Reject Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};