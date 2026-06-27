import React, { useState, useEffect } from 'react';
import { db, type MenuItem } from '../../db/db';
import { Plus, ToggleLeft, ToggleRight, Info, Calendar, Trash } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const MenuManagement: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Update Price Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  // Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

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
      toast.error('Please fill in all fields');
      return;
    }
    const priceNum = parseFloat(newItemPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdItem: Omit<MenuItem, 'id'> = {
        name: newItemName.trim(),
        price: priceNum,
        isActive: true,
        effectiveDate: new Date().toISOString().split('T')[0]
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
        details: JSON.stringify({ name: createdItem.name, price: createdItem.price })
      });

      toast.success(`${newItemName} added to menu!`);
      setShowAddModal(false);
      setNewItemName('');
      setNewItemPrice('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create menu item.');
      fetchMenuItems();
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
          effectiveDate 
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
      // Store the item info before deleting (for audit log)
      const { id, name, price } = itemToDelete;

      // Optimistically remove from UI
      setMenuItems(prev => prev.filter(i => i.id !== id));
      setItemToDelete(null);

      // Delete from database
      await db.menuItems.delete(id!);

      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Delete Menu Item',
        entity: 'MenuItem',
        entityId: String(id),
        details: JSON.stringify({ name, price })
      });

      toast.success(`${name} has been deleted from the menu.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete menu item.');
      // Rollback - refetch to restore the item
      fetchMenuItems();
    } finally {
      setIsSubmitting(false);
    }
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

        <button
          onClick={() => setShowAddModal(true)}
          className="h-[44px] bg-brand-gold text-brand-white px-5 rounded-[8px] text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={18} weight="bold" />
          <span>Add Menu Item</span>
        </button>
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
                  <div className="space-y-1.5">
                    <h3 className="text-brand-dark-green font-bold text-lg leading-tight">
                      {item.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Delete Button */}
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="text-brand-gray-neutral hover:text-red-500 transition-colors p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete item"
                    >
                      <Trash size={20} />
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
                  Item Name
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
                  Initial Price (ETB)
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
              <div className="flex justify-between">
                <span className="text-brand-gray-neutral">Current Price:</span>
                <span className="text-brand-dark-green font-semibold">{selectedItem.price.toFixed(2)} ETB</span>
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
    </div>
  );
};