import React, { useState, useEffect, useRef } from 'react';
import { db, type MenuItem } from '../../db/db';
import { Plus, ToggleLeft, ToggleRight, Info, Calendar, Trash, UploadSimple, FileCsv, PencilSimple, ClockCounterClockwise } from '@phosphor-icons/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export const MenuManagement: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Edit Item Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Update Price Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      const items = await db.menuItems.toArray();
      setMenuItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // Fetch price history for a specific menu item
  const fetchPriceHistory = async (itemId: number) => {
    try {
      // Get all audit logs related to this menu item
      const logs = await db.auditLogs
        .filter(log => 
          log.entity === 'MenuItem' && 
          log.entityId === String(itemId) &&
          (log.action === 'Update Menu Price' || log.action === 'Edit Menu Item' || log.action === 'Import Menu Item')
        )
        .toArray();

      // Parse the history entries
      const history = logs.map(log => {
        let details: any = {};
        try {
          details = JSON.parse(log.details);
        } catch (e) {
          details = {};
        }

        return {
          timestamp: log.timestamp,
          action: log.action,
          oldPrice: details.oldPrice || null,
          newPrice: details.newPrice || details.price || null,
          effectiveDate: details.effectiveDate || null,
          user: log.user,
          details: details
        };
      });

      // Sort by timestamp (newest first)
      history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setPriceHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Failed to load price history');
    }
  };

  // Toggle Active/Inactive state
  const handleToggleActive = async (item: MenuItem) => {
    const originalItem = { ...item };
    const newStatus = !item.isActive;
    
    setMenuItems(prev => 
      prev.map(i => i.id === item.id ? { ...i, isActive: newStatus } : i)
    );
    
    try {
      await db.menuItems.update(item.id!, { isActive: newStatus });
      
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: newStatus ? 'Activate Menu Item' : 'Deactivate Menu Item',
        entity: 'MenuItem',
        entityId: String(item.id),
        details: JSON.stringify({ name: item.name })
      });

      toast.success(`${item.name} is now ${newStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status.');
      setMenuItems(prev => 
        prev.map(i => i.id === item.id ? originalItem : i)
      );
    }
  };

  // Add Menu Item submit
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
      const currentDate = new Date().toISOString().split('T')[0];
      const createdItem: Omit<MenuItem, 'id'> = {
        name: newItemName.trim(),
        description: newItemDescription.trim() || undefined,
        price: priceNum,
        isActive: true,
        effectiveDate: currentDate
      };

      const addedId = await db.menuItems.add(createdItem);
      
      const newItem = { ...createdItem, id: addedId };
      setMenuItems(prev => [...prev, newItem]);

      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Create Menu Item',
        entity: 'MenuItem',
        entityId: String(addedId),
        details: JSON.stringify({ 
          name: createdItem.name, 
          description: createdItem.description || 'Not provided',
          price: createdItem.price,
          effectiveDate: currentDate
        })
      });

      toast.success(`${newItemName} added to menu!`);
      setShowAddModal(false);
      setNewItemName('');
      setNewItemDescription('');
      setNewItemPrice('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create menu item.');
      fetchMenuItems();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Menu Item submit
  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editName.trim()) {
      toast.error('Item name is required');
      return;
    }

    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const originalItem = { ...editingItem };
    
    setIsSubmitting(true);
    try {
      const updatedData = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        price: priceNum
      };

      await db.menuItems.update(editingItem.id!, updatedData);

      // Update local state
      setMenuItems(prev => 
        prev.map(i => i.id === editingItem.id 
          ? { ...i, ...updatedData } 
          : i
        )
      );

      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Edit Menu Item',
        entity: 'MenuItem',
        entityId: String(editingItem.id),
        details: JSON.stringify({
          oldName: originalItem.name,
          newName: editName.trim(),
          oldDescription: originalItem.description || 'Not provided',
          newDescription: editDescription.trim() || 'Not provided',
          oldPrice: originalItem.price,
          newPrice: priceNum,
          effectiveDate: new Date().toISOString().split('T')[0]
        })
      });

      toast.success(`"${editName}" updated successfully!`);
      setShowEditModal(false);
      setEditingItem(null);
      setEditName('');
      setEditDescription('');
      setEditPrice('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update menu item.');
      setMenuItems(prev => 
        prev.map(i => i.id === originalItem.id ? originalItem : i)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Price submit
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
    
    setMenuItems(prev => 
      prev.map(i => i.id === selectedItem.id 
        ? { ...i, price: priceNum, effectiveDate } 
        : i
      )
    );
    
    setIsSubmitting(true);
    try {
      await db.menuItems.update(selectedItem.id!, { 
        price: priceNum,
        effectiveDate: effectiveDate
      });

      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Update Menu Price',
        entity: 'MenuItem',
        entityId: String(selectedItem.id),
        details: JSON.stringify({ 
          name: selectedItem.name, 
          oldPrice: selectedItem.price, 
          newPrice: priceNum, 
          effectiveDate: effectiveDate
        })
      });

      toast.success(`Price updated for ${selectedItem.name} to ${priceNum.toFixed(2)} ETB`);
      setSelectedItem(null);
      setNewPrice('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update price');
      setMenuItems(prev => 
        prev.map(i => i.id === originalItem.id ? originalItem : i)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Menu Item
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setIsSubmitting(true);
    try {
      const { id, name, price, description } = itemToDelete;

      setMenuItems(prev => prev.filter(i => i.id !== id));
      setItemToDelete(null);

      await db.menuItems.delete(id!);

      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Delete Menu Item',
        entity: 'MenuItem',
        entityId: String(id),
        details: JSON.stringify({ name, price, description: description || 'Not provided' })
      });

      toast.success(`${name} has been deleted from the menu.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete menu item.');
      fetchMenuItems();
    } finally {
      setIsSubmitting(false);
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
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
      const rowErrors: string[] = [];
      
      // Check required fields (Name and Price are required, Description is optional)
      if (!row['Name'] || row['Name'].toString().trim() === '') {
        rowErrors.push('Missing "Name"');
      }

      // Validate Price (required)
      if (!row['Price'] && row['Price'] !== 0) {
        rowErrors.push('Missing "Price"');
      } else if (row['Price']) {
        const price = parseFloat(row['Price']);
        if (isNaN(price) || price <= 0) {
          rowErrors.push(`Price must be a positive number (got "${row['Price']}")`);
        }
      }

      // Validate Status (optional - defaults to Active)
      if (row['Status'] && !['Active', 'Inactive'].includes(row['Status'])) {
        rowErrors.push(`Status must be "Active" or "Inactive" (got "${row['Status']}")`);
      }

      // If there are errors for this row, combine them
      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
      }
    });

    setImportErrors(errors);
    
    if (errors.length === 0) {
      toast.success(`Successfully loaded ${data.length} menu items for import`);
    } else {
      toast.error(`Found ${errors.length} errors in the data`);
    }
  };

  const handleImportMenuItems = async () => {
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
    const failedRows: string[] = [];
    const currentDate = new Date().toISOString().split('T')[0];

    try {
      const currentItems = await db.menuItems.toArray();
      const existingNames = new Set(currentItems.map(item => item.name.toLowerCase()));

      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const rowNum = i + 2;
        
        try {
          // Validate required fields for each row before import
          const rowErrors: string[] = [];
          if (!row['Name'] || row['Name'].toString().trim() === '') {
            rowErrors.push('Name is required');
          }
          
          const price = parseFloat(row['Price']);
          if (isNaN(price) || price <= 0) {
            rowErrors.push('Price must be a positive number');
          }

          if (rowErrors.length > 0) {
            failedRows.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
            failed++;
            continue;
          }

          const itemName = row['Name'].toString().trim();
          
          // Check for duplicate name
          if (existingNames.has(itemName.toLowerCase())) {
            failedRows.push(`Row ${rowNum}: Item "${itemName}" already exists in the menu`);
            failed++;
            continue;
          }

          const effectiveDate = row['Effective Date'] || currentDate;
          const menuItem: Omit<MenuItem, 'id'> = {
            name: itemName,
            description: row['Description'] ? row['Description'].toString().trim() : undefined,
            price: price,
            isActive: row['Status'] === 'Inactive' ? false : true,
            effectiveDate: effectiveDate
          };

          const addedId = await db.menuItems.add(menuItem);
          existingNames.add(itemName.toLowerCase());
          imported++;

          // Add audit log for each imported item
          await db.auditLogs.add({
            timestamp: new Date(),
            user: 'admin',
            action: 'Import Menu Item',
            entity: 'MenuItem',
            entityId: String(addedId),
            details: JSON.stringify({ 
              name: menuItem.name,
              description: menuItem.description || 'Not provided',
              price: menuItem.price,
              isActive: menuItem.isActive,
              effectiveDate: effectiveDate
            })
          });
        } catch (error) {
          console.error('Error importing row:', error);
          failedRows.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          failed++;
        }
      }

      // Log any failed rows
      if (failedRows.length > 0) {
        console.warn('Failed imports:', failedRows.join('\n'));
        
        await db.auditLogs.add({
          timestamp: new Date(),
          user: 'admin',
          action: 'Import Menu Items - Partial Failure',
          entity: 'MenuItem',
          entityId: 'bulk-import',
          details: JSON.stringify({ 
            total: importData.length, 
            imported, 
            failed,
            failedRows: failedRows,
            timestamp: new Date().toISOString()
          })
        });
      } else {
        await db.auditLogs.add({
          timestamp: new Date(),
          user: 'admin',
          action: 'Import Menu Items',
          entity: 'MenuItem',
          entityId: 'bulk-import',
          details: JSON.stringify({ 
            total: importData.length, 
            imported, 
            failed,
            timestamp: new Date().toISOString()
          })
        });
      }

      if (failed > 0) {
        toast.error(`Imported ${imported} items, ${failed} failed. Check console for details.`);
      } else {
        toast.success(`Successfully imported ${imported} menu items`);
      }
      
      await fetchMenuItems();
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
      setIsDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import menu items');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Name': 'Shiro Wot',
        'Description': 'Traditional Ethiopian chickpea stew served with injera',
        'Price': 95.00,
        'Status': 'Active',
        'Effective Date': '2026-07-01'
      },
      {
        'Name': 'Doro Wot',
        'Description': 'Spicy chicken stew with boiled eggs and injera',
        'Price': 120.00,
        'Status': 'Active',
        'Effective Date': '2026-07-01'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MenuItems');
    XLSX.writeFile(wb, 'menu_import_template.xlsx');
    toast.success('Template downloaded!');
  };

  // Get the item name for history modal
  const getHistoryItemName = () => {
    if (historyItem) {
      return historyItem.name;
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-4 select-none">
        <div>
          <h1 className="text-[28px] font-semibold text-brand-dark-green font-sans leading-none">
            Menu Management
          </h1>
          <p className="text-brand-gray-neutral text-sm mt-2">
            Configure cafeteria menu registry listings and price splits
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Grid List of Menu Items */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-50 border border-gray-100 animate-pulse rounded-[12px]" />
          ))}
        </div>
      ) : menuItems.length === 0 ? (
        <div className="p-16 text-center select-none bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px]">
          <span className="text-brand-gray-neutral text-4xl block">🍽️</span>
          <p className="text-brand-gray-neutral text-sm mt-2">No menu items recorded</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => {
            return (
              <div 
                key={item.id}
                className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between group"
              >
                {/* Header detail */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-brand-dark-green font-bold text-lg leading-tight">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-brand-gray-neutral text-sm leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {/* Price History Button */}
                    <button
                      onClick={() => {
                        setHistoryItem(item);
                        fetchPriceHistory(item.id!);
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
                        setEditPrice(item.price.toString());
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
                      title={item.isActive ? 'Deactivate item' : 'Activate item'}
                    >
                      {item.isActive ? (
                        <ToggleRight size={32} weight="fill" className="text-brand-dark-green" />
                      ) : (
                        <ToggleLeft size={32} className="text-brand-gray-neutral" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer price & update link */}
                <div className="border-t border-gray-100 pt-4 mt-4 flex items-center justify-between select-none">
                  <div>
                    <span className="text-[11px] text-brand-gray-neutral block">Price rate</span>
                    <span className="text-brand-dark-green font-bold text-[18px]">
                      {item.price.toFixed(2)} <span className="text-xs font-medium">ETB</span>
                    </span>
                    <span className="text-[10px] text-brand-gray-neutral block mt-0.5">
                      Effective: {new Date(item.effectiveDate).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setNewPrice(item.price.toString());
                    }}
                    className="text-brand-gold text-sm font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Update Price</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD MENU ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Add Menu Item
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Item Name *
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
                  Description <span className="text-brand-gray-neutral text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  placeholder="Brief description of the menu item"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green resize-none"
                />
                <p className="text-[10px] text-brand-gray-neutral">
                  Optional: Add details about ingredients, preparation, or serving suggestions
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Initial Price (ETB) *
                </label>
                <input
                  type="number"
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

      {/* EDIT MENU ITEM MODAL */}
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
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditItem} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Item Name *
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

              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Price (ETB) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 95.00"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green"
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

      {/* UPDATE PRICE MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Update Price
              </h3>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-3 text-xs space-y-1.5 select-none">
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Menu Item:</span>
                <span className="text-brand-dark-green font-bold">{selectedItem.name}</span>
              </div>
              {selectedItem.description && (
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Description:</span>
                  <span className="text-brand-dark-green text-right max-w-[200px]">{selectedItem.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Current Price:</span>
                <span className="text-brand-dark-green font-semibold">{selectedItem.price.toFixed(2)} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Effective Date:</span>
                <span className="text-brand-dark-green">{new Date(selectedItem.effectiveDate).toLocaleDateString()}</span>
              </div>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  New Price Rate (ETB)
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
                <label className="block text-[13px] font-medium text-brand-dark-green flex items-center gap-1 select-none">
                  <Calendar size={16} />
                  <span>Price Effective Date</span>
                </label>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green cursor-pointer"
                />
              </div>

              <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-[11px] leading-relaxed text-brand-dark-green select-none flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Historical Trace Safe</strong>: This modification takes effect immediately for new registrations. All previously finalized transactions remain unaffected.
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

      {/* PRICE HISTORY MODAL */}
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
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {priceHistory.length === 0 ? (
                <div className="text-center py-8 text-brand-gray-neutral select-none">
                  <ClockCounterClockwise size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No price history available</p>
                  <p className="text-xs mt-1">Price changes will appear here when updated</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {priceHistory.map((entry, index) => (
                    <div key={index} className="bg-[#F9FAFB]/50 border border-gray-100 rounded-[8px] p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-brand-dark-green">
                          {entry.action}
                        </span>
                        <span className="text-[10px] text-brand-gray-neutral">
                          {entry.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {entry.oldPrice !== null && (
                            <>
                              <span className="text-brand-gray-neutral">From:</span>
                              <span className="text-brand-error-red font-semibold">
                                {entry.oldPrice.toFixed(2)} ETB
                              </span>
                              <span className="text-brand-gray-neutral">→</span>
                            </>
                          )}
                          <span className="text-brand-gray-neutral">To:</span>
                          <span className="text-brand-dark-green font-semibold">
                            {entry.newPrice.toFixed(2)} ETB
                          </span>
                        </div>
                        <span className="text-[10px] text-brand-gray-neutral">
                          by {entry.user}
                        </span>
                      </div>
                      {entry.effectiveDate && (
                        <div className="text-[10px] text-brand-gray-neutral mt-1">
                          Effective: {new Date(entry.effectiveDate).toLocaleDateString()}
                        </div>
                      )}
                      {entry.details && entry.details.oldName && entry.details.newName && (
                        <div className="text-[10px] text-brand-gray-neutral mt-1">
                          Name changed: {entry.details.oldName} → {entry.details.newName}
                        </div>
                      )}
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

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[420px] w-full border border-brand-light-green/30 shadow-xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-brand-light-green/30 pb-3 select-none">
              <h3 className="text-brand-dark-green font-semibold text-[18px]">
                Delete Menu Item
              </h3>
              <button 
                onClick={() => setItemToDelete(null)}
                className="text-brand-gray-neutral hover:text-brand-dark-green font-medium text-lg focus:outline-none transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-brand-gray-neutral">
                Are you sure you want to delete <strong className="text-brand-dark-green">{itemToDelete.name}</strong>?
              </p>
              
              <div className="bg-brand-light-green/10 border border-brand-light-green/30 rounded-[8px] p-3 text-xs space-y-1.5 select-none">
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Item:</span>
                  <span className="text-brand-dark-green font-bold">{itemToDelete.name}</span>
                </div>
                {itemToDelete.description && (
                  <div className="flex justify-between">
                    <span className="text-brand-gray-neutral">Description:</span>
                    <span className="text-brand-dark-green">{itemToDelete.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Current Price:</span>
                  <span className="text-brand-dark-green font-semibold">{itemToDelete.price.toFixed(2)} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-gray-neutral">Status:</span>
                  <span className={itemToDelete.isActive ? 'text-green-600' : 'text-brand-error-red'}>
                    {itemToDelete.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="bg-brand-error-red/5 border-l-4 border-brand-error-red p-3 rounded-r-[8px] text-[11px] leading-relaxed select-none flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5 text-brand-error-red" />
                <span className="text-brand-error-red/90">
                  <strong>Warning:</strong> This action cannot be undone. All data associated with this item will be permanently removed.
                </span>
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

      {/* IMPORT MODAL */}
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
                  Required: Name, Price <span className="text-brand-gray-neutral/60">| Optional: Description, Status, Effective Date</span>
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
                          {row['Name'] || 'Unknown'}
                        </span>
                        {row['Description'] && (
                          <span className="text-brand-gray-neutral text-[10px] truncate max-w-[100px]">
                            ({row['Description']})
                          </span>
                        )}
                        <span className="text-brand-gray-neutral">-</span>
                        <span className="text-brand-dark-green font-semibold">
                          {row['Price'] ? `${parseFloat(row['Price']).toFixed(2)} ETB` : 'N/A'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          row['Status'] === 'Inactive' 
                            ? 'bg-gray-100 text-gray-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {row['Status'] || 'Active'}
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

              {importErrors.length > 0 && (
                <div className="bg-brand-error-red/5 border border-brand-error-red/30 rounded-[8px] p-3 max-h-[150px] overflow-auto">
                  <span className="text-xs font-medium text-brand-error-red block mb-1">
                    Errors ({importErrors.length}):
                  </span>
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-[10px] text-brand-error-red/90 py-0.5">
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
                  onClick={handleImportMenuItems}
                  disabled={importData.length === 0 || importErrors.length > 0 || isImporting}
                  className="flex-1 h-[44px] bg-brand-gold text-brand-white rounded-[8px] font-medium text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : `Import ${importData.length} Items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};