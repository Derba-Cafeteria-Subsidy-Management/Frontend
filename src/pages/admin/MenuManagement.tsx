import React, { useState, useEffect } from 'react';
import { db, type MenuItem } from '../../db/db';
import { Plus, ToggleLeft, ToggleRight, Info, Calendar } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

export const MenuManagement: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemSession, setNewItemSession] = useState<'Breakfast' | 'Lunch' | 'Dinner'>('Breakfast');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Update Price Modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

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
    try {
      const newStatus = !item.isActive;
      await db.menuItems.update(item.id!, { isActive: newStatus });
      
      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: newStatus ? 'Activate Menu Item' : 'Deactivate Menu Item',
        entity: 'MenuItem',
        entityId: String(item.id),
        details: JSON.stringify({ name: item.name, session: item.session })
      });

      toast.success(`${item.name} is now ${newStatus ? 'Active' : 'Inactive'}`);
      fetchMenuItems();
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status.');
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
      const createdItem: MenuItem = {
        name: newItemName.trim(),
        session: newItemSession,
        price: priceNum,
        isActive: true,
        effectiveDate: new Date().toISOString().split('T')[0]
      };

      const addedId = await db.menuItems.add(createdItem);

      // Audit Log
      await db.auditLogs.add({
        timestamp: new Date(),
        user: 'admin',
        action: 'Create Menu Item',
        entity: 'MenuItem',
        entityId: String(addedId),
        details: JSON.stringify({ name: createdItem.name, session: createdItem.session, price: createdItem.price })
      });

      toast.success(`${newItemName} added to ${newItemSession} menu!`);
      setShowAddModal(false);
      
      // Reset Form
      setNewItemName('');
      setNewItemPrice('');
      setNewItemSession('Breakfast');
      
      fetchMenuItems();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create menu item.');
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

    setIsSubmitting(true);
    try {
      await db.menuItems.update(selectedItem.id!, { 
        price: priceNum,
        effectiveDate: effectiveDate
      });

      // Audit Log
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
      fetchMenuItems();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update price');
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
            Configure cafeteria menu registry listings, price splits, and scheduling sessions
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
                className="bg-brand-white border border-[rgba(50,100,50,0.1)] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between"
              >
                {/* Header detail */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-brand-dark-green font-bold text-lg leading-tight">
                      {item.name}
                    </h3>
                    <span className="inline-block bg-brand-light-green text-brand-dark-green text-[10px] font-semibold px-2 py-0.5 rounded uppercase select-none">
                      {item.session}
                    </span>
                  </div>

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
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            
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
              
              {/* Name */}
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

              {/* Session */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-brand-dark-green">
                  Meal Session
                </label>
                <select
                  value={newItemSession}
                  onChange={(e) => setNewItemSession(e.target.value as any)}
                  className="w-full h-[44px] px-3 border border-gray-300 rounded-[8px] focus:outline-none focus:border-brand-dark-green text-sm text-brand-dark-green bg-brand-white cursor-pointer"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>

              {/* Price */}
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

              {/* Submit */}
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
          <div className="bg-brand-white rounded-[12px] p-6 max-w-[440px] w-full border border-[rgba(50,100,50,0.15)] shadow-xl space-y-5 animate-scanner-pulse/0">
            
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
              
              {/* New Price */}
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

              {/* Effective Date Picker */}
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

              {/* Safety notice info box */}
              <div className="bg-brand-light-green/20 border-l-4 border-brand-light-green p-3 rounded-r-[8px] text-[11px] leading-relaxed text-brand-dark-green select-none flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Historical Trace Safe</strong>: This modification takes effect immediately for new registrations. All previously finalized transactions remain unaffected.
                </span>
              </div>

              {/* Submit */}
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
    </div>
  );
};
