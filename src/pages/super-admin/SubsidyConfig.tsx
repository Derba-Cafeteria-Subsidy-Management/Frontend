import React, { useState, useEffect } from 'react';
import axiosInstance from '../../client/axios';
import { Info, Hourglass } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import type { SubsidyConfig } from '../../types/api';

interface SubsidyConfigEntry extends SubsidyConfig {
  notes?: string;
  updatedBy?: string;
  SubsidyPolicy?: string;
}

export const SubsidyConfigPage: React.FC = () => {
  const [history, setHistory] = useState<SubsidyConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [empShare, setEmpShare] = useState(40);
  const [compShare, setCompShare] = useState(60);
  const [subsidyPolicy, setSubsidyPolicy] = useState<'DEFAULT' | 'FULL_COMPANY'>('DEFAULT');
  const [configNotes, setConfigNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      // Fetch both policies
      const [defaultRes, fullCompanyRes] = await Promise.allSettled([
        axiosInstance.get('/api/subsidy', { params: { policy: 'DEFAULT' } }),
        axiosInstance.get('/api/subsidy', { params: { policy: 'FULL_COMPANY' } })
      ]);

      const configs: SubsidyConfigEntry[] = [];

      // Process DEFAULT policy response
      if (defaultRes.status === 'fulfilled' && defaultRes.value.data?.success && defaultRes.value.data?.data) {
        const data = defaultRes.value.data.data;
        configs.push({
          ...data,
          SubsidyPolicy: 'DEFAULT',
          notes: 'Current DEFAULT configuration',
          updatedBy: 'system'
        });
      }

      // Process FULL_COMPANY policy response
      if (fullCompanyRes.status === 'fulfilled' && fullCompanyRes.value.data?.success && fullCompanyRes.value.data?.data) {
        const data = fullCompanyRes.value.data.data;
        configs.push({
          ...data,
          SubsidyPolicy: 'FULL_COMPANY',
          notes: 'Current FULL_COMPANY configuration',
          updatedBy: 'system'
        });
      }

      if (configs.length > 0) {
        setHistory(configs);
        
        // Set form to the first configuration found (or DEFAULT preference)
        const defaultConfig = configs.find(c => c.SubsidyPolicy === 'DEFAULT') || configs[0];
        setEmpShare(defaultConfig.employeePercent);
        setCompShare(defaultConfig.companyPercent);
        setSubsidyPolicy(defaultConfig.SubsidyPolicy as 'DEFAULT' | 'FULL_COMPANY');
      } else {
        setHistory([]);
        setEmpShare(40);
        setCompShare(60);
        setSubsidyPolicy('DEFAULT');
        toast.success('No subsidy configuration found. Create one below.', {
          icon: 'ℹ️',
          duration: 4000,
        });
      }
    } catch (e: any) {
      console.error(e);
      setHistory([]);
      setEmpShare(40);
      setCompShare(60);
      setSubsidyPolicy('DEFAULT');
      toast.error('Failed to load subsidy configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchConfigs(); 
  }, []);

  const handlePolicyChange = (policy: 'DEFAULT' | 'FULL_COMPANY') => {
    setSubsidyPolicy(policy);
    
    // Load existing configuration for selected policy if available
    const existingConfig = history.find(c => c.SubsidyPolicy === policy);
    if (existingConfig) {
      setEmpShare(existingConfig.employeePercent);
      setCompShare(existingConfig.companyPercent);
    }
    // Don't auto-set percentages if no config exists - let user adjust them manually
  };

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
      const payload = {
        employeePercent: empShare,
        companyPercent: compShare,
        effectiveFrom: new Date().toISOString().split('T')[0],
        SubsidyPolicy: subsidyPolicy
      };

      const res = await axiosInstance.post('/api/subsidy', payload);

      if (res.data?.success || res.status === 201) {
        toast.success(`Subsidy configuration for ${subsidyPolicy} policy updated successfully!`);
        setConfigNotes('');
        fetchConfigs();
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.message || 'Failed to save configuration settings';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(50, 100, 50, 0.15);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(50, 100, 50, 0.25);
        }
      `}</style>

      <div className="border-b border-brand-light-green/30 pb-4 select-none">
        <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">Subsidy Configuration</h1>
        <p className="text-brand-gray-neutral text-sm mt-2">
          Adjust payment splits between employee payroll deductions and company subsidies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* INPUTS PANEL */}
        <div className="lg:col-span-7 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 space-y-6">
          <h3 className="text-brand-dark-green font-semibold text-base border-b border-gray-100 pb-3 select-none">
            Adjust Payment Allocations
          </h3>

          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Policy Selection */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-brand-dark-green select-none">
                Subsidy Policy Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePolicyChange('DEFAULT')}
                  className={`p-3 rounded-[8px] border-2 text-sm font-medium transition-all ${
                    subsidyPolicy === 'DEFAULT'
                      ? 'border-brand-dark-green bg-brand-light-green/20 text-brand-dark-green'
                      : 'border-gray-200 text-brand-gray-neutral hover:border-brand-light-green/50'
                  }`}
                >
                  <div className="text-xs font-semibold">DEFAULT</div>
                  <div className="text-[11px] mt-1">Standard Split Policy</div>
                </button>
                <button
                  type="button"
                  onClick={() => handlePolicyChange('FULL_COMPANY')}
                  className={`p-3 rounded-[8px] border-2 text-sm font-medium transition-all ${
                    subsidyPolicy === 'FULL_COMPANY'
                      ? 'border-brand-dark-green bg-brand-light-green/20 text-brand-dark-green'
                      : 'border-gray-200 text-brand-gray-neutral hover:border-brand-light-green/50'
                  }`}
                >
                  <div className="text-xs font-semibold">FULL COMPANY</div>
                  <div className="text-[11px] mt-1">Company-Focused Policy</div>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2 select-none">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-brand-dark-green">
                    Employee Share (Payroll Deduction)
                  </label>
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

              <div className="space-y-2 select-none">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-brand-dark-green">
                    Company Share (Subsidy Cover)
                  </label>
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

            {/* Allocation Bar */}
            <div className="h-8 rounded-[8px] overflow-hidden flex text-xs font-semibold text-center leading-8 select-none">
              <div 
                className={`transition-all ${empShare === 0 ? 'hidden' : 'bg-brand-light-green text-brand-dark-green'}`}
                style={{ width: `${empShare}%` }}
              >
                {empShare > 0 && `Employee (${empShare}%)`}
              </div>
              <div 
                className="bg-brand-dark-green text-brand-white transition-all" 
                style={{ width: `${compShare}%` }}
              >
                Company ({compShare}%)
              </div>
            </div>

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

            {/* Policy Info */}
            <div className={`border-l-4 p-3 rounded-r-[8px] text-[11px] leading-relaxed select-none flex gap-2 ${
              subsidyPolicy === 'FULL_COMPANY' 
                ? 'bg-brand-dark-green/10 border-brand-dark-green text-brand-dark-green' 
                : 'bg-brand-light-green/20 border-brand-light-green text-brand-dark-green'
            }`}>
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Policy Type: {subsidyPolicy === 'FULL_COMPANY' ? 'FULL COMPANY' : 'DEFAULT'}</strong>
                <br />
                {subsidyPolicy === 'FULL_COMPANY' 
                  ? 'Full Company policy typically indicates higher company contribution, but you can still adjust the exact percentages as needed.'
                  : 'Standard split policy. Adjust the percentages above to set the allocation between employee and company.'
                }
                <br />
                <strong>Note:</strong> Any updates will apply to future transactions immediately. Historical records remain unchanged.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Configurations...' : `Save ${subsidyPolicy} Configuration`}
            </button>
          </form>
        </div>

        {/* HISTORY PANEL */}
        <div className="lg:col-span-5 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-brand-dark-green font-semibold text-base flex items-center gap-1.5 select-none">
              <Hourglass size={18} />
              <span>Current Configurations</span>
            </h3>
            {!loading && history.length > 0 && (
              <span className="text-[11px] text-brand-gray-neutral bg-gray-50 px-2 py-1 rounded-full">
                {history.length} active
              </span>
            )}
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1 custom-scrollbar">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-[10px] border border-gray-100 bg-gray-50 p-4 animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                      <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
                  <Hourglass size={28} className="text-brand-gray-neutral/40" />
                </div>
                <p className="text-sm font-medium text-brand-dark-green mb-1">No Configurations Set</p>
                <p className="text-xs text-brand-gray-neutral max-w-[250px] mx-auto leading-relaxed">
                  Create subsidy configurations using the form to define payment splits for different policies
                </p>
              </div>
            ) : (
              history.map((cfg) => (
                <div
                  key={cfg.id}
                  onClick={() => handlePolicyChange(cfg.SubsidyPolicy as 'DEFAULT' | 'FULL_COMPANY')}
                  className={`group relative rounded-[10px] border-2 p-4 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    cfg.SubsidyPolicy === subsidyPolicy
                      ? 'border-brand-gold bg-brand-gold/5 shadow-sm'
                      : cfg.SubsidyPolicy === 'FULL_COMPANY'
                        ? 'border-brand-dark-green/20 bg-white hover:border-brand-dark-green/40'
                        : 'border-brand-light-green/20 bg-white hover:border-brand-light-green/40'
                  }`}
                >
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-brand-dark-green truncate">
                          {cfg.SubsidyPolicy === 'FULL_COMPANY' ? 'Full Company' : 'Default'}
                        </h4>
                        {cfg.SubsidyPolicy === subsidyPolicy && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-gold/20 text-brand-gold">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-brand-gray-neutral">
                        {cfg.SubsidyPolicy === 'FULL_COMPANY' 
                          ? 'Company-focused subsidy policy'
                          : 'Standard split policy'
                        }
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      cfg.SubsidyPolicy === 'FULL_COMPANY'
                        ? 'bg-brand-dark-green/10 text-brand-dark-green'
                        : 'bg-brand-light-green/20 text-brand-dark-green'
                    }`}>
                      {cfg.SubsidyPolicy === 'FULL_COMPANY' ? 'FULL' : 'STD'}
                    </span>
                  </div>

                  {/* Split Visualization */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] font-medium text-brand-gray-neutral">Split Ratio</span>
                      <span className="text-[11px] font-mono text-brand-dark-green">
                        {cfg.employeePercent}/{cfg.companyPercent}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div 
                        className="h-full bg-brand-light-green transition-all duration-300"
                        style={{ width: `${cfg.employeePercent}%` }}
                      />
                      <div 
                        className="h-full bg-brand-dark-green transition-all duration-300"
                        style={{ width: `${cfg.companyPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-brand-gray-neutral">Employee</span>
                      <span className="text-[9px] text-brand-gray-neutral">Company</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-[6px] p-2">
                      <span className="block text-[9px] text-brand-gray-neutral mb-0.5">Employee Share</span>
                      <span className="text-xs font-semibold text-brand-dark-green">{cfg.employeePercent}%</span>
                    </div>
                    <div className="bg-gray-50 rounded-[6px] p-2">
                      <span className="block text-[9px] text-brand-gray-neutral mb-0.5">Company Cover</span>
                      <span className="text-xs font-semibold text-brand-dark-green">{cfg.companyPercent}%</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 text-brand-gray-neutral">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        cfg.SubsidyPolicy === subsidyPolicy ? 'bg-green-500' : 'bg-gray-300'
                      }`}></div>
                      <span>
                        {cfg.SubsidyPolicy === subsidyPolicy ? 'Currently Active' : 'Inactive'}
                      </span>
                    </div>
                    <span className="text-brand-gray-neutral/60 font-mono">
                      {cfg.effectiveFrom 
                        ? new Date(cfg.effectiveFrom).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })
                        : 'N/A'
                      }
                    </span>
                  </div>

                  {cfg.effectiveTo && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-brand-gray-neutral/60">
                        Expires: {new Date(cfg.effectiveTo).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className={`absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                    cfg.SubsidyPolicy === subsidyPolicy
                      ? 'bg-brand-gold/5'
                      : 'bg-gray-50/50'
                  }`} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { SubsidyConfigPage as SubsidyConfig };