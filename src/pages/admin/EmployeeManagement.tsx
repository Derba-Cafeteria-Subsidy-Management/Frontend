import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../client/axios';
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
  Funnel,
  FunnelSimple,
  Users,
  Calendar,
  Clock,
  Info,
  Gear,
  UserPlus,
  UserMinus,
  Swap,
  ShieldCheck,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { Employee } from '../../types/api';

interface ExtendedEmployee extends Employee {
  department?: string;
  employeeType?: 'NORMAL' | 'SHIFT';
  subsidyType?: 'NORMAL' | 'SPECIAL' | 'FULL_COMPANY';
  currentGroup?: {
    id: string;
    name: string;
  };
  groupId?: string;
  groupName?: string;
}

interface EmployeeGroup {
  id: string;
  name: string;
  description?: string;
  rotationOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveDate?: string;
  createdAt?: string;
  updatedAt?: string;
  memberCount?: number;
}

interface SchedulePreview {
  date: string;
  half: 'FIRST_HALF' | 'SECOND_HALF';
  groupId?: string;
  groupName?: string;
}

export const EmployeeManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'employees' | 'groups'>('employees');
  const [employees, setEmployees] = useState<ExtendedEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<ExtendedEmployee | null>(null);

  // Groups
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<EmployeeGroup | null>(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreview[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDateRange, setScheduleDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  // Group pagination
  const [groupCurrentPage] = useState(1);

  // Forms
  const [isNew, setIsNew] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formEmployeeType, setFormEmployeeType] = useState<'NORMAL' | 'SHIFT'>('NORMAL');
  const [formSubsidyType, setFormSubsidyType] = useState<'NORMAL' | 'SPECIAL'>('NORMAL');
  const [formGroupId, setFormGroupId] = useState('');
  const [formPhoto, setFormPhoto] = useState('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formFingerprint, setFormFingerprint] = useState(false);
  const [formFingerprintId, setFormFingerprintId] = useState<string>('');

  // Group form
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDescription, setGroupFormDescription] = useState('');
  const [groupFormRotationOrder, setGroupFormRotationOrder] = useState(1);
  const [groupFormStatus, setGroupFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [groupFormEffectiveDate, setGroupFormEffectiveDate] = useState('');
  const [groupFormSubmitting, setGroupFormSubmitting] = useState(false);

  // Biometric
  const [registeringBiometric, setRegisteringBiometric] = useState(false);

  // Group assignment states
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [selectedNewGroupId, setSelectedNewGroupId] = useState('');

  // Subsidy editing states
  // const [selectedSubsidyType, setSelectedSubsidyType] = useState<'NORMAL' | 'SPECIAL'>('NORMAL');

  // Remove confirmation modal
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string; groupName: string; isGroupMember?: boolean } | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterEmployeeType, setFilterEmployeeType] = useState<string>('');
  const [filterSubsidyType, setFilterSubsidyType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Import
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ totalRows: number; validCount: number; errorCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Group members
  const [groupMembers, setGroupMembers] = useState<ExtendedEmployee[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);

  // Bulk assign
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [selectedEmployeesForGroup, setSelectedEmployeesForGroup] = useState<string[]>([]);
  const [bulkAssignTargetGroup, setBulkAssignTargetGroup] = useState<string>('');

  // Schedule override
  const [showScheduleOverride, setShowScheduleOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState(new Date().toISOString().split('T')[0]);
  const [overrideHalf, setOverrideHalf] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [overrideGroupId, setOverrideGroupId] = useState('');

  // Active filters count
  useEffect(() => {
    let count = 0;
    if (filterEmployeeType) count++;
    if (filterSubsidyType) count++;
    if (filterStatus) count++;
    setActiveFiltersCount(count);
  }, [filterEmployeeType, filterSubsidyType, filterStatus]);

  // Fetch employees
  const fetchEmployees = async (page: number = currentPage, search: string = searchTerm) => {
    setIsLoading(true);
    try {
      const params: any = { page: page, limit: limit };
      if (search.trim()) {
        const isEmployeeNumber = /^EMP-\d+$/.test(search.trim()) || /^\d+$/.test(search.trim());
        if (isEmployeeNumber) {
          params.employeeNumber = search.trim();
        } else {
          params.name = search.trim();
        }
      }
      if (filterEmployeeType) params.employeeType = filterEmployeeType;
      if (filterSubsidyType) params.subsidytype = filterSubsidyType;
      if (filterStatus) params.status = filterStatus;

      const res = await axiosInstance.get('/api/employees', { params });

      if (res.data?.success && res.data?.data) {
        const list = Array.isArray(res.data.data.employees) 
          ? res.data.data.employees.map((emp: any) => ({
              ...emp,
              employeeType: emp.employeeType || 'NORMAL',
              subsidyType: emp.subsidytype || 'NORMAL',
              groupId: emp.currentGroup?.id || emp.groupId || '',
              groupName: emp.currentGroup?.name || emp.groupName || '',
              department: emp.department || ''
            }))
          : [];
        
        setEmployees(list);
        setTotalEmployees(res.data.data.pagination?.total || list.length);
        setTotalPages(res.data.data.pagination?.totalPages || Math.ceil((res.data.data.pagination?.total || list.length) / limit));

        if (list.length > 0 && !selectedEmp && !isNew) {
          handleSelectEmployee(list[0]);
        } else if (list.length === 0 && selectedEmp) {
          setSelectedEmp(null);
          setIsNew(true);
        }
      }
    } catch (e: any) {
      console.error('Fetch employees error:', e.response?.status, e.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const res = await axiosInstance.get('/api/employee-groups', { params: { page: groupCurrentPage, limit: 50 } });
      if (res.data?.success && res.data?.data) {
        setGroups(res.data.data.groups || []);
      }
    } catch (e: any) {
      console.error('Fetch groups error:', e.response?.status);
    }
  };

  // Fetch group members
  const fetchGroupMembers = async (groupId: string) => {
    setGroupMembersLoading(true);
    try {
      const res = await axiosInstance.get('/api/employees', {
        params: { 
          group: groupId,
          limit: 100 
        }
      });
      if (res.data?.success && res.data?.data) {
        setGroupMembers(res.data.data.employees || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch group members:', err.response?.status);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const fetchSchedulePreview = async () => {
    try {
      const res = await axiosInstance.get('/api/employee-groups/schedule', {
        params: { 
          from: scheduleDateRange.from, 
          to: scheduleDateRange.to 
        }
      });
      
      if (res.data?.success && Array.isArray(res.data.data)) {
        // Transform the nested data into flat schedule preview items
        const transformedSchedule: SchedulePreview[] = [];
        
        for (const day of res.data.data) {
          if (day.firstHalf) {
            transformedSchedule.push({
              date: day.date,
              half: 'FIRST_HALF',
              groupId: day.firstHalf.groupId || undefined,
              groupName: day.firstHalf.groupName || undefined
            });
          }
          if (day.secondHalf) {
            transformedSchedule.push({
              date: day.date,
              half: 'SECOND_HALF',
              groupId: day.secondHalf.groupId || undefined,
              groupName: day.secondHalf.groupName || undefined
            });
          }
        }
        
        setSchedulePreview(transformedSchedule);
      } else {
        setSchedulePreview([]);
        toast.error('No schedule data available');
      }
    } catch (e: any) {
      console.error('Schedule preview error:', e.response?.status);
      toast.error('Failed to load schedule preview');
      setSchedulePreview([]);
    }
  };

  useEffect(() => { 
    fetchEmployees(1, ''); 
    fetchGroups();
  }, []);
  
  useEffect(() => { if (activeTab === 'groups') fetchGroups(); }, [activeTab, groupCurrentPage]);
  
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => { setCurrentPage(1); fetchEmployees(1, searchTerm); }, 500);
    setSearchTimeout(timeout);
    return () => { if (searchTimeout) clearTimeout(searchTimeout); };
  }, [searchTerm]);

  useEffect(() => { setCurrentPage(1); fetchEmployees(1, searchTerm); }, [filterEmployeeType, filterSubsidyType, filterStatus]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchEmployees(newPage, searchTerm);
    }
  };

  const clearAllFilters = () => {
    setFilterEmployeeType('');
    setFilterSubsidyType('');
    setFilterStatus('');
  };

  const handleSelectEmployee = (emp: ExtendedEmployee) => {
    setIsNew(false);
    setSelectedEmp(emp);
    setFormId(emp.employeeNumber || emp.id);
    setFormName(emp.fullName);
    setFormDepartment(emp.department || '');
    setFormStatus(emp.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setFormEmployeeType((emp.employeeType as 'NORMAL' | 'SHIFT') || 'NORMAL');
    setFormSubsidyType((emp.subsidyType as 'NORMAL' | 'SPECIAL') || 'NORMAL');
    // setSelectedSubsidyType((emp.subsidyType as 'NORMAL' | 'SPECIAL') || 'NORMAL');
    setFormGroupId(emp.currentGroup?.id || emp.groupId || '');
    setSelectedNewGroupId(emp.currentGroup?.id || emp.groupId || '');
    setFormPhoto(emp.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormPhotoFile(null);
    setPhotoPreview(null);
    setFormFingerprint(!!emp.fingerprintId);
    setFormFingerprintId(emp.fingerprintId || '');
    setIsEditingGroup(false);
    setIsSubmittingGroup(false);
  };

  const handleCreateNewClick = () => {
    setIsNew(true);
    setSelectedEmp(null);
    setPhotoPreview(null);
    setFormPhotoFile(null);
    setFormId(`EMP-${totalEmployees + 129}`);
    setFormName('');
    setFormDepartment('');
    setFormStatus('ACTIVE');
    setFormEmployeeType('NORMAL');
    setFormSubsidyType('NORMAL');
    // setSelectedSubsidyType('NORMAL');
    setFormGroupId('');
    setSelectedNewGroupId('');
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setFormFingerprint(false);
    setFormFingerprintId('');
    setIsEditingGroup(false);
    setIsSubmittingGroup(false);
  };

  const handleSelectGroup = (group: EmployeeGroup) => {
    setIsNewGroup(false);
    setSelectedGroup(group);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description || '');
    setGroupFormRotationOrder(group.rotationOrder);
    setGroupFormStatus(group.status);
    setGroupFormEffectiveDate(group.effectiveDate ? group.effectiveDate.split('T')[0] : '');
    fetchGroupMembers(group.id);
  };

  // Move employee to a different group
  const handleMoveEmployeeToGroup = async () => {
    if (!selectedEmp || !selectedNewGroupId) {
      toast.error('Please select a group');
      return;
    }

    const currentGroupId = selectedEmp.currentGroup?.id || selectedEmp.groupId;
    
    if (currentGroupId === selectedNewGroupId) {
      toast.error('Employee is already in this group');
      setIsEditingGroup(false);
      return;
    }

    if (!selectedEmp.id) {
      toast.error('Employee ID is missing');
      return;
    }

    setIsSubmittingGroup(true);
    
    try {
      await axiosInstance.put(`/api/employees/${selectedEmp.id}`, {
        groupId: selectedNewGroupId
      });
      
      const newGroup = groups.find(g => g.id === selectedNewGroupId);
      const oldGroup = groups.find(g => g.id === currentGroupId);
      
      toast.success(
        currentGroupId 
          ? `Moved from ${oldGroup?.name || 'old group'} to ${newGroup?.name || 'new group'}`
          : `Assigned to ${newGroup?.name || 'group'}`
      );
      
      setSelectedEmp(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentGroup: newGroup ? { id: newGroup.id, name: newGroup.name } : undefined,
          groupId: selectedNewGroupId,
          groupName: newGroup?.name || ''
        };
      });
      
      setFormGroupId(selectedNewGroupId);
      setIsEditingGroup(false);
      
      await fetchEmployees(currentPage, searchTerm);
      if (selectedGroup) {
        fetchGroupMembers(selectedGroup.id);
      }
    } catch (err: any) {
      console.error('Group assignment error:', err.response?.status, err.response?.data);
      toast.error(err.response?.data?.message || 'Failed to assign group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  // Handle confirm remove - with fallback for 500/404 errors
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    
    const { id, name, isGroupMember } = removeTarget;
    
    try {
      if (isGroupMember && selectedGroup) {
        // Removing from group members list
        let removed = false;
        
        try {
          await axiosInstance.post('/api/employee-groups/members/remove', {
            employeeId: id,
            groupId: selectedGroup.id
          });
          removed = true;
        } catch (removeErr: any) {
          console.log('Remove endpoint failed with status:', removeErr.response?.status, 'Using employee update fallback...');
        }
        
        // If remove endpoint failed (404 or 500), use employee update fallback
        if (!removed) {
          await axiosInstance.put(`/api/employees/${id}`, {
            groupId: null
          });
        }
        
        toast.success(`${name} removed from group`);
        
        // Immediately update the group members list locally
        setGroupMembers(prev => prev.filter(member => member.id !== id));
        
        // Also refresh from server
        fetchEmployees(currentPage, searchTerm);
      } else {
        // Removing from employee detail panel
        const currentGroupId = selectedEmp?.currentGroup?.id || selectedEmp?.groupId;
        if (!currentGroupId) {
          toast.error('Employee is not assigned to any group');
          setShowRemoveConfirmModal(false);
          setRemoveTarget(null);
          return;
        }
        
        let removed = false;
        
        try {
          await axiosInstance.post('/api/employee-groups/members/remove', {
            employeeId: id,
            groupId: currentGroupId
          });
          removed = true;
        } catch (removeErr: any) {
          console.log('Remove endpoint failed with status:', removeErr.response?.status, 'Using employee update fallback...');
        }
        
        // If remove endpoint failed, use employee update fallback
        if (!removed) {
          await axiosInstance.put(`/api/employees/${id}`, {
            groupId: null
          });
        }
        
        toast.success(`Removed from group`);
        
        // Update selected employee state immediately
        setSelectedEmp(prev => {
          if (!prev) return prev;
          const updated = { ...prev };
          delete updated.currentGroup;
          updated.groupId = '';
          updated.groupName = '';
          return updated;
        });
        
        setFormGroupId('');
        setSelectedNewGroupId('');
        
        await fetchEmployees(currentPage, searchTerm);
      }
    } catch (err: any) {
      console.error('Remove error:', err.response?.status, err.response?.data);
      toast.error('Failed to remove from group. Please try again.');
    } finally {
      setShowRemoveConfirmModal(false);
      setRemoveTarget(null);
    }
  };

  // Remove employee from group - now uses modal
  const handleRemoveFromGroup = () => {
    if (!selectedEmp) return;
    
    const currentGroupId = selectedEmp.currentGroup?.id || selectedEmp.groupId;
    if (!currentGroupId) {
      toast.error('Employee is not assigned to any group');
      return;
    }

    const groupName = selectedEmp.currentGroup?.name || selectedEmp.groupName;
    setRemoveTarget({
      id: selectedEmp.id,
      name: selectedEmp.fullName,
      groupName: groupName || 'current group',
      isGroupMember: false
    });
    setShowRemoveConfirmModal(true);
  };

  // Remove group member - now uses modal
  const handleRemoveGroupMember = (memberId: string, memberName: string) => {
    if (!selectedGroup) return;
    
    setRemoveTarget({
      id: memberId,
      name: memberName,
      groupName: selectedGroup.name,
      isGroupMember: true
    });
    setShowRemoveConfirmModal(true);
  };

  // Bulk assign employees to group
  const handleBulkAssignToGroup = async () => {
    if (!bulkAssignTargetGroup || selectedEmployeesForGroup.length === 0) {
      toast.error('Please select a group and at least one employee');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const employeeId of selectedEmployeesForGroup) {
      try {
        await axiosInstance.put(`/api/employees/${employeeId}`, {
          groupId: bulkAssignTargetGroup
        });
        successCount++;
      } catch (err: any) {
        failCount++;
        console.error(`Failed to assign employee ${employeeId}:`, err.response?.status);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} employees assigned successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} assignments failed`);
    }
    
    setShowBulkAssign(false);
    setSelectedEmployeesForGroup([]);
    setBulkAssignTargetGroup('');
    fetchEmployees(currentPage, searchTerm);
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup.id);
    }
  };

  // Schedule override
  const handleScheduleOverride = async () => {
    if (!overrideGroupId) {
      toast.error('Please select a group');
      return;
    }

    try {
      await axiosInstance.post('/api/employee-groups/schedule/override', {
        date: overrideDate,
        half: overrideHalf,
        groupId: overrideGroupId
      });
      toast.success('Schedule overridden successfully');
      setShowScheduleOverride(false);
      if (showScheduleModal) {
        fetchSchedulePreview();
      }
    } catch (err: any) {
      console.error('Schedule override error:', err.response?.status);
      toast.error(err.response?.data?.message || 'Failed to override schedule');
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeesForGroup(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPhotoPreview(event.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Photo selected!');
  };

  const handleRemovePhoto = () => {
    setFormPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setFormPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleRegisterFingerprint = () => {
    setRegisteringBiometric(true);
    setTimeout(() => {
      setRegisteringBiometric(false);
      setFormFingerprint(true);
      setFormFingerprintId(`FP-${formId || 'NEW'}-${Math.floor(1000 + Math.random() * 9000)}`);
      toast.success('Fingerprint registered!');
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Please enter Employee Full Name'); return; }
    setIsLoading(true);
    try {
      let photoUrl = formPhoto;
      if (formPhotoFile) photoUrl = await fileToBase64(formPhotoFile);

      if (isNew) {
        await axiosInstance.post('/api/employees', {
          employeeNumber: formId, 
          fullName: formName.trim(), 
          department: formDepartment.trim(),
          fingerprintId: formFingerprint ? formFingerprintId : null, 
          photo: photoUrl,
          subsidyType: formSubsidyType, 
          employeeType: formEmployeeType, 
          groupId: formGroupId || undefined
        });
        toast.success('Employee registered!');
      } else {
        if (!selectedEmp?.id) {
          toast.error('Employee ID is missing');
          return;
        }
        
        const updatePayload: any = {
          fullName: formName.trim(),
          department: formDepartment.trim(),
          photo: photoUrl,
          status: formStatus,
          employeeType: formEmployeeType,
        };
        
        if (formGroupId !== undefined) {
          updatePayload.groupId = formGroupId || null;
        }
        
        await axiosInstance.put(`/api/employees/${selectedEmp.id}`, updatePayload);
        toast.success('Changes saved!');
      }
      
      setIsNew(false);
      setFormPhotoFile(null);
      setPhotoPreview(null);
      fetchEmployees(currentPage, searchTerm);
    } catch (err: any) {
      console.error('Save error:', err.response?.status, err.response?.data);
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateEmployee = async () => {
    if (!selectedEmp?.id) return;
    if (!window.confirm(`Deactivate ${selectedEmp.fullName}?`)) return;
    try {
      await axiosInstance.post(`/api/employees/${selectedEmp.id}/deactivate`);
      toast.success('Employee deactivated');
      setFormStatus('INACTIVE');
      fetchEmployees(currentPage, searchTerm);
    } catch (err: any) {
      console.error('Deactivate error:', err.response?.status);
      toast.error(err.response?.data?.message || 'Failed to deactivate');
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormName.trim()) { toast.error('Please enter group name'); return; }
    setGroupFormSubmitting(true);
    try {
      const payload = {
        name: groupFormName.trim(), 
        description: groupFormDescription.trim(),
        rotationOrder: groupFormRotationOrder,
        effectiveDate: groupFormEffectiveDate || new Date().toISOString(),
        ...(isNewGroup ? {} : { status: groupFormStatus })
      };
      
      if (isNewGroup) {
        await axiosInstance.post('/api/employee-groups', payload);
        toast.success('Group created!');
      } else if (selectedGroup) {
        await axiosInstance.put(`/api/employee-groups/${selectedGroup.id}`, payload);
        toast.success('Group updated!');
      }
      
      setIsNewGroup(false);
      setSelectedGroup(null);
      fetchGroups();
    } catch (err: any) {
      console.error('Group save error:', err.response?.status);
      toast.error(err.response?.data?.message || 'Failed to save group');
    } finally {
      setGroupFormSubmitting(false);
    }
  };

  // Toggle group status - with fallback for 500 errors
  const handleToggleGroupStatus = async (group: EmployeeGroup) => {
    try {
      const endpoint = group.status === 'ACTIVE' 
        ? `/api/employee-groups/${group.id}/deactivate`
        : `/api/employee-groups/${group.id}/activate`;
      
      await axiosInstance.post(endpoint, { effectiveDate: new Date().toISOString() });
      toast.success(`Group ${group.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
      fetchGroups();
    } catch (err: any) {
      console.error('Toggle group status error:', err.response?.status, err.response?.data);
      
      // Fallback: Try updating the group directly via PUT
      if (err.response?.status === 500 || err.response?.status === 404) {
        try {
          const newStatus = group.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          await axiosInstance.put(`/api/employee-groups/${group.id}`, {
            name: group.name,
            description: group.description || '',
            rotationOrder: group.rotationOrder,
            status: newStatus,
            effectiveDate: new Date().toISOString()
          });
          toast.success(`Group ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
          fetchGroups();
        } catch (fallbackErr: any) {
          console.error('Fallback toggle failed:', fallbackErr.response?.status);
          toast.error('Failed to update group status. Please try again.');
        }
      } else {
        toast.error(err.response?.data?.message || 'Failed to update group');
      }
    }
  };

  // Import functions
  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const mappedData = jsonData.map((row: any) => {
          let employeeNumber = '', fullName = '', department = '', fingerprintId = '', photo = '';
          let employeeType = 'NORMAL', subsidyType = 'NORMAL';

          const cols = {
            employeeNumber: ['Pers.No.', 'EmployeeNumber', 'Employee ID', 'ID', 'PersNo', 'Pers.No', 'Employee No'],
            name: ['Employee Name', 'fullName', 'Name', 'Full Name', 'EmployeeName', 'FullName'],
            department: ['Department', 'department', 'Dept'],
            fingerprint: ['Fingerprint', 'fingerprintId', 'Biometric', 'FP'],
            photo: ['Photo', 'photo', 'Image', 'image'],
            employeeType: ['EmployeeType', 'employeeType', 'Type', 'Category'],
            subsidyType: ['SubsidyType', 'subsidyType', 'Subsidy']
          };

          for (const col of cols.employeeNumber) { if (row[col]) { employeeNumber = String(row[col]).trim(); break; } }
          for (const col of cols.name) { if (row[col]) { fullName = String(row[col]).trim(); break; } }
          for (const col of cols.department) { if (row[col]) { department = String(row[col]).trim(); break; } }
          for (const col of cols.fingerprint) { if (row[col]) { fingerprintId = String(row[col]).trim(); break; } }
          for (const col of cols.photo) { if (row[col]) { photo = String(row[col]).trim(); break; } }
          for (const col of cols.employeeType) {
            if (row[col]) { const v = String(row[col]).trim().toUpperCase(); if (v === 'SHIFT' || v === 'NORMAL') employeeType = v; break; }
          }
          for (const col of cols.subsidyType) {
            if (row[col]) { const v = String(row[col]).trim().toUpperCase(); if (v === 'SPECIAL' || v === 'NORMAL') subsidyType = v; break; }
          }

          let finalFingerprintId = fingerprintId;
          const fv = String(fingerprintId).toLowerCase();
          if (fv === 'yes' || fv === 'true') finalFingerprintId = `FP-${employeeNumber || Date.now()}`;
          else if (fv === 'no' || fv === 'false' || fv === '') finalFingerprintId = '';

          return { EmployeeNumber: employeeNumber, fullName, department, fingerprintId: finalFingerprintId || null, photo: photo || null, employeeType, subsidyType };
        });

        const validRows = mappedData.filter(row => row.EmployeeNumber && row.fullName);
        const errors: string[] = [];
        mappedData.forEach((row, index) => {
          if (!row.EmployeeNumber) errors.push(`Row ${index + 2}: Missing Employee Number`);
          if (!row.fullName) errors.push(`Row ${index + 2}: Missing Employee Name`);
        });

        if (validRows.length === 0) {
          toast.error('No valid rows found');
          setImportErrors(['No valid rows found. Required: Pers.No., Employee Name']);
          setImportData([]);
          return;
        }

        const ws2 = XLSX.utils.json_to_sheet(validRows);
        const wb2 = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb2, ws2, 'Employees');
        const excelBuffer = XLSX.write(wb2, { bookType: 'xlsx', type: 'array' });
        const mappedFile = new File([excelBuffer], 'mapped_employees.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const uploadFormData = new FormData();
        uploadFormData.append('file', mappedFile);

        setIsImporting(true);
        try {
          const res = await axiosInstance.post('/api/employees/import/preview', uploadFormData, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.success && res.data?.data) {
            const data = res.data.data;
            setImportData(data.validRows || []);
            setImportStats({ totalRows: data.totalRows || 0, validCount: data.validCount || 0, errorCount: data.errorCount || 0 });
            if (data.previewToken) setPreviewToken(data.previewToken);
            if (data.errors?.length > 0) {
              setImportErrors([...errors, ...data.errors.map((err: any) => `Row ${err.row}: ${err.field} - ${err.message}`)]);
            } else if (errors.length > 0) {
              setImportErrors(errors);
            } else {
              setImportErrors([]);
              toast.success(`Loaded ${data.validCount} employees`);
            }
          }
        } catch (error: any) {
          console.error('Import preview error:', error.response?.status);
          setImportErrors([error.response?.data?.message || 'Failed to process file']);
        } finally {
          setIsImporting(false);
        }
      } catch (error) {
        toast.error('Failed to read file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (!isDragging) setIsDragging(true); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (['.xlsx', '.xls', '.csv'].includes(ext)) handleFileUpload(file);
      else toast.error('Please upload an Excel or CSV file');
    }
  };

  const handleConfirmImport = async () => {
    if (importData.length === 0) { toast.error('No data'); return; }
    if (importErrors.length > 0) { toast.error('Fix errors first'); return; }
    if (!previewToken) { toast.error('No preview token'); return; }
    setIsImporting(true);
    try {
      const res = await axiosInstance.post('/api/employees/import/confirm', { previewToken });
      if (res.data?.success || res.status === 201) {
        toast.success('Import completed!');
        setShowImportModal(false);
        setImportData([]);
        setImportErrors([]);
        setPreviewToken(null);
        setImportStats(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchEmployees(currentPage, searchTerm);
      }
    } catch (error: any) {
      console.error('Import confirm error:', error.response?.status);
      toast.error(error.response?.data?.message || 'Failed to import');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { 'Pers.No.': 'EMP-00123', 'Employee Name': 'Abebe Girma', 'Department': 'Engineering', 'Fingerprint': 'Yes', 'Photo': '', 'EmployeeType': 'NORMAL', 'SubsidyType': 'NORMAL' },
      { 'Pers.No.': 'EMP-00124', 'Employee Name': 'Tigist Haile', 'Department': 'HR', 'Fingerprint': 'No', 'Photo': '', 'EmployeeType': 'SHIFT', 'SubsidyType': 'SPECIAL' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employee_import_template.xlsx');
    toast.success('Template downloaded!');
  };

  // Get active groups for dropdown
  const activeGroups = groups.filter(g => g.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">Employee Management</h1>
          <p className="text-brand-gray-neutral text-sm mt-2">Configure employee directory, groups, and biometric fingerprint maps</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'employees' ? (
            <>
              <button onClick={() => setShowBulkAssign(true)} className="h-[44px] bg-brand-light-green/30 text-brand-dark-green px-5 rounded-[8px] text-sm font-medium hover:bg-brand-light-green/50 transition flex items-center gap-2 shadow-sm border border-brand-light-green">
                <Users size={18} /><span>Bulk Assign</span>
              </button>
              <button onClick={() => setShowImportModal(true)} className="h-[44px] bg-brand-light-green/30 text-brand-dark-green px-5 rounded-[8px] text-sm font-medium hover:bg-brand-light-green/50 transition flex items-center gap-2 shadow-sm border border-brand-light-green">
                <UploadSimple size={18} /><span>Import Excel</span>
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowScheduleOverride(true)} className="h-[44px] border border-brand-gold text-brand-gold px-5 rounded-[8px] text-sm font-medium hover:bg-brand-gold/10 transition flex items-center gap-2">
                <Calendar size={18} /><span>Override Schedule</span>
              </button>
              <button onClick={() => {
                setIsNewGroup(true); setSelectedGroup(null);
                setGroupFormName(''); setGroupFormDescription('');
                setGroupFormRotationOrder(groups.length + 1);
                setGroupFormEffectiveDate(new Date().toISOString().split('T')[0]);
                setGroupFormStatus('ACTIVE');
              }} className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-sm">
                <Plus size={18} /><span>New Group</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-[8px] w-fit -mt-2 mb-2">
        <button onClick={() => setActiveTab('employees')} className={`px-4 py-2 rounded-[6px] text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'employees' ? 'bg-white text-brand-dark-green shadow-sm' : 'text-brand-gray-neutral hover:text-brand-dark-green'}`}>
          <Users size={16} />Employees
        </button>
        <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 rounded-[6px] text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'groups' ? 'bg-white text-brand-dark-green shadow-sm' : 'text-brand-gray-neutral hover:text-brand-dark-green'}`}>
          <Gear size={16} />Groups
        </button>
      </div>

      {/* EMPLOYEE TAB */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          {/* Master Panel */}
          <div className="lg:col-span-4 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex gap-2 select-none">
                <div className="relative flex-1">
                  <input type="text" placeholder="Search by name or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs text-brand-dark-green" />
                  <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`h-10 px-3 rounded-[8px] text-xs font-medium flex items-center gap-1 transition ${showFilters || activeFiltersCount > 0 ? 'bg-brand-dark-green text-brand-white' : 'border border-gray-300 text-brand-gray-neutral hover:bg-gray-50'}`}>
                  <FunnelSimple size={14} />
                  {activeFiltersCount > 0 && <span className="ml-1 bg-brand-gold text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center">{activeFiltersCount}</span>}
                </button>
                <button onClick={handleCreateNewClick} className="h-10 bg-brand-gold hover:opacity-90 transition text-brand-white px-3 rounded-[8px] text-xs font-medium flex items-center gap-1 shrink-0">
                  <Plus size={14} weight="bold" /><span>Register</span>
                </button>
              </div>
              {showFilters && (
                <div className="bg-gray-50 rounded-[8px] p-3 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-dark-green flex items-center gap-1"><Funnel size={14} />Filters</span>
                    {activeFiltersCount > 0 && <button onClick={clearAllFilters} className="text-[10px] text-brand-error-red hover:underline">Clear all</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="block text-[10px] font-medium text-brand-gray-neutral mb-1">Employee Type</label><select value={filterEmployeeType} onChange={(e) => setFilterEmployeeType(e.target.value)} className="w-full h-8 px-2 border border-gray-300 rounded-[6px] text-[11px] text-brand-dark-green bg-white focus:outline-none focus:border-brand-dark-green"><option value="">All Types</option><option value="NORMAL">Normal</option><option value="SHIFT">Shift</option></select></div>
                    <div><label className="block text-[10px] font-medium text-brand-gray-neutral mb-1">Subsidy Type</label><select value={filterSubsidyType} onChange={(e) => setFilterSubsidyType(e.target.value)} className="w-full h-8 px-2 border border-gray-300 rounded-[6px] text-[11px] text-brand-dark-green bg-white focus:outline-none focus:border-brand-dark-green"><option value="">All Subsidies</option><option value="NORMAL">Normal</option><option value="SPECIAL">Special</option></select></div>
                    <div><label className="block text-[10px] font-medium text-brand-gray-neutral mb-1">Status</label><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full h-8 px-2 border border-gray-300 rounded-[6px] text-[11px] text-brand-dark-green bg-white focus:outline-none focus:border-brand-dark-green"><option value="">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
                  </div>
                  {activeFiltersCount > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {filterEmployeeType && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-light-green/20 text-[10px] text-brand-dark-green font-medium">Type: {filterEmployeeType}<button onClick={() => setFilterEmployeeType('')}><X size={10} /></button></span>}
                      {filterSubsidyType && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-light-green/20 text-[10px] text-brand-dark-green font-medium">Subsidy: {filterSubsidyType}<button onClick={() => setFilterSubsidyType('')}><X size={10} /></button></span>}
                      {filterStatus && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-light-green/20 text-[10px] text-brand-dark-green font-medium">Status: {filterStatus}<button onClick={() => setFilterStatus('')}><X size={10} /></button></span>}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-brand-gray-neutral">Loading...</div>
              ) : employees.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-brand-gray-neutral text-xs select-none mb-2">{searchTerm || activeFiltersCount > 0 ? 'No employees matching criteria' : 'No employees yet'}</div>
                  {activeFiltersCount > 0 && <button onClick={clearAllFilters} className="text-[11px] text-brand-gold hover:underline">Clear all filters</button>}
                </div>
              ) : (
                employees.map((emp) => (
                  <div key={emp.id} className={`p-3.5 flex items-center gap-3 transition-colors ${selectedEmp?.id === emp.id ? 'bg-brand-light-green/20' : 'hover:bg-[#F9FAFB]'}`}>
                    {showBulkAssign && (
                      <input type="checkbox" checked={selectedEmployeesForGroup.includes(emp.id)} onChange={() => toggleEmployeeSelection(emp.id)} className="w-4 h-4 rounded border-gray-300 text-brand-dark-green focus:ring-brand-dark-green shrink-0" />
                    )}
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleSelectEmployee(emp)}>
                      <img src={emp.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'} alt={emp.fullName} className="w-10 h-10 rounded-full object-cover border border-brand-light-green/30 shrink-0" />
                      <div>
                        <h4 className="text-brand-dark-green font-semibold text-xs leading-normal">{emp.fullName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-[10px] text-brand-gray-neutral">{emp.department || 'No Dept'}</p>
                          {emp.employeeType === 'SHIFT' && (
                            <>
                              <span className="text-[9px] px-1 py-0.5 rounded bg-brand-dark-green/10 text-brand-dark-green font-medium">Shift</span>
                              {(emp.currentGroup?.name || emp.groupName) && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100">{emp.currentGroup?.name || emp.groupName}</span>
                              )}
                            </>
                          )}
                          {emp.subsidyType === 'SPECIAL' && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-brand-gold/20 text-brand-gold font-medium">Special</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[12px] font-mono text-brand-gray-neutral bg-gray-50 px-1 py-0.5 rounded border border-gray-100">{emp.employeeNumber || emp.id}</span>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status !== 'INACTIVE' ? 'bg-brand-dark-green' : 'bg-brand-gray-neutral'}`} />
                        <span className="text-[9px] text-brand-gray-neutral">{emp.status === 'INACTIVE' ? 'Inactive' : 'Active'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {totalEmployees > 0 && (
              <div className="border-t border-gray-100 p-3 flex items-center justify-between select-none bg-gray-50/50">
                <span className="text-[10px] text-brand-gray-neutral">Showing {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalEmployees)} of {totalEmployees}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><CaretLeft size={16} /></button>
                  <span className="text-[10px] text-brand-dark-green font-medium px-2">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><CaretRight size={16} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-6 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 h-[600px] flex flex-col justify-between">
            <form onSubmit={handleSave} className="space-y-6 overflow-y-auto pr-1 flex-1">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between select-none">
                <h3 className="text-brand-dark-green font-semibold text-base">{isNew ? 'Register New Employee' : 'Employee Details'}</h3>
                {isNew && <span className="text-xs text-brand-gold font-bold uppercase tracking-wider bg-brand-light-green/20 px-2 py-0.5 rounded">Creation Mode</span>}
              </div>

              {/* Group Assignment - Only visible for SHIFT type employees */}
              {((!isNew && selectedEmp && formEmployeeType === 'SHIFT') || (isNew && formEmployeeType === 'SHIFT')) && (
                !isNew && selectedEmp ? (
                  <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 border border-blue-200 rounded-[8px] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-brand-dark-green flex items-center gap-1.5">
                        <Users size={12} />Group Assignment
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">Shift Worker</span>
                      </h4>
                      {(selectedEmp.currentGroup?.name || selectedEmp.groupName) && !isEditingGroup && (
                        <button type="button" onClick={handleRemoveFromGroup} className="text-[10px] text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                          <UserMinus size={12} />Remove
                        </button>
                      )}
                    </div>
                    {!isEditingGroup ? (
                      <div>
                        {(selectedEmp.currentGroup?.name || selectedEmp.groupName) ? (
                          <div className="flex items-center justify-between bg-white rounded-[6px] p-3 border border-blue-200">
                            <div>
                              <p className="text-sm font-medium text-brand-dark-green">
                                {selectedEmp.currentGroup?.name || selectedEmp.groupName}
                              </p>
                              <p className="text-[9px] text-brand-gray-neutral mt-0.5">
                                Group ID: {selectedEmp.currentGroup?.id || selectedEmp.groupId}
                              </p>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setIsEditingGroup(true); 
                                setSelectedNewGroupId(selectedEmp.currentGroup?.id || selectedEmp.groupId || ''); 
                              }} 
                              className="h-8 px-3 rounded-[6px] text-[11px] font-medium border border-brand-dark-green text-brand-dark-green hover:bg-brand-dark-green/5 transition flex items-center gap-1"
                            >
                              <Swap size={12} />Change
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-white rounded-[6px] p-3 border border-dashed border-blue-300">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-brand-gray-neutral" />
                              <p className="text-xs text-brand-gray-neutral">Not assigned to any group</p>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setIsEditingGroup(true); 
                                setSelectedNewGroupId(''); 
                              }} 
                              className="h-8 px-3 rounded-[6px] text-[11px] font-medium bg-brand-dark-green text-white hover:opacity-90 transition flex items-center gap-1"
                            >
                              <UserPlus size={12} />Assign Group
                            </button>
                          </div>
                        )}
                        <p className="text-[9px] text-brand-gray-neutral mt-2 flex items-center gap-1">
                          <Info size={10} />Shift employees follow group-based meal rotation schedules
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-white rounded-[6px] p-3 border border-blue-200">
                        <div>
                          <label className="block text-[11px] font-medium text-brand-dark-green mb-1">
                            {(selectedEmp.currentGroup?.name || selectedEmp.groupName) ? 'Change to New Group' : 'Select Group'}
                          </label>
                          <select 
                            value={selectedNewGroupId} 
                            onChange={(e) => setSelectedNewGroupId(e.target.value)} 
                            className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] text-xs text-brand-dark-green bg-white focus:outline-none focus:border-brand-dark-green"
                          >
                            <option value="">-- Select a group --</option>
                            {activeGroups.map(group => (
                              <option key={group.id} value={group.id}>
                                {group.name} (Order: #{group.rotationOrder})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={handleMoveEmployeeToGroup} 
                            disabled={!selectedNewGroupId || isSubmittingGroup} 
                            className="flex-1 h-[36px] bg-brand-gold text-white rounded-[6px] text-[11px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1"
                          >
                            {isSubmittingGroup ? (
                              <><span className="animate-spin inline-block">⟳</span> Processing...</>
                            ) : (selectedEmp.currentGroup?.name || selectedEmp.groupName) ? (
                              <><Swap size={12} /> Move to Group</>
                            ) : (
                              <><UserPlus size={12} /> Assign to Group</>
                            )}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => { 
                              setIsEditingGroup(false); 
                              setSelectedNewGroupId(selectedEmp.currentGroup?.id || selectedEmp.groupId || ''); 
                            }} 
                            disabled={isSubmittingGroup} 
                            className="h-[36px] px-4 border border-gray-300 rounded-[6px] text-[11px] font-medium hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Initial Group Assignment for new SHIFT employee */
                  <div className="bg-blue-50/50 border border-blue-200 rounded-[8px] p-4">
                    <h4 className="text-xs font-semibold text-brand-dark-green mb-3 flex items-center gap-1.5">
                      <Users size={12} />Initial Group Assignment
                    </h4>
                    <select 
                      value={formGroupId} 
                      onChange={(e) => setFormGroupId(e.target.value)} 
                      className="w-full h-[40px] px-3 border border-gray-300 rounded-[8px] text-xs text-brand-dark-green bg-white focus:outline-none focus:border-brand-dark-green"
                    >
                      <option value="">-- Select initial group (optional) --</option>
                      {activeGroups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} (Order: #{group.rotationOrder})
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-brand-gray-neutral mt-2">
                      You can assign the shift worker to a meal rotation group now or do it later
                    </p>
                  </div>
                )
              )}

              {/* Info message for NORMAL type employees */}
              {!isNew && selectedEmp && formEmployeeType === 'NORMAL' && (
                <div className="bg-gray-50 border border-gray-200 rounded-[8px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-brand-gray-neutral" />
                    <h4 className="text-xs font-semibold text-brand-dark-green">Employee Type: Normal</h4>
                  </div>
                  <p className="text-[10px] text-brand-gray-neutral">
                    Normal employees don't follow group-based meal rotation schedules. 
                    Change employee type to "Shift" to enable group assignment.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-6">
                <div className="relative">
                  <img src={photoPreview || formPhoto} alt="Preview" className="w-[96px] h-[96px] rounded-full object-cover border-2 border-brand-light-green shadow-sm" />
                  {formPhotoFile && <div className="absolute -top-1 -right-1 bg-brand-dark-green text-brand-white text-[8px] px-1.5 py-0.5 rounded-full">New</div>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="file" ref={photoInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" id="photo-upload" />
                    <label htmlFor="photo-upload" className="cursor-pointer text-brand-gold text-xs font-semibold hover:underline flex items-center gap-1"><UploadSimple size={14} />Upload Photo</label>
                    {(formPhotoFile || photoPreview) && <button type="button" onClick={handleRemovePhoto} className="text-brand-error-red text-xs font-semibold hover:underline flex items-center gap-1"><Trash size={14} />Remove</button>}
                  </div>
                  <p className="text-brand-gray-neutral text-[10px]">JPG, PNG, GIF, WEBP. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-[13px] font-medium text-brand-dark-green">Employee Number</label><input type="text" value={formId} disabled={!isNew} onChange={(e) => setFormId(e.target.value)} className="w-full h-[44px] px-3 bg-gray-50 border border-gray-200 text-brand-dark-green font-mono text-[13px] rounded-[8px]" /></div>
                <div className="space-y-1.5"><label className="block text-[13px] font-medium text-brand-dark-green">Full Name</label><input type="text" required placeholder="e.g. John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green" /></div>
                <div className="space-y-1.5"><label className="block text-[13px] font-medium text-brand-dark-green">Department</label><input type="text" placeholder="e.g. Engineering" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green" /></div>
                <div className="space-y-1.5 select-none"><label className="block text-[13px] font-medium text-brand-dark-green">Status</label><div className="flex gap-2"><button type="button" onClick={() => setFormStatus('ACTIVE')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formStatus === 'ACTIVE' ? 'bg-brand-dark-green text-white border-brand-dark-green' : 'border-gray-300'}`}>Active</button><button type="button" onClick={() => setFormStatus('INACTIVE')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formStatus === 'INACTIVE' ? 'bg-red-500 text-white border-red-500' : 'border-gray-300'}`}>Inactive</button></div></div>
                <div className="space-y-1.5 select-none">
                  <label className="block text-[13px] font-medium text-brand-dark-green">Employee Type</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setFormEmployeeType('NORMAL');
                        if (formEmployeeType === 'SHIFT') {
                          setFormGroupId('');
                          if (!isNew && selectedEmp) {
                            setSelectedNewGroupId('');
                          }
                        }
                      }} 
                      className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formEmployeeType === 'NORMAL' ? 'bg-brand-dark-green text-white border-brand-dark-green' : 'border-gray-300'}`}
                    >
                      Normal
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormEmployeeType('SHIFT')} 
                      className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formEmployeeType === 'SHIFT' ? 'bg-brand-dark-green text-white border-brand-dark-green' : 'border-gray-300'}`}
                    >
                      Shift
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 select-none"><label className="block text-[13px] font-medium text-brand-dark-green">Subsidy Type</label><div className="flex gap-2"><button type="button" onClick={() => setFormSubsidyType('NORMAL')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formSubsidyType === 'NORMAL' ? 'bg-brand-dark-green text-white border-brand-dark-green' : 'border-gray-300'}`}>Normal</button><button type="button" onClick={() => setFormSubsidyType('SPECIAL')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${formSubsidyType === 'SPECIAL' ? 'bg-brand-gold text-white border-brand-gold' : 'border-gray-300'}`}>Special</button></div></div>
              </div>

              <div className="bg-[#F9FAFB]/50 border border-gray-200 rounded-[8px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Fingerprint size={20} className={formFingerprint ? 'text-brand-dark-green' : 'text-brand-gray-neutral'} /><span className="text-sm font-semibold text-brand-dark-green">Biometric Profile</span></div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${formFingerprint ? 'bg-brand-dark-green/10 text-brand-dark-green' : 'bg-gray-200 text-brand-gray-neutral'}`}>{formFingerprint ? 'Registered' : 'Not Configured'}</span>
                </div>
                <p className="text-brand-gray-neutral text-xs">Each employee must have an active biometric fingerprint scan.</p>
                <button type="button" disabled={registeringBiometric} onClick={handleRegisterFingerprint} className="text-xs font-semibold text-brand-gold border border-brand-gold/40 px-3 py-1.5 rounded hover:bg-brand-gold/5 disabled:opacity-50">{registeringBiometric ? 'Reading...' : 'Register Fingerprint'}</button>
              </div>
            </form>

            <div className="border-t border-gray-100 pt-4 flex justify-end gap-3 select-none">
              {!isNew && selectedEmp && <button type="button" onClick={handleDeactivateEmployee} disabled={formStatus === 'INACTIVE'} className="px-5 h-[44px] border border-brand-error-red text-brand-error-red rounded-[8px] text-sm font-medium hover:bg-brand-error-red/5 disabled:opacity-50">Deactivate</button>}
              {isNew && <button type="button" onClick={() => { setIsNew(false); if (employees.length > 0) handleSelectEmployee(employees[0]); }} className="px-5 h-[44px] border border-gray-300 rounded-[8px] text-sm">Cancel</button>}
              <button onClick={handleSave} className="px-6 h-[44px] bg-brand-gold text-white rounded-[8px] font-medium text-sm hover:opacity-90">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          <div className="lg:col-span-4 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 flex gap-2">
              <div className="relative flex-1">
                <input type="text" placeholder="Search groups..." value={groupSearchTerm} onChange={(e) => setGroupSearchTerm(e.target.value)} className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-xs" />
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
              </div>
              <button onClick={() => { setShowScheduleModal(true); fetchSchedulePreview(); }} className="h-10 border border-brand-light-green text-brand-dark-green px-3 rounded-[8px] text-xs font-medium flex items-center gap-1 hover:bg-brand-light-green/20"><Calendar size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {groups.filter(g => !groupSearchTerm || g.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).map(group => (
                <div key={group.id} onClick={() => handleSelectGroup(group)} className={`p-4 cursor-pointer ${selectedGroup?.id === group.id ? 'bg-brand-light-green/20 border-l-2 border-l-brand-dark-green' : 'hover:bg-[#F9FAFB] border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between mb-2"><h4 className="text-brand-dark-green font-semibold text-sm">{group.name}</h4><span className={`w-2 h-2 rounded-full ${group.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`} /></div>
                  {group.description && <p className="text-[11px] text-brand-gray-neutral mb-2">{group.description}</p>}
                  <div className="flex items-center justify-between text-[10px] text-brand-gray-neutral"><span>Rotation: #{group.rotationOrder}</span><span className="text-[9px]">{group.status}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 h-[600px] flex flex-col">
            {selectedGroup || isNewGroup ? (
              <div className="space-y-6 flex-1 overflow-y-auto">
                <form onSubmit={handleSaveGroup} className="space-y-6">
                  <div className="border-b border-gray-100 pb-3 flex justify-between">
                    <h3 className="text-brand-dark-green font-semibold text-base">{isNewGroup ? 'Create Group' : 'Edit Group'}</h3>
                    {!isNewGroup && selectedGroup && (
                      <button type="button" onClick={() => handleToggleGroupStatus(selectedGroup)} className={`h-8 px-3 rounded-[6px] text-[11px] font-medium ${selectedGroup.status === 'ACTIVE' ? 'border border-red-300 text-red-600' : 'border border-green-300 text-green-600'}`}>{selectedGroup.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div><label className="block text-[13px] font-medium mb-1.5">Name *</label><input type="text" required value={groupFormName} onChange={(e) => setGroupFormName(e.target.value)} className="w-full h-[44px] px-3 border rounded-[8px] text-sm" placeholder="Group A - Morning" /></div>
                    <div><label className="block text-[13px] font-medium mb-1.5">Description</label><textarea value={groupFormDescription} onChange={(e) => setGroupFormDescription(e.target.value)} className="w-full px-3 py-2.5 border rounded-[8px] text-sm h-24" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-[13px] font-medium mb-1.5">Rotation</label><input type="number" min="1" value={groupFormRotationOrder} onChange={(e) => setGroupFormRotationOrder(parseInt(e.target.value) || 1)} className="w-full h-[44px] px-3 border rounded-[8px] text-sm" /></div>
                      <div><label className="block text-[13px] font-medium mb-1.5">Date</label><input type="date" value={groupFormEffectiveDate} onChange={(e) => setGroupFormEffectiveDate(e.target.value)} className="w-full h-[44px] px-3 border rounded-[8px] text-sm" /></div>
                    </div>
                    {!isNewGroup && (
                      <div><label className="block text-[13px] font-medium mb-1.5">Status</label><div className="flex gap-2"><button type="button" onClick={() => setGroupFormStatus('ACTIVE')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${groupFormStatus === 'ACTIVE' ? 'bg-brand-dark-green text-white' : 'border-gray-300'}`}>Active</button><button type="button" onClick={() => setGroupFormStatus('INACTIVE')} className={`h-[44px] flex-1 rounded-[8px] text-xs font-semibold border ${groupFormStatus === 'INACTIVE' ? 'bg-red-500 text-white' : 'border-gray-300'}`}>Inactive</button></div></div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <button type="button" onClick={() => { setIsNewGroup(false); setSelectedGroup(null); setGroupMembers([]); }} className="flex-1 h-[44px] border rounded-[8px] text-sm">Cancel</button>
                    <button type="submit" disabled={groupFormSubmitting} className="flex-1 h-[44px] bg-brand-gold text-white rounded-[8px] font-medium text-sm">{groupFormSubmitting ? 'Saving...' : isNewGroup ? 'Create' : 'Save'}</button>
                  </div>
                </form>

                {!isNewGroup && selectedGroup && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-brand-dark-green flex items-center gap-2"><Users size={16} />Group Members</h4>
                      <button onClick={() => fetchGroupMembers(selectedGroup.id)} className="text-[10px] text-brand-gold hover:underline">Refresh</button>
                    </div>
                    {groupMembersLoading ? (
                      <div className="text-center py-4 text-xs text-brand-gray-neutral">Loading members...</div>
                    ) : groupMembers.length === 0 ? (
                      <div className="text-center py-4"><Users size={24} className="mx-auto opacity-30 mb-1" /><p className="text-xs text-brand-gray-neutral">No members in this group</p><p className="text-[9px] text-brand-gray-neutral mt-1">Assign employees from the Employees tab</p></div>
                    ) : (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {groupMembers.map(member => (
                          <div key={member.id} className="flex items-center justify-between bg-gray-50 rounded-[6px] p-2">
                            <div className="flex items-center gap-2">
                              <img src={member.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'} alt={member.fullName} className="w-7 h-7 rounded-full object-cover" />
                              <div><p className="text-[11px] font-medium text-brand-dark-green">{member.fullName}</p><p className="text-[9px] text-brand-gray-neutral">{member.employeeNumber} • {member.employeeType === 'SHIFT' ? 'Shift' : 'Normal'}</p></div>
                            </div>
                            <button onClick={() => handleRemoveGroupMember(member.id, member.fullName)} className="text-[10px] text-red-600 hover:text-red-700 font-medium">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Users size={48} className="opacity-30 mb-3" /><p className="text-sm text-brand-gray-neutral">Select a group to view details</p><p className="text-xs text-brand-gray-neutral mt-1">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 max-w-[800px] w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">Meal Rotation Schedule</h3><button onClick={() => setShowScheduleModal(false)}><X size={20} /></button></div>
            <div className="flex gap-4 mb-4">
              <div><label className="text-xs">From</label><input type="date" value={scheduleDateRange.from} onChange={(e) => setScheduleDateRange(prev => ({ ...prev, from: e.target.value }))} className="h-10 px-3 border rounded-[8px] text-sm" /></div>
              <div><label className="text-xs">To</label><input type="date" value={scheduleDateRange.to} onChange={(e) => setScheduleDateRange(prev => ({ ...prev, to: e.target.value }))} className="h-10 px-3 border rounded-[8px] text-sm" /></div>
              <button onClick={fetchSchedulePreview} className="h-10 px-4 bg-brand-gold text-white rounded-[8px] text-sm self-end">Load</button>
            </div>
            {schedulePreview.length > 0 ? (
              <div className="space-y-2">
                {schedulePreview.map((slot, idx) => (
                  <div key={idx} className="flex justify-between bg-gray-50 rounded-[6px] p-3 text-xs">
                    <div className="flex items-center gap-3"><Calendar size={14} /><span>{slot.date}</span><Clock size={14} /><span>{slot.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}</span></div>
                    <span className={slot.groupName ? 'px-2 py-0.5 bg-brand-light-green/20 rounded' : 'italic'}>{slot.groupName || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-12"><Calendar size={40} className="mx-auto opacity-30" /><p>Load schedule to view</p></div>}
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 max-w-[500px] w-full">
            <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">Bulk Assign to Group</h3><button onClick={() => { setShowBulkAssign(false); setSelectedEmployeesForGroup([]); setBulkAssignTargetGroup(''); }}><X size={20} /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Target Group</label><select value={bulkAssignTargetGroup} onChange={(e) => setBulkAssignTargetGroup(e.target.value)} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] text-sm"><option value="">-- Select group --</option>{activeGroups.map(group => (<option key={group.id} value={group.id}>{group.name}</option>))}</select></div>
              <div><label className="block text-sm font-medium mb-2">Selected ({selectedEmployeesForGroup.length})</label><div className="max-h-[200px] overflow-y-auto space-y-1">{selectedEmployeesForGroup.length === 0 ? (<p className="text-xs text-gray-500 text-center py-4">Click checkboxes in the employee list</p>) : selectedEmployeesForGroup.map(id => { const emp = employees.find(e => e.id === id); return emp ? (<div key={id} className="flex justify-between bg-gray-50 p-2 rounded"><span className="text-sm">{emp.fullName}</span><button onClick={() => toggleEmployeeSelection(id)} className="text-red-500"><X size={14} /></button></div>) : null; })}</div></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowBulkAssign(false); setSelectedEmployeesForGroup([]); setBulkAssignTargetGroup(''); }} className="flex-1 h-[44px] border rounded-[8px] text-sm">Cancel</button>
              <button onClick={handleBulkAssignToGroup} disabled={!bulkAssignTargetGroup || selectedEmployeesForGroup.length === 0} className="flex-1 h-[44px] bg-brand-gold text-white rounded-[8px] font-medium text-sm disabled:opacity-50">Assign {selectedEmployeesForGroup.length}</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Override Modal */}
      {showScheduleOverride && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 max-w-[500px] w-full">
            <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">Override Schedule</h3><button onClick={() => setShowScheduleOverride(false)}><X size={20} /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Date</label><input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] text-sm" /></div>
              <div><label className="block text-sm font-medium mb-2">Session Half</label><select value={overrideHalf} onChange={(e) => setOverrideHalf(e.target.value as 'FIRST_HALF' | 'SECOND_HALF')} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] text-sm"><option value="FIRST_HALF">First Half</option><option value="SECOND_HALF">Second Half</option></select></div>
              <div><label className="block text-sm font-medium mb-2">Group</label><select value={overrideGroupId} onChange={(e) => setOverrideGroupId(e.target.value)} className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] text-sm"><option value="">-- Select group --</option>{activeGroups.map(group => (<option key={group.id} value={group.id}>{group.name}</option>))}</select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowScheduleOverride(false)} className="flex-1 h-[44px] border rounded-[8px] text-sm">Cancel</button>
              <button onClick={handleScheduleOverride} disabled={!overrideGroupId} className="flex-1 h-[44px] bg-brand-gold text-white rounded-[8px] font-medium text-sm disabled:opacity-50">Override</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[700px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none sticky top-0 bg-white z-10">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2"><FileCsv size={22} className="text-brand-gold" />Import Employees</h3>
              <button onClick={() => { setShowImportModal(false); setImportData([]); setImportErrors([]); setPreviewToken(null); setImportStats(null); setIsDragging(false); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className={`border-2 border-dashed rounded-[8px] p-8 text-center transition-all duration-200 ${isDragging ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-300 hover:border-brand-gold'}`} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
                <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleFileInputChange} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <UploadSimple size={40} className="text-brand-gray-neutral mx-auto mb-3" />
                  <p className="text-brand-dark-green font-medium mb-1">Upload Excel or CSV File</p>
                  <p className="text-brand-gray-neutral text-xs">Drag and drop or click to browse</p>
                </label>
                {importStats && (
                  <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                    <span className="text-brand-dark-green bg-brand-light-green/20 px-3 py-1.5 rounded-full"><FileCsv size={14} className="text-brand-gold inline mr-1" />{importStats.totalRows} rows</span>
                    {importStats.validCount > 0 && <span className="text-green-700 bg-green-100 px-3 py-1.5 rounded-full"><Check size={14} className="inline mr-1" />{importStats.validCount} valid</span>}
                    {importStats.errorCount > 0 && <span className="text-red-700 bg-red-100 px-3 py-1.5 rounded-full"><X size={14} className="inline mr-1" />{importStats.errorCount} errors</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={downloadTemplate} className="text-brand-gold text-sm font-semibold hover:underline flex items-center gap-1"><FileCsv size={16} />Download Template</button>
                <span className="text-[10px] text-brand-gray-neutral">Required: <strong>Pers.No.</strong>, <strong>Employee Name</strong></span>
              </div>
              {importData.length > 0 && (
                <div className="border border-gray-200 rounded-[8px] p-4 max-h-[200px] overflow-auto">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-brand-dark-green">Preview ({importData.length})</span>{importErrors.length > 0 && <span className="text-xs text-brand-error-red">{importErrors.length} error(s)</span>}</div>
                  <div className="text-xs space-y-1">
                    {importData.slice(0, 5).map((row, index) => (
                      <div key={index} className="flex gap-2 border-b border-gray-50 py-1"><span className="text-brand-gray-neutral w-6">{index + 1}.</span><span className="font-mono text-[10px] bg-gray-50 px-1 rounded">{row.EmployeeNumber || '—'}</span><span className="font-medium text-brand-dark-green">{row.fullName || 'Unknown'}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="bg-brand-error-red/5 border border-brand-error-red/30 rounded-[8px] p-3 max-h-[150px] overflow-auto">
                  <span className="text-xs font-medium text-brand-error-red block mb-1">Errors ({importErrors.length}):</span>
                  {importErrors.map((error, index) => (<div key={index} className="text-[10px] text-brand-error-red/90 py-0.5 flex gap-1"><Warning size={12} className="shrink-0 mt-0.5" /><span>{error}</span></div>))}
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => { setShowImportModal(false); setImportData([]); setImportErrors([]); setPreviewToken(null); setImportStats(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="flex-1 h-[44px] border rounded-[8px] text-sm">Cancel</button>
                <button onClick={handleConfirmImport} disabled={importData.length === 0 || importErrors.length > 0 || isImporting || !previewToken} className="flex-1 h-[44px] bg-brand-gold text-white rounded-[8px] font-medium text-sm disabled:opacity-50">{isImporting ? 'Importing...' : `Import ${importData.length}`}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirmModal && removeTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] p-6 max-w-[400px] w-full shadow-xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Warning size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-brand-dark-green mb-1">Remove from Group</h3>
              <p className="text-sm text-brand-gray-neutral">
                Are you sure you want to remove <strong className="text-brand-dark-green">{removeTarget.name}</strong> from <strong className="text-brand-dark-green">{removeTarget.groupName}</strong>?
              </p>
              <p className="text-xs text-brand-gray-neutral mt-2">This employee will no longer follow this group's meal rotation schedule.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRemoveConfirmModal(false); setRemoveTarget(null); }} className="flex-1 h-[44px] border border-gray-300 text-brand-gray-neutral rounded-[8px] font-medium text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleConfirmRemove} className="flex-1 h-[44px] bg-red-500 text-white rounded-[8px] font-medium text-sm hover:bg-red-600 transition flex items-center justify-center gap-2"><UserMinus size={16} />Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;