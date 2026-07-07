import React, { useState, useEffect } from 'react';
import axiosInstance from '../../client/axios';
import { Clock, ChatCenteredText, X, Check, WarningCircle } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { CorrectionRequest } from '../../types/api';

interface PopulatedCorrectionRequest extends CorrectionRequest {
  cashierName?: string;
  employeeName?: string;
  session?: string;
  originalItemName?: string;
  originalPrice?: number;
  requestedItemName?: string;
  requestedPrice?: number;
  // ✅ Add fields from the actual API response
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

export const CorrectionAdjudication: React.FC = () => {
  const [requests, setRequests] = useState<PopulatedCorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReq, setRejectReq] = useState<PopulatedCorrectionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Fetch correction requests from the backend
   */
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/corrections');
      if (res.data?.success && res.data?.data) {
        const raw = res.data.data;
        // ✅ The API returns data.corrections array
        const list = Array.isArray(raw) ? raw : raw.corrections || raw.data || [];
        const normalised = list.map((req: any) => ({
          ...req,
          // ✅ Use oldValue and newValue from the API response
          cashierName: req.cashierName ?? req.cashier?.email ?? 'Cashier',
          employeeName: req.employeeName ?? req.transaction?.employee?.fullName ?? req.transaction?.fullName ?? 'Employee',
          session: req.session ?? req.transaction?.mealSession ?? req.old_values?.mealSession ?? 'N/A',
          originalItemName: req.oldValue?.menuItemName ?? req.originalItemName ?? req.old_values?.menuItem ?? req.transaction?.menuItem ?? '—',
          originalPrice: req.oldValue?.menuPrice ?? req.originalPrice ?? req.old_values?.menuPrice ?? req.transaction?.menuPrice ?? 0,
          requestedItemName: req.newValue?.menuItemName ?? req.requestedItemName ?? req.new_values?.menuItem ?? req.newMenuItem?.name ?? '—',
          requestedPrice: req.newValue?.menuPrice ?? req.requestedPrice ?? req.new_values?.menuPrice ?? req.newMenuItem?.currentPrice ?? 0,
          // Keep the original oldValue/newValue for reference
          oldValue: req.oldValue,
          newValue: req.newValue,
        }));
        setRequests(normalised);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  /**
   * Approve a correction request - uses POST
   */
  const handleApprove = async (req: PopulatedCorrectionRequest) => {
    toast.loading('Processing approval...', { id: 'adj' });
    try {
      // ✅ FIXED: Use POST instead of PATCH
      await axiosInstance.post(`/api/corrections/${req.id}/approve`);
      toast.success('Correction approved successfully!', { id: 'adj' });
      fetchRequests();
    } catch (err: any) {
      console.error('Approval error:', err);
      toast.error(err.response?.data?.message || 'Failed to approve request', { id: 'adj' });
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
    try {
      // ✅ FIXED: Use POST with reason in the request body
      await axiosInstance.post(`/api/corrections/${rejectReq.id}/reject`, {
        reason: rejectionReason.trim()
      });
      toast.success('Correction request rejected.');
      setRejectReq(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err: any) {
      console.error('Rejection error:', err);
      toast.error(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const adjudicatedRequests = requests.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-8">
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

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-24 bg-gray-50 border border-gray-100 rounded-[12px] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Pending Requests */}
          <div className="space-y-4">
            <h3 className="text-brand-dark-green font-semibold text-lg flex items-center gap-1.5 select-none">
              <Clock size={20} className="opacity-80" />
              <span>Pending Review ({pendingRequests.length})</span>
            </h3>
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] text-brand-gray-neutral text-xs select-none">
                All requests have been adjudicated. No pending items.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-l-4 border-l-brand-gold rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
                    {/* Request Header */}
                    <div className="flex items-start justify-between flex-wrap gap-2 text-xs select-none">
                      <div>
                        <span className="font-mono text-brand-dark-green font-semibold bg-gray-50 px-2 py-0.5 rounded border border-gray-100 mr-2">
                          {req.id}
                        </span>
                        <span className="text-brand-gray-neutral">
                          Submitted: <strong>{new Date(req.createdAt).toLocaleString()}</strong>
                          {req.cashierName && <> by Cashier <strong>{req.cashierName}</strong></>}
                        </span>
                      </div>
                      {req.session && (
                        <span className="bg-brand-light-green text-brand-dark-green text-[10px] font-semibold px-2 py-0.5 rounded uppercase">
                          {req.session}
                        </span>
                      )}
                    </div>

                    {/* Request Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F9FAFB]/40 p-4 rounded-[8px] border border-gray-100 text-sm font-sans">
                      <div>
                        <span className="text-brand-gray-neutral text-xs block mb-1">Employee details</span>
                        <strong className="text-brand-dark-green block">{req.employeeName}</strong>
                        <span className="text-brand-gray-neutral text-xs">Txn Reference: {req.transactionId}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
                        <div>
                          <span className="text-brand-gray-neutral text-[11px] block">Original Registration</span>
                          <span className="text-brand-error-red line-through font-medium">
                            {req.originalItemName} ({Number(req.originalPrice ?? 0).toFixed(2)} ETB)
                          </span>
                        </div>
                        <span className="text-brand-gray-neutral hidden md:inline">➔</span>
                        <div>
                          <span className="text-brand-gray-neutral text-[11px] block">Requested Correction</span>
                          <span className="text-brand-dark-green font-bold">
                            {req.requestedItemName} ({Number(req.requestedPrice ?? 0).toFixed(2)} ETB)
                          </span>
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
                    <div className="flex justify-end gap-3 select-none">
                      <button
                        onClick={() => {
                          setRejectReq(req);
                          setRejectionReason('');
                        }}
                        className="h-[36px] border border-brand-error-red text-brand-error-red font-medium text-xs px-4 rounded-[8px] hover:bg-brand-error-red/5 transition flex items-center gap-1.5"
                      >
                        <X size={14} />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        className="h-[36px] bg-brand-dark-green text-brand-white font-medium text-xs px-4 rounded-[8px] hover:opacity-95 transition flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        Approve & Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adjudication History */}
          <div className="space-y-4 pt-4 select-none">
            <h3 className="text-brand-dark-green font-semibold text-lg flex items-center gap-1.5">
              <Clock size={20} className="opacity-80" />
              <span>Adjudication History ({adjudicatedRequests.length})</span>
            </h3>
            {adjudicatedRequests.length === 0 ? (
              <div className="p-8 text-center bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] text-brand-gray-neutral text-xs select-none">
                No adjudicated correction requests found.
              </div>
            ) : (
              <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                        <th className="p-4">ID</th>
                        <th className="p-4">Employee</th>
                        <th className="p-4">Original</th>
                        <th className="p-4">Requested</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adjudicatedRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-brand-light-green/5 transition-colors">
                          <td className="p-4 font-mono text-xs text-brand-dark-green">
                            {req.id?.substring(0, 12)}...
                          </td>
                          <td className="p-4 font-medium text-brand-dark-green">{req.employeeName}</td>
                          <td className="p-4 text-brand-error-red line-through text-xs">
                            {req.originalItemName} ({Number(req.originalPrice ?? 0).toFixed(2)})
                          </td>
                          <td className="p-4 text-brand-dark-green font-semibold text-xs">
                            {req.requestedItemName} ({Number(req.requestedPrice ?? 0).toFixed(2)})
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${req.status === 'APPROVED'
                                ? 'bg-brand-dark-green/10 text-brand-dark-green'
                                : 'bg-brand-error-red/10 text-brand-error-red'
                              }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-brand-gray-neutral max-w-[200px] truncate" title={req.rejectionReason || req.reason}>
                            {req.status === 'REJECTED' ? `Reason: ${req.rejectionReason}` : `Notes: ${req.reason}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
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
                    'Submitting...'
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