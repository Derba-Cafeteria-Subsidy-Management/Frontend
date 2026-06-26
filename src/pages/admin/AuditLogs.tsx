import React, { useState, useEffect } from 'react';
import { db, type AuditLog } from '../../db/db';
import { MagnifyingGlass, ClipboardText, Eye } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State for Details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const list = await db.auditLogs
        .orderBy('timestamp')
        .reverse()
        .toArray();
      setLogs(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs by User, Action or Entity
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.user.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.entity.toLowerCase().includes(term) ||
      (log.entityId && log.entityId.toLowerCase().includes(term))
    );
  });

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
            placeholder="Search by User, Action, Entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green"
          />
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
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
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center select-none space-y-2">
            <ClipboardText size={48} className="text-brand-gray-neutral mx-auto opacity-75" />
            <p className="text-brand-gray-neutral text-sm">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-light-green bg-[#F9FAFB]/50 text-[13px] font-medium text-brand-dark-green select-none">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Entity ID</th>
                  <th className="p-4 text-center">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const dateStr = log.timestamp.toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-brand-light-green/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{dateStr}</td>
                      <td className="p-4 font-semibold text-brand-dark-green whitespace-nowrap">{log.user}</td>
                      <td className="p-4 font-medium text-brand-dark-green whitespace-nowrap">{log.action}</td>
                      <td className="p-4 text-brand-gray-neutral text-xs whitespace-nowrap">{log.entity}</td>
                      <td className="p-4 font-mono text-xs text-brand-dark-green whitespace-nowrap">{log.entityId || 'N/A'}</td>
                      <td className="p-4 text-center whitespace-nowrap select-none">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="text-brand-gold font-medium hover:underline text-xs flex items-center justify-center gap-1 mx-auto"
                        >
                          <Eye size={14} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AUDIT LOG JSON DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[500px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Audit Payload Details
              </h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Log Details */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 select-none">
                <div>
                  <span className="text-brand-gray-neutral block">Action Target</span>
                  <strong className="text-brand-dark-green">{selectedLog.action}</strong>
                </div>
                <div>
                  <span className="text-brand-gray-neutral block">Performed By</span>
                  <strong className="text-brand-dark-green">{selectedLog.user}</strong>
                </div>
              </div>

              {/* JSON Code block */}
              <div className="space-y-1.5">
                <span className="text-brand-gray-neutral block select-none">JSON Metadata Payload:</span>
                <pre className="p-4 bg-gray-50 border border-gray-200 rounded-[8px] overflow-x-auto text-[11px] font-mono text-brand-dark-green max-h-[220px]">
                  {JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}
                </pre>
              </div>
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
