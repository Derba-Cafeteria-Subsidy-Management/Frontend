import React, { useState, useEffect } from 'react';
import { db, type CorrectionRequest, type Transaction, type MenuItem } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Plus, PaperPlane, ClipboardText } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const CorrectionRequests: React.FC = () => {
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // New Request Wizard Modal State
  const [showWizard, setShowWizard] = useState(false);
  const [todaysTransactions, setTodaysTransactions] = useState<Transaction[]>([]);
  const [selectedTxnId, setSelectedTxnId] = useState<string>('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [requestedItemId, setRequestedItemId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch submitted requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const list = await db.correctionRequests
        .orderBy('timestamp')
        .reverse()
        .toArray();
      // Filter by current cashier
      const cashierUser = currentUser?.username || 'cashier';
      const myRequests = list.filter(req => req.cashierName === cashierUser);
      setRequests(myRequests);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUser]);

  // Load today's transactions for the creation wizard
  const handleOpenWizard = async () => {
    setShowWizard(true);
    setSelectedTxnId('');
    setSelectedTxn(null);
    setReason('');
    setRequestedItemId('');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch active (complete) transactions from today
    const txns = await db.transactions
      .where('timestamp')
      .between(startOfDay, endOfDay, true, true)
      .and(t => t.status === 'Complete')
      .toArray();

    setTodaysTransactions(txns);
  };

  // When a transaction is selected in wizard
  useEffect(() => {
    const loadTxnDetails = async () => {
      if (selectedTxnId) {
        const txn = todaysTransactions.find(t => t.id === selectedTxnId);
        if (txn) {
          setSelectedTxn(txn);
          
          // Fetch menus for session
          const menus = await db.menuItems
            .where('session')
            .equals(txn.session)
            .and(m => m.isActive && m.name !== txn.menuItemName)
            .toArray();
          setAvailableMenuItems(menus);
          setRequestedItemId('');
        }
      } else {
        setSelectedTxn(null);
        setAvailableMenuItems([]);
      }
    };
    loadTxnDetails();
  }, [selectedTxnId, todaysTransactions]);

  const handleSubmitWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxn || !requestedItemId || !reason.trim()) {
      toast.error('Please complete all fields');
      return;
    }
    if (reason.length > 250) {
      toast.error('Reason must not exceed 250 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedItem = availableMenuItems.find(m => m.id === Number(requestedItemId));
      if (!selectedItem) {
        toast.error('Selected menu item is invalid');
        setIsSubmitting(false);
        return;
      }

      const reqId = `REQ-${Math.floor(10000 + Math.random() * 90000)}`;

      const newRequest: CorrectionRequest = {
        id: reqId,
        transactionId: selectedTxn.id!,
        employeeName: selectedTxn.employeeName,
        session: selectedTxn.session,
        originalItemName: selectedTxn.menuItemName,
        originalPrice: selectedTxn.price,
        requestedItemId: selectedItem.id!,
        requestedItemName: selectedItem.name,
        requestedPrice: selectedItem.price,
        reason: reason.trim(),
        status: 'Pending',
        cashierName: currentUser?.username || 'cashier',
        timestamp: new Date()
      };

      await db.correctionRequests.add(newRequest);

      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'cashier',
        action: 'Create Correction Request',
        entity: 'CorrectionRequest',
        entityId: reqId,
        details: JSON.stringify({ transactionId: selectedTxn.id })
      });

      toast.success('Correction request submitted for admin review');
      setShowWizard(false);
      fetchRequests();
    } catch (err) {
      console.error(err);
      toast.error('Error submitting correction request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Correction Requests
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Submit and track modification requests for incorrect meal records
          </p>
        </div>

        <button
          onClick={handleOpenWizard}
          className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={18} weight="bold" />
          <span>New Request</span>
        </button>
      </div>

      {/* Requests Grids */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center select-none space-y-2">
            <ClipboardText size={48} className="text-brand-gray-neutral mx-auto opacity-75" />
            <p className="text-brand-gray-neutral text-sm">No correction requests submitted</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                  <th className="p-4">Submission Date</th>
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Original Selection</th>
                  <th className="p-4">Requested Selection</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => {
                  const dateStr = req.timestamp.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <tr 
                      key={req.id}
                      className="hover:bg-brand-light-green/5 transition-colors"
                    >
                      <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{dateStr}</td>
                      <td className="p-4 font-mono text-[13px] text-brand-dark-green whitespace-nowrap">{req.transactionId}</td>
                      <td className="p-4 font-medium text-brand-dark-green whitespace-nowrap">{req.employeeName}</td>
                      <td className="p-4 text-brand-error-red line-through whitespace-nowrap">
                        {req.originalItemName} ({req.originalPrice.toFixed(2)})
                      </td>
                      <td className="p-4 text-brand-dark-green font-semibold whitespace-nowrap">
                        {req.requestedItemName} ({req.requestedPrice.toFixed(2)})
                      </td>
                      <td className="p-4 text-brand-gray-neutral text-xs max-w-[200px] truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap select-none">
                        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${
                          req.status === 'Approved' 
                            ? 'bg-brand-dark-green text-brand-white'
                            : req.status === 'Pending'
                            ? 'bg-brand-light-green text-brand-dark-green'
                            : 'bg-red-100 text-brand-error-red'
                        }`}>
                          {req.status}
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

      {/* New Request Creation Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[480px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Create Correction Request
              </h3>
              <button 
                onClick={() => setShowWizard(false)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWizard} className="space-y-4">
              {/* Step 1: Select Today's Transaction */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Select Transaction (Today's Only)
                </label>
                <select
                  required
                  value={selectedTxnId}
                  onChange={(e) => setSelectedTxnId(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                >
                  <option value="">-- Select Transaction --</option>
                  {todaysTransactions.map(t => {
                    const time = t.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <option key={t.id} value={t.id}>
                        [{time}] {t.id} - {t.employeeName} ({t.menuItemName})
                      </option>
                    );
                  })}
                </select>
                {todaysTransactions.length === 0 && (
                  <p className="text-[11px] text-brand-error-red">No eligible transactions recorded today.</p>
                )}
              </div>

              {/* Step 2: Show original details and input form */}
              {selectedTxn && (
                <>
                  <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-4 text-xs space-y-2 select-none">
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Employee Name:</span>
                      <span className="text-brand-dark-green font-semibold">{selectedTxn.employeeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Session:</span>
                      <span className="text-brand-dark-green uppercase font-semibold">{selectedTxn.session}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray-neutral font-medium">Original Item:</span>
                      <span className="text-brand-error-red font-semibold line-through">
                        {selectedTxn.menuItemName} ({selectedTxn.price.toFixed(2)} ETB)
                      </span>
                    </div>
                  </div>

                  {/* Correct item selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-brand-dark-green">
                      Correct Menu Item
                    </label>
                    <select
                      required
                      value={requestedItemId}
                      onChange={(e) => setRequestedItemId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                    >
                      <option value="">-- Choose correct item --</option>
                      {availableMenuItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.price.toFixed(2)} ETB)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reason Text */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[13px]">
                      <label className="font-medium text-brand-dark-green">
                        Reason for Correction
                      </label>
                      <span className={`text-xs ${reason.length > 250 ? 'text-brand-error-red font-semibold' : 'text-brand-gray-neutral'}`}>
                        {reason.length}/250
                      </span>
                    </div>
                    <textarea
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={250}
                      placeholder="Explain why this correction is necessary (max 250 characters)"
                      className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-20 resize-none placeholder-brand-gray-neutral/60"
                    />
                  </div>
                </>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedTxn || !requestedItemId || !reason.trim()}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <PaperPlane size={18} />
                    <span>Submit Correction Request</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
