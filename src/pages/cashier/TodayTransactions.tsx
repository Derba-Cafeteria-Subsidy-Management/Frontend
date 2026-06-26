import React, { useState, useEffect } from 'react';
import { db, type Transaction, type MenuItem, type CorrectionRequest } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { PaperPlane } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const TodayTransactions: React.FC = () => {
  const { currentUser } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterSession, setFilterSession] = useState<'All' | 'Breakfast' | 'Lunch' | 'Dinner'>('All');
  const [loading, setLoading] = useState(true);

  // Correction request states
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItem[]>([]);
  const [requestedItemId, setRequestedItemId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch today's transactions
  const fetchTodayTransactions = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all transactions from today
      const txns = await db.transactions
        .where('timestamp')
        .between(startOfDay, endOfDay, true, true)
        .reverse()
        .toArray();

      setTransactions(txns);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayTransactions();
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (filterSession === 'All') return true;
    return t.session === filterSession;
  });

  // Handle Correction Click
  const handleOpenCorrectionModal = async (txn: Transaction) => {
    setSelectedTxn(txn);
    setReason('');
    setRequestedItemId('');

    // Fetch active menu items for the target session to display in dropdown
    const menus = await db.menuItems
      .where('session')
      .equals(txn.session)
      .and(m => m.isActive && m.name !== txn.menuItemName)
      .toArray();
    setAvailableMenuItems(menus);
  };

  // Submit Correction
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxn || !requestedItemId) {
      toast.error('Please fill in all details');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason for the correction');
      return;
    }
    if (reason.length > 250) {
      toast.error('Reason exceeds 250 characters limit');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedItem = availableMenuItems.find(m => m.id === Number(requestedItemId));
      if (!selectedItem) {
        toast.error('Invalid menu item');
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
      setSelectedTxn(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Today's Transactions
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-brand-dark-green uppercase">Session:</label>
          <select
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value as any)}
            className="h-10 px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
          >
            <option value="All">All Sessions</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-16 text-center select-none space-y-2">
            <span className="text-brand-gray-neutral text-4xl block">🔍</span>
            <p className="text-brand-gray-neutral text-sm">No transactions recorded today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                  <th className="p-4">Time</th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Session</th>
                  <th className="p-4">Menu Item</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((txn) => {
                  const timeStr = txn.timestamp.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });
                  return (
                    <tr 
                      key={txn.id}
                      className="hover:bg-brand-light-green/10 transition-colors"
                    >
                      <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{timeStr}</td>
                      <td className="p-4 font-mono text-[13px] text-brand-dark-green whitespace-nowrap">{txn.employeeId}</td>
                      <td className="p-4 font-medium text-brand-dark-green">{txn.employeeName}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="bg-[#F3F4F6] text-brand-dark-green text-[11px] font-semibold px-2 py-0.5 rounded uppercase">
                          {txn.session}
                        </span>
                      </td>
                      <td className="p-4 text-brand-dark-green">{txn.menuItemName}</td>
                      <td className="p-4 text-right text-brand-dark-green font-semibold whitespace-nowrap">{txn.price.toFixed(2)} ETB</td>
                      <td className="p-4 text-center whitespace-nowrap select-none">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          txn.status === 'Complete' 
                            ? 'bg-brand-dark-green text-brand-white' 
                            : 'bg-brand-light-green text-brand-dark-green border border-brand-light-green/45'
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap select-none">
                        {txn.status === 'Complete' ? (
                          <button
                            onClick={() => handleOpenCorrectionModal(txn)}
                            className="text-brand-gold font-medium hover:underline text-xs"
                          >
                            Request Correction
                          </button>
                        ) : (
                          <span className="text-brand-gray-neutral text-xs italic">Corrected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Correction Request Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[480px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                New Correction Request
              </h3>
              <button 
                onClick={() => setSelectedTxn(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Read-Only Original details */}
            <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-4 text-xs space-y-2 select-none">
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Transaction ID:</span>
                <span className="font-mono text-brand-dark-green font-semibold">{selectedTxn.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Employee Name:</span>
                <span className="text-brand-dark-green font-semibold">{selectedTxn.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral font-medium">Original Selection:</span>
                <span className="text-brand-error-red font-semibold line-through">{selectedTxn.menuItemName} ({selectedTxn.price.toFixed(2)} ETB)</span>
              </div>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              {/* Correct Item Dropdown */}
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
                {availableMenuItems.length === 0 && (
                  <p className="text-[11px] text-brand-error-red">No other active items found for this session.</p>
                )}
              </div>

              {/* Reason textarea */}
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
                  className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !requestedItemId}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <PaperPlane size={18} />
                    <span>Submit Request</span>
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
