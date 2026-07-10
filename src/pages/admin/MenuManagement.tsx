import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../client/axios';
import {
  Plus,
  ToggleLeft,
  ToggleRight,
  Info,
  Trash,
  UploadSimple,
  FileCsv,
  PencilSimple,
  ClockCounterClockwise,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  X,
  Download,
  Check,
  Warning,
} from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import type { MenuItem } from '../../types/api';

/** Meal session types supported by the system */
type MealSession = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'DRINK';

/**
 * MenuManagement Component
 * 
 * Handles complete menu item management including:
 * - CRUD operations for menu items
 * - Price history tracking
 * - Bulk import via Excel/CSV
 * - Toggle active/inactive status
 */
export const MenuManagement: React.FC = () => {
  // ==========================================================================
  // STATE
  // ==========================================================================

  /** List of menu items */
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  /** Loading state for data fetching */
  const [loading, setLoading] = useState(true);
  /** Search term for filtering menu items */
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const limit = 10;

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemMealtype, setNewItemMealtype] = useState<MealSession>('BREAKFAST');

  // Edit Item Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMealtype, setEditMealtype] = useState<MealSession>('BREAKFAST');

  // Update Price Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');

  // Price History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItem, setHistoryItem] = useState<MenuItem | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  // Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ totalRows: number; validCount: number; errorCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  /** Submit loading state */
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  /**
   * Fetch menu items with pagination and search
   * Shows ALL items including inactive ones
   */
  const fetchMenuItems = async (page: number = currentPage, search: string = searchTerm, keepLoading: boolean = false) => {
    if (!keepLoading) {
      setLoading(true);
    }
    try {
      const params: any = {
        page: page,
        pageSize: limit,
        activeOnly: false
      };

      if (search.trim()) {
        params.query = search.trim();
      }

      const res = await axiosInstance.get('/api/menus', { params });

      if (res.data?.success && res.data?.data) {
        const list = Array.isArray(res.data.data) ? res.data.data : res.data.data.data || [];
        // ✅ Safely map items with fallback for currentPrice
        const safeList = list.map((item: any) => ({
          ...item,
          currentPrice: item.currentPrice ?? item.price ?? 0,
        }));
        setMenuItems(safeList);

        const pagination = res.data.data.pagination;
        if (pagination) {
          setTotalItems(pagination.totalCount || safeList.length);
          setTotalPages(pagination.totalPages || Math.ceil((pagination.totalCount || safeList.length) / limit));
        } else {
          setTotalItems(safeList.length);
          setTotalPages(Math.ceil(safeList.length / limit));
        }
      } else {
        setMenuItems([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to load menu registry');
      setMenuItems([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  /**
   * Fetch price history for a menu item
   */
  const fetchPriceHistory = async (itemId: string) => {
    try {
      const res = await axiosInstance.get(`/api/menus/${itemId}/price-history`);
      if (res.data?.success && res.data?.data) {
        const history = Array.isArray(res.data.data) ? res.data.data.map((entry: any) => ({
          timestamp: entry.effectiveFrom || new Date().toISOString(),
          action: 'Price Update',
          newPrice: entry.price,
          oldPrice: null,
          user: 'admin',
          effectiveFrom: entry.effectiveFrom,
          effectiveTo: entry.effectiveTo
        })) : [];
        setPriceHistory(history);
      } else {
        setPriceHistory([]);
      }
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Could not load price history');
      setPriceHistory([]);
      setShowHistoryModal(true);
    }
  };

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  /** Initial load */
  useEffect(() => {
    fetchMenuItems(1, '');
  }, []);

  /** Handle search with debounce */
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      setIsSearching(true);
      setCurrentPage(1);
      fetchMenuItems(1, searchTerm);
    }, 500);

    setSearchTimeout(timeout);

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTerm]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Handle page change for pagination
   */
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchMenuItems(newPage, searchTerm);
    }
  };

  /**
   * Toggle active/inactive status of a menu item - Optimistic Update
   */
  const handleToggleActive = async (item: MenuItem) => {
    const originalItem = { ...item };
    const newStatus = !item.active;

    // Optimistic update - update UI immediately
    setMenuItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, active: newStatus } : i)
    );

    try {
      await axiosInstance.put(`/api/menus/${item.id}`, {
        name: item.name,
        mealtype: item.mealtype,
        active: newStatus
      });

      toast.success(`${item.name} is now ${newStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Failed to update item status.');
      // Revert optimistic update on error
      setMenuItems(prev =>
        prev.map(i => i.id === item.id ? originalItem : i)
      );
    }
  };

  /**
   * Create a new menu item - Optimistic Update with seamless UI
   */
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) {
      toast.error('Please fill in all required fields');
      return;
    }
    const priceNum = parseFloat(newItemPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post('/api/menus', {
        name: newItemName.trim(),
        description: newItemDescription.trim() || undefined,
        mealtype: newItemMealtype,
        price: priceNum
      });

      if (res.data?.success) {
        // Get the created item from response or create a local one
        const newItem = res.data.data || {
          id: `temp-${Date.now()}`,
          name: newItemName.trim(),
          description: newItemDescription.trim() || undefined,
          mealtype: newItemMealtype,
          currentPrice: priceNum,
          active: true
        };

        // ✅ Ensure currentPrice is always set
        const safeNewItem = {
          ...newItem,
          currentPrice: newItem.currentPrice ?? priceNum ?? 0,
        };

        // ✅ Seamless update - add to list without clearing existing items
        setMenuItems(prev => {
          // Check if item already exists (prevent duplicates)
          const exists = prev.some(item => item.id === safeNewItem.id);
          if (exists) return prev;
          return [safeNewItem, ...prev];
        });
        
        setTotalItems(prev => prev + 1);
        // Recalculate total pages
        const newTotalPages = Math.ceil((totalItems + 1) / limit);
        setTotalPages(newTotalPages);

        toast.success(`${newItemName} added to menu!`);
        setShowAddModal(false);
        setNewItemName('');
        setNewItemDescription('');
        setNewItemPrice('');
        setNewItemMealtype('BREAKFAST');
      }
    } catch (err: any) {
      console.error('Error creating menu item:', err);
      toast.error(err.response?.data?.message || 'Failed to create menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Edit an existing menu item - Optimistic Update
   */
  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editName.trim()) {
      toast.error('Item name is required');
      return;
    }

    const originalItem = { ...editingItem };

    // Optimistic update - update UI immediately
    setMenuItems(prev =>
      prev.map(i =>
        i.id === editingItem.id
          ? {
              ...i,
              name: editName.trim(),
              description: editDescription.trim() || undefined,
              mealtype: editMealtype,
            }
          : i
      )
    );

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.put(`/api/menus/${editingItem.id}`, {
        name: editName.trim(),
        mealtype: editMealtype,
        active: editingItem.active
      });

      if (res.data?.success) {
        toast.success(`"${editName}" updated successfully!`);
        setShowEditModal(false);
        setEditingItem(null);
      }
    } catch (err: any) {
      console.error('Error updating menu item:', err);
      toast.error(err.response?.data?.message || 'Failed to update menu item');
      // Revert optimistic update on error
      setMenuItems(prev =>
        prev.map(i => i.id === originalItem.id ? originalItem : i)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Update price using the dedicated price endpoint - Optimistic Update
   */
  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !newPrice) {
      toast.error('Please enter a new price');
      return;
    }
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const originalItem = { ...selectedItem };

    // Optimistic update - update UI immediately
    setMenuItems(prev =>
      prev.map(i =>
        i.id === selectedItem.id
          ? { ...i, currentPrice: priceNum }
          : i
      )
    );

    setIsSubmitting(true);
    try {
      const payload: any = {
        price: priceNum
      };

      if (effectiveFrom) {
        payload.effectiveFrom = effectiveFrom;
      }

      const res = await axiosInstance.post(`/api/menus/${selectedItem.id}/price`, payload);

      if (res.data?.success) {
        toast.success(`Price updated for ${selectedItem.name} to ${priceNum.toFixed(2)} ETB`);
        setSelectedItem(null);
        setNewPrice('');
        setEffectiveFrom('');
      }
    } catch (err: any) {
      console.error('Error updating price:', err);
      toast.error(err.response?.data?.message || 'Failed to update price');
      // Revert optimistic update on error
      setMenuItems(prev =>
        prev.map(i => i.id === originalItem.id ? originalItem : i)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Delete a menu item - Optimistic Update
   */
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    const deletedItem = { ...itemToDelete };

    // Optimistic update - remove from UI immediately
    setMenuItems(prev => prev.filter(i => i.id !== itemToDelete.id));
    setTotalItems(prev => Math.max(0, prev - 1));
    const newTotalPages = Math.ceil(Math.max(0, totalItems - 1) / limit);
    setTotalPages(newTotalPages);

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.delete(`/api/menus/${itemToDelete.id}`);
      if (res.data?.success) {
        toast.success(`${itemToDelete.name} deleted successfully.`);
        setItemToDelete(null);
        // If current page has no items and we're not on page 1, go to previous page
        if (menuItems.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
          fetchMenuItems(currentPage - 1, searchTerm);
        }
      }
    } catch (err: any) {
      console.error('Error deleting menu item:', err);
      toast.error(err.response?.data?.message || 'Failed to delete menu item');
      // Revert optimistic update on error
      setMenuItems(prev => [...prev, deletedItem].sort((a, b) => a.name.localeCompare(b.name)));
      setTotalItems(prev => prev + 1);
      setTotalPages(Math.ceil((totalItems + 1) / limit));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // IMPORT FUNCTIONS
  // ==========================================================================

  /**
   * Handle file upload for import
   */
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    setIsImporting(true);
    try {
      const res = await axiosInstance.post('/api/menus/import/preview', formData, {
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
          setImportErrors(errorMessages);
          toast.error(`Found ${data.errors.length} validation errors`);
        } else {
          setImportErrors([]);
          toast.success(`Loaded ${data.validCount} menu items successfully`);
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
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  /**
   * Handle drag enter for file drop
   */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave for file drop
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drag over for file drop
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  /**
   * Handle file drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (['.xlsx', '.xls', '.csv'].includes(fileExtension)) {
        handleFileUpload(file);
      } else {
        toast.error('Please upload an Excel or CSV file');
      }
    }
  };

  /**
   * Confirm and complete import
   */
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
      const res = await axiosInstance.post('/api/menus/import/confirm', {
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
        // Refresh the list after import
        fetchMenuItems(currentPage, searchTerm);
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

  /**
   * Download import template
   */
  const downloadTemplate = () => {
    const template = [
      {
        'Name': 'Shiro Wot',
        'Description': 'Traditional Ethiopian chickpea stew',
        'Price': 95.00,
        'MealType': 'LUNCH'
      },
      {
        'Name': 'Full Firfir',
        'Description': 'Firfir served with boiled eggs',
        'Price': 80.00,
        'MealType': 'BREAKFAST'
      },
      {
        'Name': 'Juice',
        'Description': 'Fresh fruit juice',
        'Price': 40.00,
        'MealType': 'DRINK'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MenuItems');
    XLSX.writeFile(wb, 'menu_import_template.xlsx');
    toast.success('Template downloaded!');
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* ======================================================================
          HEADER
          ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-light-green/30 pb-4 select-none gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Menu Management
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Configure cafeteria menu registry listings and price splits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="h-[44px] bg-brand-light-green/30 text-brand-dark-green px-5 rounded-[8px] text-sm font-medium hover:bg-brand-light-green/50 transition flex items-center gap-2 shadow-sm border border-brand-light-green"
          >
            <UploadSimple size={18} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={18} weight="bold" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          SEARCH BAR
          ====================================================================== */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search menu items by name or meal type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
        />
        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-neutral" />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-brand-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* ======================================================================
          MENU ITEMS GRID
          ====================================================================== */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-50 border border-gray-100 animate-pulse rounded-[12px]" />
          ))}
        </div>
      ) : menuItems.length === 0 ? (
        <div className="p-16 text-center select-none bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px]">
          <div className="flex justify-center mb-3">
            <div className="text-brand-gray-neutral text-4xl block">🍽️</div>
          </div>
          <p className="text-brand-gray-neutral text-sm mt-2">
            {searchTerm ? 'No menu items matching search criteria' : 'No menu items recorded'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
            {menuItems.map((item) => {
              const isActive = item.active !== false;
              // ✅ Safe price access with fallback to 0
              const price = item.currentPrice ?? 0;
              return (
                <div
                  key={item.id}
                  className={`bg-brand-white border rounded-[12px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between group ${
                    isActive
                      ? 'border-[rgba(50,100,50,0.1)]'
                      : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 font-sans min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`font-bold text-base sm:text-lg leading-tight truncate ${
                          isActive ? 'text-brand-dark-green' : 'text-gray-500'
                        }`}>
                          {item.name}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap ${
                          isActive
                            ? 'bg-brand-light-green/30 text-brand-dark-green'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {item.mealtype}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-100 text-red-600 whitespace-nowrap">
                            Inactive
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className={`text-sm leading-relaxed line-clamp-2 ${
                          isActive ? 'text-brand-gray-neutral' : 'text-gray-400'
                        }`}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-start sm:self-auto">
                      {/* Price History Button */}
                      <button
                        onClick={() => {
                          setHistoryItem(item);
                          fetchPriceHistory(item.id);
                        }}
                        className="text-brand-gray-neutral hover:text-brand-gold transition-colors p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="View price history"
                      >
                        <ClockCounterClockwise size={18} />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setEditName(item.name);
                          setEditDescription(item.description || '');
                          setEditMealtype(item.mealtype as MealSession);
                          setShowEditModal(true);
                        }}
                        className="text-brand-gray-neutral hover:text-brand-gold transition-colors p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Edit item"
                      >
                        <PencilSimple size={18} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="text-brand-gray-neutral hover:text-red-500 transition-colors p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete item"
                      >
                        <Trash size={18} />
                      </button>

                      {/* Active Toggle Switch */}
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="focus:outline-none select-none"
                      >
                        {isActive ? (
                          <ToggleRight size={32} weight="fill" className="text-brand-dark-green" />
                        ) : (
                          <ToggleLeft size={32} className="text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className={`border-t pt-3 sm:pt-4 mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none ${
                    isActive ? 'border-gray-100' : 'border-gray-200'
                  }`}>
                    <div>
                      <span className={`text-[11px] block ${
                        isActive ? 'text-brand-gray-neutral' : 'text-gray-400'
                      }`}>
                        Price rate
                      </span>
                      <span className={`font-bold text-[16px] sm:text-[18px] ${
                        isActive ? 'text-brand-dark-green' : 'text-gray-500'
                      }`}>
                        {price.toFixed(2)} <span className="text-xs font-medium">ETB</span>
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setNewPrice(price.toString());
                        setEffectiveFrom(new Date().toISOString().split('T')[0]);
                      }}
                      className={`text-sm font-semibold hover:underline flex items-center gap-1 ${
                        isActive ? 'text-brand-gold' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <span>Update Price</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="border-t border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none bg-gray-50/50 rounded-b-[12px]">
              <span className="text-[11px] text-brand-gray-neutral text-center sm:text-left">
                {menuItems.length > 0 ? (
                  <>Showing {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalItems)} of {totalItems} items</>
                ) : (
                  <>0 of {totalItems}</>
                )}
              </span>
              <div className="flex items-center justify-center sm:justify-end gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CaretLeft size={18} className="text-brand-gray-neutral" />
                </button>
                <span className="text-[11px] text-brand-dark-green font-medium px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CaretRight size={18} className="text-brand-gray-neutral" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================================
          ADD MENU ITEM MODAL
          ====================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none sticky top-0 bg-white z-10">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Add Menu Item
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Item Name <span className="text-brand-error-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shiro Wot"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Meal Session <span className="text-brand-error-red">*</span>
                </label>
                <select
                  value={newItemMealtype}
                  onChange={(e) => setNewItemMealtype(e.target.value as MealSession)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                >
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="DINNER">Dinner</option>
                  <option value="DRINK">Drink</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Description <span className="text-brand-gray-neutral text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  placeholder="Brief description of the menu item"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Initial Price (ETB) <span className="text-brand-error-red">*</span>
                </label>
                <input                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 95.00"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          EDIT MENU ITEM MODAL
          ====================================================================== */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Edit Menu Item
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Item Name <span className="text-brand-error-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shiro Wot"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Meal Session <span className="text-brand-error-red">*</span>
                </label>
                <select
                  value={editMealtype}
                  onChange={(e) => setEditMealtype(e.target.value as MealSession)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                >
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="DINNER">Dinner</option>
                  <option value="DRINK">Drink</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Description <span className="text-brand-gray-neutral text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  placeholder="Brief description of the menu item"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 h-[48px] border border-gray-300 text-brand-gray-neutral rounded-[8px] font-medium text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          UPDATE PRICE MODAL
          ====================================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Update Price
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-3 text-xs space-y-1.5 select-none font-sans">
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Menu Item:</span>
                <span className="text-brand-dark-green font-bold">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Current Price:</span>
                <span className="text-brand-dark-green font-semibold">{(selectedItem.currentPrice ?? 0).toFixed(2)} ETB</span>
              </div>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  New Price Rate (ETB) <span className="text-brand-error-red">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 110.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Effective From <span className="text-brand-gray-neutral text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
                />
                <p className="text-[10px] text-brand-gray-neutral">
                  If not provided, the price takes effect immediately.
                </p>
              </div>

              <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-[11px] leading-relaxed text-brand-dark-green select-none flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Historical Trace Safe</strong>: This creates a new price version. Previous prices remain in history and are never overwritten.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[48px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Price'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          PRICE HISTORY MODAL
          ====================================================================== */}
      {showHistoryModal && historyItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[600px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <ClockCounterClockwise size={22} className="text-brand-gold" />
                Price History - {historyItem.name}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryItem(null);
                  setPriceHistory([]);
                }}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {priceHistory.length === 0 ? (
                <div className="text-center py-8 text-brand-gray-neutral select-none">
                  <ClockCounterClockwise size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No price history available</p>
                  <p className="text-xs mt-1">Prices are tracked when updated via the "Update Price" button</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {priceHistory.map((entry, index) => (
                    <div key={index} className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-3 font-sans text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-brand-dark-green">
                          {entry.action || 'Price Update'}
                        </span>
                        <span className="text-[10px] text-brand-gray-neutral font-mono">
                          {entry.effectiveFrom ? new Date(entry.effectiveFrom).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-brand-dark-green font-semibold">
                            {Number(entry.newPrice).toFixed(2)} ETB
                          </span>
                          {entry.effectiveTo && (
                            <span className="text-brand-gray-neutral text-[10px] ml-2">
                              (until {new Date(entry.effectiveTo).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-brand-gray-neutral">
                          {entry.user || 'System'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryItem(null);
                  setPriceHistory([]);
                }}
                className="px-6 h-[40px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          DELETE CONFIRMATION MODAL
          ====================================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[420px] w-full border border-brand-light-green/30 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Delete Menu Item
              </h3>
              <button
                onClick={() => setItemToDelete(null)}
                className="p-1 text-brand-gray-neutral hover:text-brand-dark-green rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-brand-gray-neutral">
                Are you sure you want to delete <strong className="text-brand-dark-green">{itemToDelete.name}</strong>?
              </p>

              <div className="bg-brand-light-green/10 border border-brand-light-green/30 rounded-[8px] p-3 text-xs space-y-1.5 select-none font-sans">
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Item:</span>
                  <span className="text-brand-dark-green font-bold">{itemToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Current Price:</span>
                  <span className="text-brand-dark-green font-semibold">{(itemToDelete.currentPrice ?? 0).toFixed(2)} ETB</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 h-[44px] border border-brand-gray-neutral/20 text-brand-gray-neutral rounded-[8px] font-medium text-sm hover:bg-brand-light-green/10 hover:border-brand-dark-green/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={isSubmitting}
                className="flex-1 h-[44px] bg-brand-error-red text-brand-white rounded-[8px] font-medium text-sm hover:bg-brand-error-red/90 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          IMPORT MODAL
          ====================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[600px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px] flex items-center gap-2">
                <FileCsv size={22} className="text-brand-gold" />
                Import Menu Items
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
              {/* File Drop Area */}
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
                    </>
                  )}
                </label>

                {importStats && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
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

              {/* Template Download */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <button
                  onClick={downloadTemplate}
                  className="text-brand-gold text-sm font-semibold hover:underline flex items-center gap-1"
                >
                  <Download size={16} />
                  Download Template
                </button>
                <span className="text-[10px] text-brand-gray-neutral">
                  Required: <strong>Name</strong>, <strong>Price</strong>, <strong>MealType</strong>
                </span>
              </div>

              {/* Preview Data */}
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
                        <span className="font-medium text-brand-dark-green truncate max-w-[120px] sm:max-w-[200px]">
                          {row.name || 'Unknown'}
                        </span>
                        <span className="text-brand-gray-neutral">-</span>
                        <span className="text-brand-dark-green font-semibold whitespace-nowrap">
                          {row.price ? `${parseFloat(row.price).toFixed(2)} ETB` : 'N/A'}
                        </span>
                        <span className="bg-brand-light-green/30 text-brand-dark-green text-[10px] px-1.5 rounded font-bold uppercase whitespace-nowrap">
                          {row.mealtype || 'LUNCH'}
                        </span>
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

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="bg-brand-error-red/5 border border-brand-error-red/30 rounded-[8px] p-3 max-h-[150px] overflow-auto">
                  <span className="text-xs font-medium text-brand-error-red block mb-1">
                    Errors ({importErrors.length}):
                  </span>
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-[10px] text-brand-error-red/90 py-0.5">
                      <span className="inline-block w-4 text-right mr-2">{index + 1}.</span>
                      {error}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
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
                    `Import ${importData.length} Items`
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

export default MenuManagement;