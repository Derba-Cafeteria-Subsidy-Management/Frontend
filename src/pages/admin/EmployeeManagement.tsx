import React, { useState, useEffect, useRef } from 'react';
import { db, type Employee } from '../../db/db';
import { MagnifyingGlass, Plus, Fingerprint, UploadSimple, FileCsv, X } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formFingerprint, setFormFingerprint] = useState(false);
  
  // Registration simulation state
  const [registeringBiometric, setRegisteringBiometric] = useState(false);
  
  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchEmployees = async () => {
    try {
      const list = await db.employees.toArray();
      setEmployees(list);
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
    setFormPhotoFile(null);
    setPhotoPreview(null);
    setFormFingerprint(emp.fingerprintRegistered);
  };

  const handleCreateNewClick = () => {
    setIsNew(true);
    setSelectedEmp(null);
    setPhotoPreview(null);
    setFormPhotoFile(null);
    
    const nextNum = employees.length + 129;
    setFormId(`EMP-${nextNum}`);
    setFormName('');
    setFormDept('Engineering');
    setFormStatus('Active');
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormFingerprint(false);
  };

  // Photo upload handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, WEBP)');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setFormPhotoFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    toast.success('Photo uploaded successfully!');
  };

  const handleRemovePhoto = () => {
    setFormPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    // Set to default photo
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    toast.success('Photo removed');
  };

  // Convert file to base64 for storage
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleRegisterFingerprint = () => {
    setRegisteringBiometric(true);
    toast.loading('Place finger on scanner terminal...', { id: 'fp-scan' });
    
    setTimeout(() => {
      setRegisteringBiometric(false);
      setFormFingerprint(true);
      toast.success('Fingerprint templates recorded successfully!', { id: 'fp-scan' });
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter Employee Full Name');
      return;
    }

    try {
      let photoUrl = formPhoto;
      
      // If there's a new photo file, convert to base64 and store
      if (formPhotoFile) {
        photoUrl = await fileToBase64(formPhotoFile);
      }

      const empData: Employee = {
        id: formId,
        name: formName.trim(),
        department: formDept,
        status: formStatus,
        photo: photoUrl,
        fingerprintRegistered: formFingerprint,
        fingerprintTemplate: formFingerprint ? `fingerprint_template_${formId.toLowerCase()}` : undefined
      };

      await db.employees.put(empData);
      
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: isNew ? 'Create Employee' : 'Update Employee',
        entity: 'Employee',
        entityId: formId,
        details: JSON.stringify({ 
          name: empData.name, 
          department: empData.department, 
          status: empData.status,
          hasPhoto: !!formPhotoFile
        })
      });

      toast.success(isNew ? 'Employee registered successfully!' : 'Changes saved successfully!');
      
      setIsNew(false);
      setFormPhotoFile(null);
      setPhotoPreview(null);
      await fetchEmployees();
      handleSelectEmployee(empData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save employee profile.');
    }
  };

  // Excel Import Functions
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        setImportData(jsonData);
        validateImportData(jsonData);
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Failed to read the file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
        handleFileUpload(file);
      } else {
        toast.error('Please upload an Excel or CSV file');
      }
    }
  };

  const validateImportData = (data: any[]) => {
    const errors: string[] = [];
    const requiredFields = ['Name', 'Department', 'Status'];
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
        
      requiredFields.forEach(field => {
        if (!row[field]) {
          errors.push(`Row ${rowNum}: Missing "${field}"`);
        }
      });

      if (row.Status && !['Active', 'Inactive'].includes(row.Status)) {
        errors.push(`Row ${rowNum}: Status must be "Active" or "Inactive"`);
      }

      if (row.Department && typeof row.Department !== 'string') {
        errors.push(`Row ${rowNum}: Department must be text`);
      }
    });

    setImportErrors(errors);
    if (errors.length === 0) {
      toast.success(`Successfully loaded ${data.length} employees for import`);
    } else {
      toast.error(`Found ${errors.length} errors in the data`);
    }
  };

  const handleImportEmployees = async () => {
    if (importData.length === 0) {
      toast.error('No data to import');
      return;
    }

    if (importErrors.length > 0) {
      toast.error('Please fix the errors before importing');
      return;
    }

    setIsImporting(true);
    let imported = 0;
    let failed = 0;

    try {
      const currentEmployees = await db.employees.toArray();
      const existingIds = new Set(currentEmployees.map(emp => emp.id));

      for (const row of importData) {
        try {
          let id = row['Employee ID'] || row['ID'] || `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          
          if (existingIds.has(id)) {
            id = `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          }

          const employee: Employee = {
            id: id,
            name: row['Name'] || row['Full Name'] || 'Unknown',
            department: row['Department'] || 'Unassigned',
            status: row['Status'] === 'Inactive' ? 'Inactive' : 'Active',
            photo: row['Photo'] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
            fingerprintRegistered: row['Fingerprint'] === 'Yes' || row['Fingerprint'] === true,
            fingerprintTemplate: row['Fingerprint'] === 'Yes' || row['Fingerprint'] === true 
              ? `fingerprint_template_${id.toLowerCase()}` 
              : undefined
          };

          await db.employees.put(employee);
          existingIds.add(id);
          imported++;
        } catch (error) {
          console.error('Error importing row:', error);
          failed++;
        }
      }

      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Import Employees',
        entity: 'Employee',
        entityId: 'bulk-import',
        details: JSON.stringify({ 
          total: importData.length, 
          imported, 
          failed,
          timestamp: new Date().toISOString()
        })
      });

      toast.success(`Successfully imported ${imported} employees${failed > 0 ? `, ${failed} failed` : ''}`);
      
      await fetchEmployees();
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
      setIsDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import employees');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Employee ID': 'EMP-00123',
        'Name': 'John Doe',
        'Department': 'Engineering',
        'Status': 'Active',
        'Fingerprint': 'Yes',
        'Photo': 'https://example.com/photo.jpg'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employee_import_template.xlsx');
    toast.success('Template downloaded!');
  };

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
        <button
          onClick={() => setShowImportModal(true)}
          className="h-[44px] bg-brand-light-green/30 text-brand-dark-green px-5 rounded-[8px] text-sm font-medium hover:bg-brand-light-green/50 transition flex items-center gap-2 shadow-sm border border-brand-light-green"
        >
          <UploadSimple size={18} />
          <span>Import Excel</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
        
        {/* MASTER PANEL */}
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

        {/* DETAIL PANEL */}
        <div className="lg:col-span-6 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 h-[600px] flex flex-col justify-between">
          <form onSubmit={handleSave} className="space-y-6 overflow-y-auto pr-1 flex-1">
            
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

            {/* Photo Upload Section */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <img 
                  src={photoPreview || formPhoto} 
                  alt="Profile Preview" 
                  className="w-[96px] h-[96px] rounded-full object-cover border-2 border-brand-light-green shadow-sm"
                />
                {formPhotoFile && (
                  <div className="absolute -top-1 -right-1 bg-brand-dark-green text-brand-white text-[8px] px-1.5 py-0.5 rounded-full">
                    New
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer text-brand-gold text-xs font-semibold hover:underline flex items-center gap-1"
                  >
                    <UploadSimple size={14} />
                    Upload Photo
                  </label>
                  {(formPhotoFile || photoPreview) && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-brand-error-red text-xs font-semibold hover:underline flex items-center gap-1"
                    >
                      <X size={14} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-brand-gray-neutral text-[10px]">
                  JPG, PNG, GIF, WEBP. Max 2MB.
                </p>
                {formPhotoFile && (
                  <p className="text-brand-dark-green text-[10px] font-medium">
                    {formPhotoFile.name} ({(formPhotoFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[600px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <FileCsv size={22} className="text-brand-gold" />
                Import Employees
              </h3>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportData([]);
                  setImportErrors([]);
                  setIsDragging(false);
                }}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-[8px] p-8 text-center transition-all duration-200 ${
                  isDragging 
                    ? 'border-brand-gold bg-brand-gold/5' 
                    : 'border-gray-300 hover:border-brand-gold'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  {isDragging ? (
                    <>
                      <UploadSimple size={40} className="text-brand-gold mx-auto mb-3" />
                      <p className="text-brand-gold font-medium mb-1">Drop your file here</p>
                      <p className="text-brand-gray-neutral text-xs">Release to upload</p>
                    </>
                  ) : (
                    <>
                      <UploadSimple size={40} className="text-brand-gray-neutral mx-auto mb-3" />
                      <p className="text-brand-dark-green font-medium mb-1">Upload Excel or CSV File</p>
                      <p className="text-brand-gray-neutral text-xs">
                        Drag and drop or click to browse
                      </p>
                      <p className="text-brand-gray-neutral text-[10px] mt-2">
                        Supported formats: .xlsx, .xls, .csv
                      </p>
                    </>
                  )}
                </label>
                
                {importData.length > 0 && (
                  <div className="mt-3 text-xs text-brand-dark-green bg-brand-light-green/20 px-3 py-1.5 rounded-full inline-flex items-center gap-2">
                    <FileCsv size={14} className="text-brand-gold" />
                    <span>{importData.length} rows loaded</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={downloadTemplate}
                  className="text-brand-gold text-sm font-semibold hover:underline flex items-center gap-1"
                >
                  <FileCsv size={16} />
                  Download Template
                </button>
                <span className="text-[10px] text-brand-gray-neutral">
                  Required: Name, Department, Status
                </span>
              </div>

              {importData.length > 0 && (
                <div className="border border-gray-200 rounded-[8px] p-4 max-h-[200px] overflow-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-brand-dark-green">
                      Preview ({importData.length} rows)
                    </span>
                    {importErrors.length > 0 && (
                      <span className="text-xs text-brand-error-red">
                        {importErrors.length} error(s) found
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-gray-neutral space-y-1">
                    {importData.slice(0, 5).map((row, index) => (
                      <div key={index} className="flex items-center gap-2 border-b border-gray-50 py-1">
                        <span className="text-brand-gray-neutral w-6">{index + 1}.</span>
                        <span className="font-medium text-brand-dark-green">
                          {row['Name'] || row['Full Name'] || 'Unknown'}
                        </span>
                        <span className="text-brand-gray-neutral">-</span>
                        <span>{row['Department'] || 'Unassigned'}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          row['Status'] === 'Active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {row['Status'] || 'Active'}
                        </span>
                        {row['Fingerprint'] === 'Yes' && (
                          <span className="text-[9px] text-brand-dark-green">
                            <Fingerprint size={10} className="inline" />
                          </span>
                        )}
                      </div>
                    ))}
                    {importData.length > 5 && (
                      <div className="text-brand-gray-neutral text-[10px] pt-1">
                        ... and {importData.length - 5} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="bg-brand-error-red/5 border border-brand-error-red/30 rounded-[8px] p-3 max-h-[100px] overflow-auto">
                  <span className="text-xs font-medium text-brand-error-red block mb-1">Errors:</span>
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-[10px] text-brand-error-red/90">
                      • {error}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData([]);
                    setImportErrors([]);
                    setIsDragging(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="flex-1 h-[44px] border border-gray-300 text-brand-gray-neutral rounded-[8px] font-medium text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportEmployees}
                  disabled={importData.length === 0 || importErrors.length > 0 || isImporting}
                  className="flex-1 h-[44px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import ${importData.length} Employees`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};