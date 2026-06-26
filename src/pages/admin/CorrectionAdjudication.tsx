import React, { useState, useEffect } from 'react';
import { db, type CorrectionRequest } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Clock, ChatCenteredText } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const CorrectionAdjudication: React.FC = () => {
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejection modal state
  const [rejectReq, setRejectReq] = useState<CorrectionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const list = await db.correctionRequests
        .orderBy('timestamp')
        .reverse()
        .toArray();
      setRequests(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Handle Approve Action
  const handleApprove = async (req: CorrectionRequest) => {
    toast.loading('Processing approval...', { id: 'adjudication' });
    try {
      // 1. Update correction request status
      await db.correctionRequests.update(req.id!, { status: 'Approved' });

      // 2. Update the target transaction inside transactions table
      const originalTxn = await db.transactions.get(req.transactionId);
      if (originalTxn) {
        await db.transactions.update(req.transactionId, {
          status: 'Corrected',
          menuItemName: req.requestedItemName,
          price: req.requestedPrice,
          isSynced: false // Mark as unsynced so offline/offline-sync picks it up!
        });
      }

      // 3. Log Audit Trail
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'admin',
        action: 'Approve Correction Request',
        entity: 'CorrectionRequest',
        entityId: req.id!,
        details: JSON.stringify({ transactionId: req.transactionId, newPrice: req.requestedPrice })
      });

      toast.success('Correction request approved! Transaction updated.', { id: 'adjudication' });
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('Failed to approve request', { id: 'adjudication' });
    }
  };

  // Open Rejection Dialog
  const handleOpenReject = (req: CorrectionRequest) => {
    setRejectReq(req);
    setRejectionReason('');
  };

  // Submit Rejection
  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReq) return;
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update correction request status
      await db.correctionRequests.update(rejectReq.id!, {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim()
      });

      // 2. Log Audit Trail
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'admin',
        action: 'Reject Correction Request',
        entity: 'CorrectionRequest',
        entityId: rejectReq.id!,
        details: JSON.stringify({ transactionId: rejectReq.transactionId, reason: rejectionReason.trim() })
      });

      toast.success('Correction request rejected.');
      setRejectReq(null);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reject request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Split into categories
  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const adjudicatedRequests = requests.filter(r => r.status !== 'Pending');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-brand-light-green/30 pb-4 select-none">
        <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
          Correction Adjudication
        </h1>
        <p className="text-brand-gray-neutral text-sm mt-2">
          Review, approve, or reject cashier correction requests to ensure billing accuracy
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 border border-gray-100 rounded-[12px] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Section 1: Pending Requests */}
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
                {pendingRequests.map((req) => {
                  const dateStr = req.timestamp.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div 
                      key={req.id}
                      className="bg-brand-white border border-[rgba(50,100,50,0.1)] border-l-4 border-l-brand-gold rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4"
                    >
                      {/* Ticket top line details */}
                      <div className="flex items-start justify-between flex-wrap gap-2 text-xs select-none">
                        <div>
                          <span className="font-mono text-brand-dark-green font-semibold bg-gray-50 px-2 py-0.5 rounded border border-gray-100 mr-2">
                            {req.id}
                          </span>
                          <span className="text-brand-gray-neutral">Submitted: <strong>{dateStr}</strong> by Cashier <strong>{req.cashierName}</strong></span>
                        </div>
                        <span className="bg-brand-light-green text-brand-dark-green text-[10px] font-semibold px-2 py-0.5 rounded uppercase">
                          {req.session}
                        </span>
                      </div>

                      {/* Content Comparison grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F9FAFB]/40 p-4 rounded-[8px] border border-gray-100 text-sm">
                        <div>
                          <span className="text-brand-gray-neutral text-xs block mb-1">Employee details</span>
                          <strong className="text-brand-dark-green block">{req.employeeName}</strong>
                          <span className="text-brand-gray-neutral text-xs">Txn Reference: {req.transactionId}</span>
                        </div>

                        <div className="flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
                          <div>
                            <span className="text-brand-gray-neutral text-[11px] block">Original Registration</span>
                            <span className="text-brand-error-red line-through font-medium">
                              {req.originalItemName} ({req.originalPrice.toFixed(2)} ETB)
                            </span>
                          </div>
                          <span className="text-brand-gray-neutral hidden md:inline">➔</span>
                          <div>
                            <span className="text-brand-gray-neutral text-[11px] block">Requested Correction</span>
                            <span className="text-brand-dark-green font-bold">
                              {req.requestedItemName} ({req.requestedPrice.toFixed(2)} ETB)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reason Description */}
                      <div className="text-xs text-brand-dark-green flex items-start gap-2 bg-brand-light-green/10 p-3 rounded-[6px]">
                        <ChatCenteredText size={18} className="shrink-0 mt-0.5 text-brand-dark-green/70" />
                        <div>
                          <span className="font-semibold block text-brand-dark-green/80 select-none">Cashier Reason:</span>
                          <p className="mt-0.5 leading-relaxed">{req.reason}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-3 select-none">
                        <button
                          onClick={() => handleOpenReject(req)}
                          className="h-[36px] border border-brand-error-red text-brand-error-red font-medium text-xs px-4 rounded-[8px] hover:bg-brand-error-red/5 transition"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(req)}
                          className="h-[36px] bg-brand-dark-green text-brand-white font-medium text-xs px-4 rounded-[8px] hover:opacity-95 transition"
                        >
                          Approve & Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Adjudication History */}
          <div className="space-y-4 pt-4 select-none">
            <h3 className="text-brand-dark-green font-semibold text-lg">Adjudication History</h3>
            
            {adjudicatedRequests.length === 0 ? (
              <div className="p-8 text-center text-brand-gray-neutral text-xs">
                No adjudicated correction requests found.
              </div>
            ) : (
              <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green">
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
                        <td className="p-4 font-mono text-xs text-brand-dark-green">{req.id}</td>
                        <td className="p-4 font-medium text-brand-dark-green">{req.employeeName}</td>
                        <td className="p-4 text-brand-error-red line-through text-xs">
                          {req.originalItemName} ({req.originalPrice.toFixed(2)})
                        </td>
                        <td className="p-4 text-brand-dark-green font-semibold text-xs">
                          {req.requestedItemName} ({req.requestedPrice.toFixed(2)})
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            req.status === 'Approved'
                              ? 'bg-brand-dark-green text-brand-white'
                              : 'bg-red-100 text-brand-error-red'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-brand-gray-neutral max-w-[200px] truncate" title={req.rejectionReason || req.reason}>
                          {req.status === 'Rejected' ? `Reason: ${req.rejectionReason}` : `Notes: ${req.reason}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* REJECTION REASON DIALOG MODAL */}
      {rejectReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[420px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Reject Correction Request
              </h3>
              <button 
                onClick={() => setRejectReq(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRejection} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Reason for Rejection
                </label>
                <textarea
                  required
                  placeholder="Provide an explanation for the rejection (e.g. Invalid request details, duplicate submissions)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60"
                />
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
                  disabled={isSubmitting}
                  className="px-5 h-[40px] bg-brand-error-red text-brand-white rounded-[8px] text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
