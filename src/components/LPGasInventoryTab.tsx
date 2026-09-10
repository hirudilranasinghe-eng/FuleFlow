import React, { useState, useEffect } from 'react';
import { Flame, Plus, AlertTriangle, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { LPGasItem } from '../types';

export default function LPGasInventoryTab() {
  const [gasItems, setGasItems] = useState<LPGasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LPGasItem | null>(null);

  const [adjustmentForm, setAdjustmentForm] = useState({
    full_count: 0,
    empty_count: 0,
    reason: ''
  });

  const sizes: ('12.5 kg' | '37.5 kg' | '5.0 kg' | '2.3 kg')[] = [
    '12.5 kg',
    '37.5 kg',
    '5.0 kg',
    '2.3 kg'
  ];

  useEffect(() => {
    fetchGasItems();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.updatedInventory) {
        setGasItems(customEvent.detail.updatedInventory);
      } else {
        fetchGasItems();
      }
    };

    window.addEventListener('gas-inventory-updated', handleUpdate);
    window.addEventListener('focus', fetchGasItems);
    
    return () => {
      window.removeEventListener('gas-inventory-updated', handleUpdate);
      window.removeEventListener('focus', fetchGasItems);
    };
  }, []);

  const fetchGasItems = async () => {
    try {
      setLoading(true);
      // Try to fetch from supabase
      const { data, error } = await supabase.from('gas_inventory').select('*');
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setGasItems(data);
        localStorage.setItem('fuel_flow_gas_inventory', JSON.stringify(data));
      } else {
        // Initialize if empty
        const initialItems = sizes.map(size => ({
          id: `gas-${size.toLowerCase().replace(/\s+/g, '')}`,
          size,
          full_count: 0,
          empty_count: 0,
          last_updated: new Date().toISOString()
        }));
        
        // Try to insert
        const { error: insertError } = await supabase.from('gas_inventory').insert(initialItems);
        if (!insertError) {
          setGasItems(initialItems);
          localStorage.setItem('fuel_flow_gas_inventory', JSON.stringify(initialItems));
        } else {
          // Fallback to local state if table doesn't exist
          if (insertError.code !== 'PGRST205') {
            console.warn("Could not insert initial items into gas_inventory", insertError);
          }
          setGasItems(initialItems);
        }
      }
    } catch (err: any) {
      if (err?.code !== 'PGRST205') {
        console.error('Error fetching gas items:', err);
      }
      
      // Fallback to local storage
      let loadedFromLocal = false;
      try {
        const localData = localStorage.getItem('fuel_flow_gas_inventory');
        if (localData) {
          setGasItems(JSON.parse(localData));
          loadedFromLocal = true;
        }
      } catch (e) {
        console.error('Failed to read from local storage', e);
      }

      if (!loadedFromLocal) {
        const initialItems = sizes.map(size => ({
          id: `gas-${size.toLowerCase().replace(/\s+/g, '')}`,
          size,
          full_count: 0,
          empty_count: 0,
          last_updated: new Date().toISOString()
        }));
        setGasItems(initialItems);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjustment = (item: LPGasItem) => {
    setSelectedItem(item);
    setAdjustmentForm({
      full_count: item.full_count,
      empty_count: item.empty_count,
      reason: ''
    });
    setIsAdjustmentModalOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!selectedItem) return;
    
    try {
      const updatedItem = {
        ...selectedItem,
        full_count: adjustmentForm.full_count,
        empty_count: adjustmentForm.empty_count,
        last_updated: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('gas_inventory')
        .update({ 
          full_count: updatedItem.full_count, 
          empty_count: updatedItem.empty_count,
          last_updated: updatedItem.last_updated
        })
        .eq('id', selectedItem.id);
        
      if (error && error.code !== 'PGRST205') {
        console.warn("Failed to update in DB, updating local state only", error);
      }

      // Record adjustment (optional, if gas_adjustments table exists)
      const adjustmentRecord = {
        gas_item_id: selectedItem.id,
        full_count_change: adjustmentForm.full_count - selectedItem.full_count,
        empty_count_change: adjustmentForm.empty_count - selectedItem.empty_count,
        reason: adjustmentForm.reason || 'Manual Adjustment',
        timestamp: new Date().toISOString()
      };
      
      const { error: adjustError } = await supabase.from('gas_adjustments').insert([adjustmentRecord]);
      if (adjustError && adjustError.code !== 'PGRST205') {
        console.warn(adjustError);
      }
      
      setGasItems(prev => prev.map(item => item.id === selectedItem.id ? updatedItem : item));
      setIsAdjustmentModalOpen(false);
    } catch (err: any) {
      if (err?.code !== 'PGRST205') {
        console.error('Error saving adjustment:', err);
      }
      // Fallback update
      const updatedItem = {
        ...selectedItem,
        full_count: adjustmentForm.full_count,
        empty_count: adjustmentForm.empty_count,
        last_updated: new Date().toISOString()
      };
      setGasItems(prev => prev.map(item => item.id === selectedItem.id ? updatedItem : item));
      setIsAdjustmentModalOpen(false);
    }
  };

  const getStatusColor = (count: number) => {
    if (count <= 5) return 'text-red-600 bg-red-50 border-red-200';
    if (count <= 15) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-y-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <div className="p-1.5 bg-orange-100 rounded-lg">
            <Flame className="w-5 h-5 text-orange-600" />
          </div>
          LP Gas Inventory
        </h1>
        <p className="text-xs text-slate-500 mt-1">Manage Litro Gas cylinder stock and returns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {gasItems.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-white">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-gray-900">{item.size}</h3>
                {item.full_count < 15 && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                    <AlertTriangle className="w-3 h-3" />
                    Low Stock
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {item.size === '12.5 kg' ? 'Standard Household' : 
                 item.size === '37.5 kg' ? 'Commercial Industrial' :
                 item.size === '5.0 kg' ? 'Buddy' : 'Portable'}
              </p>
            </div>
            
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Full Cylinders</span>
                  <div className={`text-2xl font-bold p-3 rounded-lg border ${getStatusColor(item.full_count)} text-center`}>
                    {item.full_count}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Empty Cylinders</span>
                  <div className="text-2xl font-bold p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-center">
                    {item.empty_count}
                  </div>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  Total: {item.full_count + item.empty_count} units
                </span>
                <button
                  onClick={() => handleOpenAdjustment(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adjust
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdjustmentModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Adjust {selectedItem.size} Stock</h2>
              <button 
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Cylinders
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={adjustmentForm.full_count}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, full_count: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <div className="mt-1 text-xs text-gray-500">Current: {selectedItem.full_count}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Empty Cylinders
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={adjustmentForm.empty_count}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, empty_count: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <div className="mt-1 text-xs text-gray-500">Current: {selectedItem.empty_count}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Adjustment
                </label>
                <select 
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mb-2"
                >
                  <option value="">Select a reason...</option>
                  <option value="Initial Stock Setup">Initial Stock Setup</option>
                  <option value="Distributor Stock Inward">Distributor Stock Inward</option>
                  <option value="Customer Return/Purchase">Customer Return/Purchase</option>
                  <option value="Count Correction">Count Correction</option>
                  <option value="Damaged/Removed">Damaged/Removed</option>
                </select>
                <input 
                  type="text"
                  placeholder="Or enter custom reason..."
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdjustment}
                disabled={!adjustmentForm.reason}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
