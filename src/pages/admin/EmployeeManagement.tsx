import React, { useState, useEffect } from 'react';
import { db, type Employee } from '../../db/db';
import { MagnifyingGlass, Plus, Fingerprint } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  
  // Form states
  const [isNew, setIsNew] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('Engineering');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formPhoto, setFormPhoto] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
  const [formFingerprint, setFormFingerprint] = useState(false);
  
  // Registration simulation state
  const [registeringBiometric, setRegisteringBiometric] = useState(false);

  const fetchEmployees = async () => {
    try {
      const list = await db.employees.toArray();
      setEmployees(list);
      // Select first employee initially if none selected
      if (list.length > 0 && !selectedEmp && !isNew) {
        handleSelectEmployee(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSelectEmployee = (emp: Employee) => {
    setIsNew(false);
    setSelectedEmp(emp);
    setFormId(emp.id);
    setFormName(emp.name);
    setFormDept(emp.department);
    setFormStatus(emp.status);
    setFormPhoto(emp.photo);
    setFormFingerprint(emp.fingerprintRegistered);
  };

  const handleCreateNewClick = () => {
    setIsNew(true);
    setSelectedEmp(null);
    
    // Generate next EMP ID
    const nextNum = employees.length + 129; // offsets from seed limit
    setFormId(`EMP-${nextNum}`);
    setFormName('');
    setFormDept('Engineering');
    setFormStatus('Active');
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormFingerprint(false);
  };

  // Simulate registering fingerprint
  const handleRegisterFingerprint = () => {
    setRegisteringBiometric(true);
    toast.loading('Place finger on scanner terminal...', { id: 'fp-scan' });
    
    setTimeout(() => {
      setRegisteringBiometric(false);
      setFormFingerprint(true);
      toast.success('Fingerprint templates recorded successfully!', { id: 'fp-scan' });
    }, 2000);
  };

  // Photo Selector simulation
  const handleSimulatePhotoUpload = () => {
    const photos = [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80'
    ];
    const randPhoto = photos[Math.floor(Math.random() * photos.length)];
    setFormPhoto(randPhoto);
    toast.success('Photo updated!');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter Employee Full Name');
      return;
    }

    try {
      const empData: Employee = {
        id: formId,
        name: formName.trim(),
        department: formDept,
        status: formStatus,
        photo: formPhoto,
        fingerprintRegistered: formFingerprint,
        fingerprintTemplate: formFingerprint ? `fingerprint_template_${formId.toLowerCase()}` : undefined
      };

      await db.employees.put(empData);
      
      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: isNew ? 'Create Employee' : 'Update Employee',
        entity: 'Employee',
        entityId: formId,
        details: JSON.stringify({ name: empData.name, department: empData.department, status: empData.status })
      });

      toast.success(isNew ? 'Employee registered successfully!' : 'Changes saved successfully!');
      
      setIsNew(false);
      await fetchEmployees();
      
      // Keep selection
      handleSelectEmployee(empData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save employee profile.');
    }
  };

  // Filter Employees by name or ID
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Employee Management
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Configure employee directory rosters, bios, statuses, and biometric fingerprint maps
          </p>
        </div>
      </div>

      {/* Main Grid: Master (35%) / Detail (65%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
        
        {/* MASTER PANEL (35% / 3-Columns equivalent) */}
        <div className="lg:col-span-4 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[600px]">
          
          {/* Search and Add Header */}
          <div className="p-4 border-b border-gray-100 flex gap-2 select-none">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green"
              />
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
            </div>
            <button
              onClick={handleCreateNewClick}
              className="h-10 bg-brand-gold hover:opacity-90 transition text-brand-white px-3 rounded-[8px] text-xs font-medium flex items-center gap-1 shrink-0"
              title="Add New Employee"
            >
              <Plus size={14} weight="bold" />
              <span>Register</span>
            </button>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-brand-gray-neutral text-xs select-none">
                No employees matching search criteria
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = selectedEmp?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-brand-light-green/20' 
                        : 'hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={emp.photo} 
                        alt={emp.name} 
                        className="w-10 h-10 rounded-full object-cover border border-brand-light-green/30 shrink-0"
                      />
                      <div>
                        <h4 className="text-brand-dark-green font-semibold text-xs leading-normal">
                          {emp.name}
                        </h4>
                        <p className="text-brand-gray-neutral text-[10px]">{emp.department}</p>
                      </div>
                    </div>
                    
                    {/* Status badge + id */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-brand-gray-neutral bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                        {emp.id}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'Active' ? 'bg-brand-dark-green' : 'bg-brand-gray-neutral'}`} />
                        <span className="text-[9px] text-brand-gray-neutral">{emp.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DETAIL PANEL (65% / 6-Columns equivalent) */}
        <div className="lg:col-span-6 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 h-[600px] flex flex-col justify-between">
          <form onSubmit={handleSave} className="space-y-6 overflow-y-auto pr-1 flex-1">
            
            {/* Header Title */}
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between select-none">
              <h3 className="text-brand-dark-green font-semibold text-base">
                {isNew ? 'Register New Employee' : 'Employee Details'}
              </h3>
              {isNew && (
                <span className="text-xs text-brand-gold font-bold uppercase tracking-wider bg-brand-light-green/20 px-2 py-0.5 rounded">
                  Creation Mode
                </span>
              )}
            </div>

            {/* Profile Picture Upload row */}
            <div className="flex items-center gap-6">
              <img 
                src={formPhoto} 
                alt="Profile Preview" 
                className="w-[96px] h-[96px] rounded-full object-cover border-2 border-brand-light-green shadow-sm"
              />
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={handleSimulatePhotoUpload}
                  className="text-brand-gold text-xs font-semibold hover:underline"
                >
                  Update Photo
                </button>
                <p className="text-brand-gray-neutral text-[10px]">
                  Supports JPG, PNG formats. Max file size: 2MB.
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Employee ID (Read-only) */}
              <div className="space-y-1.5 select-none">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Employee Number
                </label>
                <input
                  type="text"
                  value={formId}
                  disabled
                  className="w-full h-[44px] px-3 bg-gray-50 border border-gray-200 text-brand-dark-green font-mono text-[13px] rounded-[8px] cursor-default"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Department
                </label>
                <select
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              {/* Status active/inactive toggles */}
              <div className="space-y-1.5 select-none">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Status State
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('Active')}
                    className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold transition border ${
                      formStatus === 'Active'
                        ? 'bg-brand-dark-green text-brand-white border-brand-dark-green'
                        : 'bg-brand-white border-gray-300 text-brand-gray-neutral hover:bg-gray-50'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('Inactive')}
                    className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold transition border ${
                      formStatus === 'Inactive'
                        ? 'bg-brand-error-red text-brand-white border-brand-error-red'
                        : 'bg-brand-white border-gray-300 text-brand-gray-neutral hover:bg-gray-50'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

            </div>

            {/* Fingerprint Registration Panel */}
            <div className="bg-[#F9FAFB]/50 border border-gray-200 rounded-[8px] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 select-none">
                  <Fingerprint size={20} className={formFingerprint ? 'text-brand-dark-green' : 'text-brand-gray-neutral'} />
                  <span className="text-sm font-semibold text-brand-dark-green">Biometric Profile</span>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded select-none ${
                  formFingerprint ? 'bg-brand-dark-green/10 text-brand-dark-green' : 'bg-gray-200 text-brand-gray-neutral'
                }`}>
                  {formFingerprint ? 'Template Registered' : 'Not Configured'}
                </span>
              </div>
              <p className="text-brand-gray-neutral text-xs leading-normal select-none">
                Each employee must have an active biometric fingerprint scan mapped to enable cashier fingerprint validation.
              </p>
              <button
                type="button"
                disabled={registeringBiometric}
                onClick={handleRegisterFingerprint}
                className="text-xs font-semibold text-brand-gold border border-brand-gold/40 px-3 py-1.5 rounded hover:bg-brand-gold/5 transition disabled:opacity-50"
              >
                {registeringBiometric ? 'Reading Scan...' : 'Register Fingerprint'}
              </button>
            </div>

          </form>

          {/* Footer Save actions */}
          <div className="border-t border-gray-100 pt-4 flex justify-end gap-3 select-none">
            {isNew ? (
              <button
                type="button"
                onClick={() => {
                  setIsNew(false);
                  if (employees.length > 0) {
                    handleSelectEmployee(employees[0]);
                  }
                }}
                className="px-5 h-[44px] border border-gray-300 rounded-[8px] text-sm text-brand-dark-green hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            ) : null}
            <button
              onClick={handleSave}
              className="px-6 h-[44px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 active:scale-[0.99] transition"
            >
              Save Changes
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
