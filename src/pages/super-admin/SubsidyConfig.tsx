import React, { useState, useEffect } from 'react';
import { db, type SubsidyConfig } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Info, Hourglass } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const SubsidyConfigPage: React.FC = () => {
  const { currentUser } = useApp();
  const [history, setHistory] = useState<SubsidyConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Split States
  const [empShare, setEmpShare] = useState(40);
  const [compShare, setCompShare] = useState(60);
  const [configNotes, setConfigNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const list = await db.subsidyConfig
        .orderBy('id') // sorting by id or reading history
        .toArray();
      
      // Sort manually by date or timestamp
      const sortedList = [...list].sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.getTime() : new Date(a.effectiveDate).getTime();
        const timeB = b.timestamp ? b.timestamp.getTime() : new Date(b.effectiveDate).getTime();
        return timeB - timeA;
      });

      setHistory(sortedList);

      // Load current split (newest)
      if (sortedList.length > 0) {
        setEmpShare(sortedList[0].employeePercent);
        setCompShare(sortedList[0].companyPercent);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEmpChange = (val: number) => {
    if (val < 0 || val > 100) return;
    setEmpShare(val);
    setCompShare(100 - val);
  };

  const handleCompChange = (val: number) => {
    if (val < 0 || val > 100) return;
    setCompShare(val);
    setEmpShare(100 - val);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (empShare + compShare !== 100) {
      toast.error('Percentages must add up to exactly 100%');
      return;
    }
    if (!configNotes.trim()) {
      toast.error('Please enter justification notes for audit log purposes.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idStr = `CFG-${Math.floor(10000 + Math.random() * 90000)}`;
      const newConfig: SubsidyConfig = {
        id: idStr,
        employeePercent: empShare,
        companyPercent: compShare,
        effectiveDate: new Date().toISOString().split('T')[0],
        timestamp: new Date(),
        updatedBy: currentUser?.username || 'superadmin',
        notes: configNotes.trim()
      };

      await db.subsidyConfig.add(newConfig);

      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: currentUser?.username || 'superadmin',
        action: 'Adjust Subsidy Config',
        entity: 'SubsidyConfig',
        entityId: idStr,
        details: JSON.stringify({ employeeShare: empShare, companyShare: compShare, notes: configNotes.trim() })
      });

      toast.success('Subsidy configurations updated successfully!');
      setConfigNotes('');
      fetchConfigs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save configuration settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-brand-light-green/30 pb-4 select-none">
        <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
          Subsidy Configuration
        </h1>
        <p className="text-brand-gray-neutral text-sm mt-2">
          Adjust payment splits between employee payroll deductions and company subsidies
        </p>
      </div>

      {/* Main Grid: Inputs (Left) / Timeline History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* INPUTS PANEL */}
        <div className="lg:col-span-7 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <h3 className="text-brand-dark-green font-semibold text-base border-b border-gray-100 pb-3 select-none">
            Adjust Payment Allocations
          </h3>

          <form onSubmit={handleSaveConfig} className="space-y-6">
            
            {/* Visual Sliders or inputs */}
            <div className="space-y-6">
              
              {/* Employee Share Input */}
              <div className="space-y-2 select-none">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-brand-dark-green">Employee Share (Payroll Deduction)</label>
                  <span className="text-brand-dark-green font-bold text-sm bg-brand-light-green/20 px-2 py-0.5 rounded">
                    {empShare}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={empShare}
                  onChange={(e) => handleEmpChange(Number(e.target.value))}
                  className="w-full accent-brand-dark-green h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
              </div>

              {/* Company Share Input */}
              <div className="space-y-2 select-none">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-brand-dark-green">Company Share (Subsidy Cover)</label>
                  <span className="text-brand-dark-green font-bold text-sm bg-brand-light-green/20 px-2 py-0.5 rounded">
                    {compShare}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={compShare}
                  onChange={(e) => handleCompChange(Number(e.target.value))}
                  className="w-full accent-brand-dark-green h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
              </div>

            </div>

            {/* Split Allocations Graphics */}
            <div className="h-8 rounded-[8px] overflow-hidden flex text-xs font-semibold text-center leading-8 select-none">
              <div 
                className="bg-brand-light-green text-brand-dark-green transition-all" 
                style={{ width: `${empShare}%` }}
              >
                Employee ({empShare}%)
              </div>
              <div 
                className="bg-brand-dark-green text-brand-white transition-all" 
                style={{ width: `${compShare}%` }}
              >
                Company ({compShare}%)
              </div>
            </div>

            {/* Justification Notes */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-brand-dark-green select-none">
                Change Justification Notes
              </label>
              <textarea
                required
                placeholder="State the reason or authorization details for adjusting splits (e.g. Approved board adjustment for FY 2026)"
                value={configNotes}
                onChange={(e) => setConfigNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green h-24 resize-none placeholder-brand-gray-neutral/60"
              />
            </div>

            {/* Safety Warning */}
            <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-[11px] leading-relaxed text-brand-dark-green select-none flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>System split adjustment warning</strong>: Any updates to the percentages will apply to future transactions immediately. Historical records are preserved under their respective original percentage configurations.
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Configurations...' : 'Save Splits Configurations'}
            </button>

          </form>
        </div>

        {/* TIMELINE HISTORY PANEL (Right) */}
        <div className="lg:col-span-5 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
          <h3 className="text-brand-dark-green font-semibold text-base border-b border-gray-100 pb-3 flex items-center gap-1.5 select-none">
            <Hourglass size={18} />
            <span>Modification History</span>
          </h3>

          <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-[8px] animate-pulse" />
              ))
            ) : history.length === 0 ? (
              <p className="text-center text-brand-gray-neutral text-xs py-8">No historical settings changes.</p>
            ) : (
              history.map((cfg) => {
                const dateStr = cfg.timestamp ? cfg.timestamp.toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : cfg.effectiveDate;
                return (
                  <div 
                    key={cfg.id}
                    className="border border-gray-200 hover:border-brand-light-green rounded-[8px] p-3 text-xs space-y-2 transition"
                  >
                    <div className="flex justify-between items-center select-none">
                      <span className="font-bold text-brand-dark-green">Employee {cfg.employeePercent}% / Company {cfg.companyPercent}%</span>
                      <span className="text-[10px] text-brand-gray-neutral">{dateStr}</span>
                    </div>
                    <p className="text-brand-gray-neutral leading-relaxed">{cfg.notes || 'Initial Configuration Setup'}</p>
                    <div className="text-[10px] text-brand-gray-neutral/80 select-none">
                      Modified by: <strong>{cfg.updatedBy || 'system'}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export { SubsidyConfigPage as SubsidyConfig };
