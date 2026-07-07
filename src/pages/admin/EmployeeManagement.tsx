import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../client/axios';
import { offlineDb } from '../../db/indexedDb';
import {
  MagnifyingGlass,
  Plus,
  Fingerprint,
  UploadSimple,
  FileCsv,
  X,
  CaretLeft,
  CaretRight,
  Check,
  Warning,
  Trash,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { Employee } from '../../types/api';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  // Form states
  const [isNew, setIsNew] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formPhoto, setFormPhoto] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formFingerprint, setFormFingerprint] = useState(false);
  const [formFingerprintId, setFormFingerprintId] = useState<string>('');

  // Registration simulation state
  const [registeringBiometric, setRegisteringBiometric] = useState(false);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ totalRows: number; validCount: number; errorCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ✅ FIXED: Fetch employees with pagination and search
  const fetchEmployees = async (page: number = currentPage, search: string = searchTerm) => {
    setIsLoading(true);
    try {
      const params: any = {
        page: page,
        limit: limit
      };

      if (search.trim()) {
        const isEmployeeNumber = /^EMP-\d+$/.test(search.trim()) || /^\d+$/.test(search.trim());
        if (isEmployeeNumber) {
          params.employeeNumber = search.trim();
        } else {
          params.name = search.trim();
        }
      }

      const res = await axiosInstance.get('/api/employees', { params });

      if (res.data?.success && res.data?.data) {
        const list = Array.isArray(res.data.data.employees) ? res.data.data.employees : [];
        setEmployees(list);
        setTotalEmployees(res.data.data.pagination?.total || list.length);
        setTotalPages(res.data.data.pagination?.totalPages || Math.ceil((res.data.data.pagination?.total || list.length) / limit));

        if (list.length > 0 && !selectedEmp && !isNew) {
          handleSelectEmployee(list[0]);
        } else if (list.length === 0 && selectedEmp) {
          setSelectedEmp(null);
          setIsNew(true);
        }

        try {
          await offlineDb.offlineEmployees.clear();
          if (list.length > 0) {
            const offlineRecords = list.map((emp: Employee) => ({
              id: emp.id,
              employeeNumber: emp.employeeNumber,
              fullName: emp.fullName,
              status: emp.status,
              photo: emp.photo,
              fingerprintId: emp.fingerprintId,
              mealsToday: emp.mealsToday
            }));
            await offlineDb.offlineEmployees.bulkAdd(offlineRecords);
          }
        } catch (dbErr) {
          console.warn('Failed to cache employees locally:', dbErr);
        }
      } else {
        setEmployees([]);
        setTotalEmployees(0);
        setTotalPages(1);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load employees list');
      setEmployees([]);
      setTotalEmployees(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchEmployees(1, '');
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      fetchEmployees(1, searchTerm);
    }, 500);

    setSearchTimeout(timeout);

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchEmployees(newPage, searchTerm);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setIsNew(false);
    setSelectedEmp(emp);
    setFormId(emp.employeeNumber || emp.id);
    setFormName(emp.fullName);
    setFormStatus(emp.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setFormPhoto(emp.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormPhotoFile(null);
    setPhotoPreview(null);
    setFormFingerprint(!!emp.fingerprintId);
    setFormFingerprintId(emp.fingerprintId || '');
  };

  const handleCreateNewClick = () => {
    setIsNew(true);
    setSelectedEmp(null);
    setPhotoPreview(null);
    setFormPhotoFile(null);

    const nextNum = totalEmployees + 129;
    setFormId(`EMP-${nextNum}`);
    setFormName('');
    setFormStatus('ACTIVE');
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormFingerprint(false);
    setFormFingerprintId('');
  };

  // Photo upload handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, WEBP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setFormPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    toast.success('Photo selected!');
  };

  const handleRemovePhoto = () => {
    setFormPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    toast.success('Photo removed');
  };

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
      const generatedFpId = `FP-${formId || 'NEW'}-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormFingerprintId(generatedFpId);
      toast.success(`Fingerprint registered: ${generatedFpId}`, { id: 'fp-scan' });
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter Employee Full Name');
      return;
    }

    setIsLoading(true);
    try {
      let photoUrl = formPhoto;
      if (formPhotoFile) {
        photoUrl = await fileToBase64(formPhotoFile);
      }

      const payload = {
        employeeNumber: formId,
        fullName: formName.trim(),
        status: formStatus,
        photo: photoUrl,
        fingerprintId: formFingerprint ? formFingerprintId || `FP-${formId}` : null
      };

      let response;
      if (isNew) {
        response = await axiosInstance.post('/api/employees', payload);
      } else {
        const targetId = selectedEmp?.id || formId;
        response = await axiosInstance.put(`/api/employees/${targetId}`, payload);
      }

      if (response.data?.success) {
        toast.success(isNew ? 'Employee registered successfully!' : 'Changes saved successfully!');
        setIsNew(false);
        setFormPhotoFile(null);
        setPhotoPreview(null);
        await fetchEmployees(currentPage, searchTerm);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save employee profile.');
    } finally {
      setIsLoading(false);
    }
  };

  // Excel Import Functions with column mapping
  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // ✅ FIXED: TypeScript error - properly type the jsonData
        if (jsonData && jsonData.length > 0) {
          const firstRow = jsonData[0] as Record<string, unknown>;
          console.log('Excel columns found:', Object.keys(firstRow));
        }

        const mappedData = jsonData.map((row: any) => {
          let employeeNumber = '';
          let fullName = '';
          let fingerprintId = '';
          let photo = '';

          const possibleEmployeeNumberColumns = ['Pers.No.', 'EmployeeNumber', 'Employee ID', 'ID', 'PersNo', 'Pers.No', 'Employee No'];
          for (const col of possibleEmployeeNumberColumns) {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              employeeNumber = String(row[col]).trim();
              break;
            }
          }

          const possibleNameColumns = ['Employee Name', 'fullName', 'Name', 'Full Name', 'EmployeeName', 'FullName'];
          for (const col of possibleNameColumns) {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              fullName = String(row[col]).trim();
              break;
            }
          }

          const possibleFingerprintColumns = ['Fingerprint', 'fingerprintId', 'Biometric', 'FP'];
          for (const col of possibleFingerprintColumns) {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              fingerprintId = String(row[col]).trim();
              break;
            }
          }

          const possiblePhotoColumns = ['Photo', 'photo', 'Image', 'image'];
          for (const col of possiblePhotoColumns) {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              photo = String(row[col]).trim();
              break;
            }
          }

          let finalFingerprintId = fingerprintId;
          const fingerprintValue = String(fingerprintId).toLowerCase();

          if (fingerprintValue === 'yes' || fingerprintValue === 'true') {
            finalFingerprintId = `FP-${employeeNumber || Date.now()}`;
          } else if (fingerprintValue === 'no' || fingerprintValue === 'false' || fingerprintValue === '') {
            finalFingerprintId = '';
          }

          return {
            EmployeeNumber: employeeNumber,
            fullName: fullName,
            fingerprintId: finalFingerprintId || null,
            photo: photo || null
          };
        });

        const validRows = mappedData.filter(row =>
          row.EmployeeNumber && row.fullName
        );

        const errors: string[] = [];
        mappedData.forEach((row, index) => {
          if (!row.EmployeeNumber) {
            errors.push(`Row ${index + 2}: Missing Employee Number (required column: Pers.No. or EmployeeNumber)`);
          }
          if (!row.fullName) {
            errors.push(`Row ${index + 2}: Missing Employee Name (required column: Employee Name or fullName)`);
          }
        });

        if (validRows.length === 0) {
          toast.error('No valid rows found. Please check the template format.');
          setImportErrors(['No valid rows found. Required columns: Pers.No. and Employee Name']);
          setImportData([]);
          return;
        }

        const ws2 = XLSX.utils.json_to_sheet(validRows);
        const wb2 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb2, ws2, 'Employees');
        const excelBuffer = XLSX.write(wb2, { bookType: 'xlsx', type: 'array' });
        const mappedFile = new File([excelBuffer], 'mapped_employees.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const uploadFormData = new FormData();
        uploadFormData.append('file', mappedFile);

        setIsImporting(true);
        try {
          const res = await axiosInstance.post('/api/employees/import/preview', uploadFormData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          if (res.data?.success && res.data?.data) {
            const data = res.data.data;
            setImportData(data.validRows || []);
            setImportStats({
              totalRows: data.totalRows || 0,
              validCount: data.validCount || 0,
              errorCount: data.errorCount || 0
            });

            if (data.previewToken) {
              setPreviewToken(data.previewToken);
            }

            if (data.errors && data.errors.length > 0) {
              const errorMessages = data.errors.map((err: any) =>
                `Row ${err.row}: ${err.field} - ${err.message}`
              );
              setImportErrors([...errors, ...errorMessages]);
              toast.error(`Found ${data.errors.length} validation errors`);
            } else if (errors.length > 0) {
              setImportErrors(errors);
              toast.error(`Loaded with ${errors.length} warnings`);
            } else {
              setImportErrors([]);
              toast.success(`Loaded ${data.validCount} employees successfully`);
            }
          } else {
            toast.error('Failed to preview import data');
          }
        } catch (error: any) {
          console.error('Error uploading file:', error);
          toast.error(error.response?.data?.message || 'Failed to process file');
          setImportErrors([error.response?.data?.message || 'Failed to process file']);
        } finally {
          setIsImporting(false);
        }

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
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (validExtensions.includes(fileExtension)) {
        handleFileUpload(file);
      } else {
        toast.error('Please upload an Excel or CSV file');
      }
    }
  };

  const handleConfirmImport = async () => {
    if (importData.length === 0) {
      toast.error('No data to import');
      return;
    }

    if (importErrors.length > 0) {
      toast.error('Fix validation errors before importing');
      return;
    }

    if (!previewToken) {
      toast.error('No preview token found. Please upload the file again.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await axiosInstance.post('/api/employees/import/confirm', {
        previewToken: previewToken
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Import completed successfully!');
        setShowImportModal(false);
        setImportData([]);
        setImportErrors([]);
        setPreviewToken(null);
        setImportStats(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        await fetchEmployees(currentPage, searchTerm);
      } else {
        toast.error(res.data?.message || 'Failed to confirm import');
      }
    } catch (error: any) {
      console.error('Error confirming import:', error);
      toast.error(error.response?.data?.message || 'Failed to complete import');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Pers.No.': 'EMP-00123',
        'Employee Name': 'Abebe Girma',
        'Fingerprint': 'Yes',
        'Photo': ''
      },
      {
        'Pers.No.': 'EMP-00124',
        'Employee Name': 'Tigist Haile',
        'Fingerprint': 'No',
        'Photo': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employee_import_template.xlsx');
    toast.success('Template downloaded!');
  };

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
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green"
              />
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-brand-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
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
            {isLoading ? (
              <div className="p-8 text-center text-xs text-brand-gray-neutral">Loading employee directory...</div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-brand-gray-neutral text-xs select-none">
                {searchTerm ? 'No employees matching search criteria' : 'No employees registered yet'}
              </div>
            ) : (
              employees.map((emp) => {
                const isSelected = selectedEmp?.id === emp.id;
                const empNum = emp.employeeNumber || emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                      ? 'bg-brand-light-green/20'
                      : 'hover:bg-[#F9FAFB]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
                        alt={emp.fullName}
                        className="w-10 h-10 rounded-full object-cover border border-brand-light-green/30 shrink-0"
                      />
                      <div>
                        <h4 className="text-brand-dark-green font-semibold text-xs leading-normal">
                          {emp.fullName}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-brand-gray-neutral bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                        {empNum}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status !== 'INACTIVE' ? 'bg-brand-dark-green' : 'bg-brand-gray-neutral'}`} />
                        <span className="text-[9px] text-brand-gray-neutral">{emp.status === 'INACTIVE' ? 'Inactive' : 'Active'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {totalEmployees > 0 && (
            <div className="border-t border-gray-100 p-3 flex items-center justify-between select-none bg-gray-50/50">
              <span className="text-[10px] text-brand-gray-neutral">
                {employees.length > 0 ? (
                  <>Showing {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalEmployees)} of {totalEmployees}</>
                ) : (
                  <>0 of {totalEmployees}</>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CaretLeft size={16} className="text-brand-gray-neutral" />
                </button>
                <span className="text-[10px] text-brand-dark-green font-medium px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CaretRight size={16} className="text-brand-gray-neutral" />
                </button>
              </div>
            </div>
          )}
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

            {/* Photo Section */}
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
                      <Trash size={14} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-brand-gray-neutral text-[10px]">
                  JPG, PNG, GIF, WEBP. Max 2MB.
                </p>
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
                  disabled={!isNew}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full h-[44px] px-3 bg-gray-50 border border-gray-200 text-brand-dark-green font-mono text-[13px] rounded-[8px]"
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

              <div className="space-y-1.5 select-none">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Status State
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('ACTIVE')}
                    className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold transition border ${formStatus === 'ACTIVE'
                      ? 'bg-brand-dark-green text-brand-white border-brand-dark-green'
                      : 'bg-brand-white border-gray-300 text-brand-gray-neutral hover:bg-gray-50'
                      }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('INACTIVE')}
                    className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold transition border ${formStatus === 'INACTIVE'
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
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded select-none ${formFingerprint ? 'bg-brand-dark-green/10 text-brand-dark-green' : 'bg-gray-200 text-brand-gray-neutral'
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
            {isNew && (
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
            )}
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
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[700px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none sticky top-0 bg-white z-10">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <FileCsv size={22} className="text-brand-gold" />
                Import Employees
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData([]);
                  setImportErrors([]);
                  setPreviewToken(null);
                  setImportStats(null);
                  setIsDragging(false);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-[8px] p-8 text-center transition-all duration-200 ${isDragging
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
                    </>
                  )}
                </label>

                {importStats && (
                  <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                    <span className="text-brand-dark-green bg-brand-light-green/20 px-3 py-1.5 rounded-full inline-flex items-center gap-2">
                      <FileCsv size={14} className="text-brand-gold" />
                      <span>{importStats.totalRows} rows total</span>
                    </span>
                    {importStats.validCount > 0 && (
                      <span className="text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                        <Check size={14} className="inline mr-1" />
                        {importStats.validCount} valid
                      </span>
                    )}
                    {importStats.errorCount > 0 && (
                      <span className="text-red-700 bg-red-100 px-3 py-1.5 rounded-full">
                        <X size={14} className="inline mr-1" />
                        {importStats.errorCount} errors
                      </span>
                    )}
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
                  Required: <strong>Pers.No.</strong>, <strong>Employee Name</strong> &nbsp;·&nbsp; Optional: Fingerprint, Photo
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
                        <span className="font-mono text-brand-gray-neutral text-[10px] bg-gray-50 px-1 rounded border border-gray-100">
                          {row.EmployeeNumber || '—'}
                        </span>
                        <span className="font-medium text-brand-dark-green">
                          {row.fullName || 'Unknown'}
                        </span>
                        {row.fingerprintId && (
                          <span className="text-[10px] text-brand-dark-green bg-brand-light-green/20 px-1.5 rounded inline-flex items-center gap-1">
                            <Fingerprint size={10} />
                            FP
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
                <div className="bg-brand-error-red/5 border border-brand-error-red/30 rounded-[8px] p-3 max-h-[150px] overflow-auto">
                  <span className="text-xs font-medium text-brand-error-red block mb-1">
                    Errors ({importErrors.length}):
                  </span>
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-[10px] text-brand-error-red/90 py-0.5 flex items-start gap-1">
                      <Warning size={12} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData([]);
                    setImportErrors([]);
                    setPreviewToken(null);
                    setImportStats(null);
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
                  onClick={handleConfirmImport}
                  disabled={importData.length === 0 || importErrors.length > 0 || isImporting || !previewToken}
                  className="flex-1 h-[44px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    `Import ${importData.length} Employees`
                  )}
                </button>
              </div>

              {!previewToken && importData.length > 0 && (
                <div className="text-xs text-brand-error-red text-center flex items-center justify-center gap-1">
                  <Warning size={14} />
                  Please upload the file again to generate a preview token
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;