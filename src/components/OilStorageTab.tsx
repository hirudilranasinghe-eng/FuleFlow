/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Droplets, Package, Plus, Search, 
  AlertTriangle, CheckCircle2, DollarSign, Calendar, 
  ArrowDownRight, ArrowUpRight, Filter, Edit2, Trash2, 
  RefreshCw, Layers, ShieldAlert, ShoppingCart, FileText,
  Clock, Check, X, Tag, BarChart3, AlertCircle, Loader2
} from 'lucide-react';
import { OilTank, PackagedOilItem, Employee } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchPackagedLubricants,
  savePackagedLubricant,
  deletePackagedLubricant,
  fetchBulkLubricants,
  saveBulkLubricant,
  deleteBulkLubricant,
  deductPackagedStock
} from '../lib/lubricantsClient';

interface OilStorageTabProps {
  oilTanks: OilTank[];
  setOilTanks: React.Dispatch<React.SetStateAction<OilTank[]>>;
  employees?: Employee[];
}

export default function OilStorageTab({
  oilTanks,
  setOilTanks,
  employees = []
}: OilStorageTabProps) {
  // Sub-tabs: 'bulk' | 'packaged'
  const [activeSubTab, setActiveSubTab] = useState<'bulk' | 'packaged'>('bulk');

  // Loading & Sync States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Database Data States (Initialized as empty arrays)
  const [packagedItems, setPackagedItems] = useState<PackagedOilItem[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Currency Formatter (Sri Lankan Rupees)
  const formatCurrency = (val: number) => {
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // -------------------------------------------------------------
  // DATA FETCHING & REAL-TIME SUBSCRIPTIONS
  // -------------------------------------------------------------
  const loadAllLubricantData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const [fetchedPackaged, fetchedBulk] = await Promise.all([
        fetchPackagedLubricants(),
        fetchBulkLubricants()
      ]);

      setPackagedItems(fetchedPackaged);
      if (fetchedBulk && fetchedBulk.length > 0) {
        setOilTanks(fetchedBulk);
      }
    } catch (err) {
      console.error("Error loading lubricant data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setOilTanks]);

  // Initial fetch on mount
  useEffect(() => {
    loadAllLubricantData(true);
  }, [loadAllLubricantData]);

  // Real-time Supabase subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('lubricants_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packaged_lubricants' }, async () => {
        const updated = await fetchPackagedLubricants();
        setPackagedItems(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bulk_lubricants' }, async () => {
        const updated = await fetchBulkLubricants();
        if (updated.length > 0) setOilTanks(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oil_tanks' }, async () => {
        const updated = await fetchBulkLubricants();
        if (updated.length > 0) setOilTanks(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setOilTanks]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadAllLubricantData(false);
    showToast("Lubricant storage data refreshed from Supabase.");
  };

  // -------------------------------------------------------------
  // COMPUTED KPI METRICS
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const totalBulkLiters = oilTanks.reduce((sum, t) => sum + (t.currentLevel || 0), 0);
    const totalBulkCapacity = oilTanks.reduce((sum, t) => sum + (t.capacity || 0), 0);
    const totalBulkValue = oilTanks.reduce((sum, t) => sum + ((t.currentLevel || 0) * (t.pricePerLiter || 0)), 0);

    const totalBottles = packagedItems.reduce((sum, i) => sum + (i.currentStock || 0), 0);
    const totalPackagedValue = packagedItems.reduce((sum, i) => sum + ((i.currentStock || 0) * (i.retailPrice || 0)), 0);
    const lowStockItems = packagedItems.filter(i => i.currentStock <= i.minReorderLevel);

    return {
      totalBulkLiters,
      totalBulkCapacity,
      totalBulkValue,
      totalBottles,
      totalPackagedValue,
      lowStockCount: lowStockItems.length,
      totalCombinedValue: totalBulkValue + totalPackagedValue
    };
  }, [oilTanks, packagedItems]);

  // -------------------------------------------------------------
  // MODAL STATES
  // -------------------------------------------------------------
  // 1. Quick Retail Sale Modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleItemId, setSaleItemId] = useState('');
  const [saleQty, setSaleQty] = useState<number>(1);
  const [saleCustomerName, setSaleCustomerName] = useState('Walk-in Customer');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'Cash' | 'Card' | 'Credit'>('Cash');
  const [saleNotes, setSaleNotes] = useState('');

  // 2. Add / Edit Packaged Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagedOilItem | null>(null);
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormGrade, setItemFormGrade] = useState('20W-40');
  const [itemFormSize, setItemFormSize] = useState('1L Bottle');
  const [itemFormStock, setItemFormStock] = useState<number>(0);
  const [itemFormMinStock, setItemFormMinStock] = useState<number>(0);
  const [itemFormPrice, setItemFormPrice] = useState<number>(0);
  const [itemFormLocation, setItemFormLocation] = useState('Front Rack');

  // 3. Add / Edit Bulk Tank Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingBulkTank, setEditingBulkTank] = useState<OilTank | null>(null);
  const [bulkFormName, setBulkFormName] = useState('');
  const [bulkFormGrade, setBulkFormGrade] = useState('Caltex 20W-50');
  const [bulkFormCapacity, setBulkFormCapacity] = useState<number>(210);
  const [bulkFormLevel, setBulkFormLevel] = useState<number>(100);
  const [bulkFormPrice, setBulkFormPrice] = useState<number>(2450);
  const [bulkFormType, setBulkFormType] = useState<'chamber' | 'drum'>('drum');
  const [bulkFormChamberNo, setBulkFormChamberNo] = useState<number>(1);

  // 4. Refill Forecourt Dispenser Chamber Modal
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillTargetChamberId, setRefillTargetChamberId] = useState('');
  const [refillSourceDrumId, setRefillSourceDrumId] = useState('');
  const [refillLiters, setRefillLiters] = useState<number>(20);

  // Submitting States
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group Oil Tanks into Forecourt 4-Chamber Unit & Back Store 210L Drums
  const forecourtChambers = useMemo(() => {
    const chambers = oilTanks.filter(t => t.type === 'chamber' || t.name.toLowerCase().includes('chamber') || t.id.includes('chamber'));
    if (chambers.length > 0) {
      return [...chambers].sort((a, b) => (a.chamberNumber || 0) - (b.chamberNumber || 0));
    }
    return oilTanks.filter(t => t.type === 'chamber');
  }, [oilTanks]);

  const backStoreDrums = useMemo(() => {
    const drums = oilTanks.filter(t => t.type === 'drum' || t.name.toLowerCase().includes('drum') || t.name.toLowerCase().includes('barrel') || t.id.includes('drum'));
    if (drums.length > 0) return drums;
    return oilTanks.filter(t => t.type !== 'chamber');
  }, [oilTanks]);

  // Refill Modal Helpers
  const selectedTargetChamber = forecourtChambers.find(c => c.id === refillTargetChamberId) || forecourtChambers[0];
  const selectedSourceDrum = backStoreDrums.find(d => d.id === refillSourceDrumId) || backStoreDrums[0];

  const handleOpenRefillModal = (targetChamberId?: string) => {
    const targetId = targetChamberId || forecourtChambers[0]?.id || '';
    setRefillTargetChamberId(targetId);
    const targetChamber = forecourtChambers.find(c => c.id === targetId) || forecourtChambers[0];
    
    if (targetChamber) {
      const matchingDrum = backStoreDrums.find(d => d.grade === targetChamber.grade) || backStoreDrums[0];
      if (matchingDrum) setRefillSourceDrumId(matchingDrum.id);
      const availableSpace = Math.max(0, targetChamber.capacity - targetChamber.currentLevel);
      setRefillLiters(Math.min(20, Math.max(1, availableSpace)));
    } else {
      setRefillSourceDrumId(backStoreDrums[0]?.id || '');
      setRefillLiters(20);
    }
    setIsRefillModalOpen(true);
  };

  const handleSaveRefillSubmit = async () => {
    const targetChamber = forecourtChambers.find(c => c.id === refillTargetChamberId) || forecourtChambers[0];
    const sourceDrum = backStoreDrums.find(d => d.id === refillSourceDrumId) || backStoreDrums[0];

    if (!targetChamber) {
      alert('Please select a valid Forecourt Chamber.');
      return;
    }
    if (!sourceDrum) {
      alert('Please select a valid Back Store Drum.');
      return;
    }
    if (refillLiters <= 0) {
      alert('Refill volume must be greater than 0 liters.');
      return;
    }
    if (sourceDrum.currentLevel < refillLiters) {
      alert(`Insufficient stock in ${sourceDrum.name}. Only ${sourceDrum.currentLevel}L available.`);
      return;
    }

    const spaceInChamber = targetChamber.capacity - targetChamber.currentLevel;
    const actualTransferLiters = Math.min(refillLiters, spaceInChamber, sourceDrum.currentLevel);
    if (actualTransferLiters <= 0) {
      alert('Chamber is already at maximum capacity.');
      return;
    }

    setIsSubmitting(true);
    const updatedTargetChamber: OilTank = {
      ...targetChamber,
      currentLevel: targetChamber.currentLevel + actualTransferLiters
    };

    const updatedSourceDrum: OilTank = {
      ...sourceDrum,
      currentLevel: Math.max(0, sourceDrum.currentLevel - actualTransferLiters)
    };

    const nextTanks = oilTanks.map(t => {
      if (t.id === updatedTargetChamber.id) return updatedTargetChamber;
      if (t.id === updatedSourceDrum.id) return updatedSourceDrum;
      return t;
    });

    setOilTanks(nextTanks);
    
    await Promise.all([
      saveBulkLubricant(updatedTargetChamber),
      saveBulkLubricant(updatedSourceDrum)
    ]);

    setIsSubmitting(false);
    setIsRefillModalOpen(false);
    showToast(`Refilled +${actualTransferLiters}L into ${targetChamber.name.split(':')[0]} (${targetChamber.grade}) from ${sourceDrum.name}`);
  };

  // -------------------------------------------------------------
  // MODAL OPENERS & FORM SUBMISSIONS
  // -------------------------------------------------------------
  const handleOpenSaleModal = () => {
    if (packagedItems.length > 0 && !saleItemId) setSaleItemId(packagedItems[0].id);
    setSaleQty(1);
    setIsSaleModalOpen(true);
  };

  const handleOpenAddItemModal = () => {
    setEditingItem(null);
    setItemFormName('');
    setItemFormGrade('20W-40');
    setItemFormSize('1L Bottle');
    setItemFormStock(0);
    setItemFormMinStock(0);
    setItemFormPrice(0);
    setItemFormLocation('Front Rack');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItemModal = (item: PackagedOilItem) => {
    setEditingItem(item);
    setItemFormName(item.name);
    setItemFormGrade(item.grade);
    setItemFormSize(item.packageSize);
    setItemFormStock(item.currentStock);
    setItemFormMinStock(item.minReorderLevel);
    setItemFormPrice(item.retailPrice);
    setItemFormLocation(item.location || 'Front Rack');
    setIsItemModalOpen(true);
  };

  const handleOpenAddBulkModal = (type: 'chamber' | 'drum' = 'drum') => {
    setEditingBulkTank(null);
    setBulkFormType(type);
    if (type === 'chamber') {
      const nextNo = forecourtChambers.length + 1;
      setBulkFormName(`Chamber 0${nextNo}: Lanka 2T Super`);
      setBulkFormGrade('Lanka 2T Super');
      setBulkFormCapacity(100);
      setBulkFormLevel(50);
      setBulkFormPrice(1850);
      setBulkFormChamberNo(nextNo);
    } else {
      setBulkFormName('Back Store Drum: Caltex 20W-50');
      setBulkFormGrade('Caltex 20W-50');
      setBulkFormCapacity(210);
      setBulkFormLevel(150);
      setBulkFormPrice(2450);
    }
    setIsBulkModalOpen(true);
  };

  const handleOpenEditBulkModal = (tank: OilTank) => {
    setEditingBulkTank(tank);
    setBulkFormName(tank.name);
    setBulkFormGrade(tank.grade);
    setBulkFormCapacity(tank.capacity);
    setBulkFormLevel(tank.currentLevel);
    setBulkFormPrice(tank.pricePerLiter);
    setBulkFormType(tank.type || (tank.name.toLowerCase().includes('chamber') ? 'chamber' : 'drum'));
    setBulkFormChamberNo(tank.chamberNumber || 1);
    setIsBulkModalOpen(true);
  };

  // Submit Retail Sale
  const handleSaveSaleSubmit = async () => {
    const targetItem = packagedItems.find(i => i.id === saleItemId);
    if (!targetItem) {
      alert('Please select an item.');
      return;
    }
    if (saleQty <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }
    if (targetItem.currentStock < saleQty) {
      alert(`Insufficient stock! Available stock is only ${targetItem.currentStock} units.`);
      return;
    }

    setIsSubmitting(true);
    const success = await deductPackagedStock(targetItem.id, saleQty);
    if (success) {
      setPackagedItems(prev => prev.map(i => i.id === targetItem.id ? {
        ...i,
        currentStock: Math.max(0, i.currentStock - saleQty)
      } : i));

      const saleAmount = saleQty * targetItem.retailPrice;
      setIsSaleModalOpen(false);
      showToast(`Sale completed: ${saleQty}x ${targetItem.name} (${formatCurrency(saleAmount)})`);
    } else {
      alert('Failed to deduct stock in database.');
    }
    setIsSubmitting(false);
  };

  // Save Packaged Item (Add or Edit)
  const handleSaveItemSubmit = async () => {
    const trimmedName = itemFormName.trim();
    if (!trimmedName) {
      showToast('⚠️ Please enter a valid Product Name.');
      return;
    }

    const stockVal = Math.max(0, Number(itemFormStock) || 0);
    const minStockVal = Math.max(0, Number(itemFormMinStock) || 0);
    const priceVal = Math.max(0, Number(itemFormPrice) || 0);
    const locationVal = itemFormLocation.trim() || 'Front Rack';
    const gradeVal = itemFormGrade.trim() || 'Standard';
    const sizeVal = itemFormSize.trim() || '1L Bottle';

    setIsSubmitting(true);

    if (editingItem) {
      const updated: PackagedOilItem = {
        ...editingItem,
        name: trimmedName,
        category: editingItem.category || 'Engine Oil',
        grade: gradeVal,
        packageSize: sizeVal,
        currentStock: stockVal,
        minReorderLevel: minStockVal,
        unitCost: editingItem.unitCost || 0,
        retailPrice: priceVal,
        location: locationVal
      };

      // Optimistic update & instant modal close
      setPackagedItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
      setIsItemModalOpen(false);

      try {
        const res = await savePackagedLubricant(updated);
        if (res.success) {
          showToast(`✓ Product "${updated.name}" updated successfully`);
        } else {
          const errMsg = res.error?.message || (typeof res.error === 'string' ? res.error : 'Database synchronization notice');
          showToast(`⚠️ Updated locally. Supabase: ${errMsg}`);
        }
      } catch (err: any) {
        showToast(`⚠️ Updated locally: ${err?.message || 'Database error'}`);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newItem: PackagedOilItem = {
        id: `pkg-${Date.now().toString().slice(-8)}`,
        name: trimmedName,
        category: 'Engine Oil',
        grade: gradeVal,
        packageSize: sizeVal,
        currentStock: stockVal,
        minReorderLevel: minStockVal,
        unitCost: 0,
        retailPrice: priceVal,
        location: locationVal
      };

      // Optimistic update & instant modal close
      setPackagedItems(prev => [newItem, ...prev.filter(i => i.id !== newItem.id)]);
      setIsItemModalOpen(false);

      try {
        const res = await savePackagedLubricant(newItem);
        if (res.success) {
          showToast('✓ Product added successfully to catalog');
        } else {
          const errMsg = res.error?.message || (typeof res.error === 'string' ? res.error : 'Database synchronization notice');
          showToast(`⚠️ Added to catalog locally. Supabase: ${errMsg}`);
        }
      } catch (err: any) {
        showToast(`⚠️ Added to catalog locally: ${err?.message || 'Database error'}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const target = packagedItems.find(i => i.id === itemId);
    if (!target) return;
    if (confirm(`Are you sure you want to delete "${target.name}"?`)) {
      const ok = await deletePackagedLubricant(itemId);
      if (ok) {
        setPackagedItems(prev => prev.filter(i => i.id !== itemId));
        showToast(`Deleted "${target.name}"`);
      } else {
        alert('Failed to delete item from database.');
      }
    }
  };

  // Save Bulk Tank / Drum (Add or Edit)
  const handleSaveBulkSubmit = async () => {
    if (!bulkFormName.trim()) {
      alert('Tank / Drum name is required.');
      return;
    }
    if (bulkFormCapacity <= 0) {
      alert('Capacity must be greater than 0.');
      return;
    }

    setIsSubmitting(true);

    if (editingBulkTank) {
      const updated: OilTank = {
        ...editingBulkTank,
        name: bulkFormName.trim(),
        grade: bulkFormGrade.trim(),
        capacity: Number(bulkFormCapacity) || 100,
        currentLevel: Number(bulkFormLevel) || 0,
        pricePerLiter: Number(bulkFormPrice) || 0,
        type: bulkFormType,
        chamberNumber: bulkFormType === 'chamber' ? Number(bulkFormChamberNo) : undefined
      };

      const res = await saveBulkLubricant(updated);
      if (res.success) {
        setOilTanks(prev => prev.map(t => t.id === editingBulkTank.id ? updated : t));
        setIsBulkModalOpen(false);
        showToast(`Updated bulk tank "${updated.name}"`);
      } else {
        alert('Failed to save bulk tank to database.');
      }
    } else {
      const newTank: OilTank = {
        id: bulkFormType === 'chamber' 
          ? `forecourt-chamber-${Date.now().toString().slice(-6)}`
          : `drum-store-${Date.now().toString().slice(-6)}`,
        name: bulkFormName.trim(),
        grade: bulkFormGrade.trim(),
        capacity: Number(bulkFormCapacity) || 100,
        currentLevel: Number(bulkFormLevel) || 0,
        pricePerLiter: Number(bulkFormPrice) || 0,
        type: bulkFormType,
        chamberNumber: bulkFormType === 'chamber' ? Number(bulkFormChamberNo) : undefined
      };

      const res = await saveBulkLubricant(newTank);
      if (res.success) {
        setOilTanks(prev => [...prev, newTank]);
        setIsBulkModalOpen(false);
        showToast(`Added bulk tank "${newTank.name}"`);
      } else {
        alert('Failed to save bulk tank to database.');
      }
    }

    setIsSubmitting(false);
  };

  const handleDeleteBulkTank = async (tankId: string) => {
    const target = oilTanks.find(t => t.id === tankId);
    if (!target) return;
    if (confirm(`Are you sure you want to delete "${target.name}"?`)) {
      const ok = await deleteBulkLubricant(tankId);
      if (ok) {
        setOilTanks(prev => prev.filter(t => t.id !== tankId));
        showToast(`Deleted "${target.name}"`);
      } else {
        alert('Failed to delete bulk tank from database.');
      }
    }
  };

  // Filtered Packaged Items
  const filteredPackagedItems = useMemo(() => {
    return packagedItems.filter(item => {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query) ||
             item.grade.toLowerCase().includes(query) ||
             (item.location && item.location.toLowerCase().includes(query)) ||
             item.packageSize.toLowerCase().includes(query);
    });
  }, [packagedItems, searchQuery]);

  return (
    <div id="oil-storage-container" className="space-y-5 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1C1C1C] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-scale-up border border-gray-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP PAGE HEADING & REFRESH BAR */}
      {/* ========================================================================= */}
      <div id="oil-storage-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
              Oil & Lubricant Storage
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Supabase Live
            </span>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 font-sans">
            Bulk storage tanks, forecourt chambers, and packaged bottle catalog synced with Supabase
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Database'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TABS NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveSubTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'bulk'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Droplets className="w-4 h-4 text-amber-500" />
          <span>Bulk Oil & Barrels ({oilTanks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('packaged')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'packaged'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Package className="w-4 h-4 text-blue-500" />
          <span>Packaged Bottles Inventory ({packagedItems.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* LOADING STATE INDICATOR */}
      {/* ========================================================================= */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-800">Loading Lubricant Storage from Database...</p>
          <p className="text-xs text-gray-400">Fetching live packaged inventory and bulk storage tanks.</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* VIEW 1: FORECOURT 4-CHAMBER DISPENSER & BACK STORE DRUM STORAGE */}
          {/* ========================================================================= */}
          {activeSubTab === 'bulk' && (
            <div className="space-y-6">
              {/* 1. FORECOURT DISPENSER STATION (CHAMBER UNITS) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <h2 className="text-sm font-extrabold text-[#1C1C1C] uppercase tracking-wide">
                        Forecourt Dispenser Station (Chamber Units)
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                        Forecourt Unit
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                      Live Forecourt bulk dispenser with segregated compartments for vehicle servicing & top-ups
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenAddBulkModal('chamber')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-slate-800 border border-gray-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>Add Dispenser Chamber</span>
                  </button>
                </div>

                {forecourtChambers.length === 0 ? (
                  <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 space-y-2">
                    <Droplets className="w-8 h-8 text-gray-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No Dispenser Chambers Configured</h4>
                    <p className="text-[11px] text-gray-500">Add forecourt compartments to monitor pump dispenser levels.</p>
                    <button
                      onClick={() => handleOpenAddBulkModal('chamber')}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Dispenser Chamber</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {forecourtChambers.map((chamber, idx) => {
                      const chamberNo = chamber.chamberNumber || idx + 1;
                      const capacity = chamber.capacity || 100;
                      const pct = capacity > 0 ? Math.round((chamber.currentLevel / capacity) * 100) : 0;
                      const stockVal = (chamber.currentLevel || 0) * (chamber.pricePerLiter || 0);
                      const isLow = pct < 25;

                      return (
                        <div 
                          key={chamber.id} 
                          className="bg-white rounded-2xl border border-gray-200/80 p-4 space-y-3.5 shadow-sm hover:border-amber-300 transition-all relative overflow-hidden group"
                        >
                          <div className={`absolute top-0 left-0 right-0 h-1.5 ${isLow ? 'bg-rose-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} />

                          <div className="flex items-start justify-between pt-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100/80 text-amber-900 border border-amber-300/50">
                                  Chamber 0{chamberNo}
                                </span>
                              </div>
                              <h3 className="text-sm font-extrabold text-slate-900 mt-1">{chamber.grade}</h3>
                            </div>

                            <div className="flex items-center gap-1">
                              <div className="text-right mr-1">
                                <span className={`text-xs font-black tabular-nums ${isLow ? 'text-rose-600' : pct < 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {pct}%
                                </span>
                                <span className="text-[10px] text-gray-400 block font-medium">Capacity</span>
                              </div>
                              <button
                                onClick={() => handleOpenEditBulkModal(chamber)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                title="Edit Chamber"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Visual Level Meter */}
                          <div className="space-y-1.5">
                            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200/50">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isLow ? 'bg-rose-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-gray-600 font-semibold">
                              <span>Level: <strong className="text-slate-900 tabular-nums">{chamber.currentLevel} L</strong></span>
                              <span>Max: <strong className="text-slate-700 tabular-nums">{capacity} L</strong></span>
                            </div>
                          </div>

                          {/* Price & Value Details */}
                          <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 text-xs space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-500 font-medium">Rate / L:</span>
                              <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(chamber.pricePerLiter)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-gray-200/50">
                              <span className="text-gray-500 font-medium">Stock Value:</span>
                              <span className="font-extrabold text-emerald-700 tabular-nums">{formatCurrency(stockVal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. BACK STORE DRUM / BARREL STORAGE */}
              <div className="space-y-3 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-extrabold text-[#1C1C1C] uppercase tracking-wide">
                        Back Store Drum / Barrel Storage
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                        Wholesale Stock
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                      Bulk wholesale drums received via supplier purchases for forecourt dispenser replenishment
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenAddBulkModal('drum')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-slate-800 border border-gray-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Add Storage Drum</span>
                  </button>
                </div>

                {backStoreDrums.length === 0 ? (
                  <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 space-y-2">
                    <Droplets className="w-8 h-8 text-gray-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No Back Store Drums Configured</h4>
                    <p className="text-[11px] text-gray-500">Receive new wholesale barrels via the Receive Stock (GRN) tab or add a drum.</p>
                    <button
                      onClick={() => handleOpenAddBulkModal('drum')}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Storage Drum</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {backStoreDrums.map((drum) => {
                      const capacity = drum.capacity || 210;
                      const pct = capacity > 0 ? Math.round((drum.currentLevel / capacity) * 100) : 0;
                      const totalStockVal = (drum.currentLevel || 0) * (drum.pricePerLiter || 0);

                      return (
                        <div key={drum.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-xs hover:border-gray-200 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                                  {drum.grade}
                                </span>
                                <h4 className="text-xs font-extrabold text-[#1C1C1C] mt-0.5">{drum.name}</h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <div className="text-right tabular-nums mr-1">
                                <span className={`text-xs font-extrabold ${pct < 25 ? 'text-rose-600' : pct < 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {pct}%
                                </span>
                              </div>
                              <button
                                onClick={() => handleOpenEditBulkModal(drum)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                title="Edit Drum"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBulkTank(drum.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Delete Drum"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Drum Level Bar */}
                          <div className="space-y-1">
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pct < 25 ? 'bg-rose-500' : pct < 50 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                              <span>Stock: <strong className="text-slate-900 tabular-nums">{drum.currentLevel} L</strong></span>
                              <span>Capacity: <strong className="text-slate-700 tabular-nums">{capacity} L</strong></span>
                            </div>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-[11px]">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold block">Rate / L</span>
                              <span className="font-bold text-slate-800 tabular-nums">{formatCurrency(drum.pricePerLiter)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-bold block">Total Stock</span>
                              <span className="font-extrabold text-emerald-700 tabular-nums">{formatCurrency(totalStockVal)}</span>
                            </div>
                          </div>

                          {/* Transfer to Dispenser */}
                          <button
                            type="button"
                            onClick={() => {
                              const matchingChamber = forecourtChambers.find(c => c.grade === drum.grade) || forecourtChambers[0];
                              handleOpenRefillModal(matchingChamber?.id);
                            }}
                            className="w-full py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors border border-gray-200 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Droplets className="w-3.5 h-3.5 text-blue-500" />
                            <span>Transfer to Dispenser</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: PACKAGED BOTTLES INVENTORY */}
          {/* ========================================================================= */}
          {activeSubTab === 'packaged' && (
            <div className="space-y-4">
              {/* Controls: Search and Add Product */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by oil name, grade, location, or pack size..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenSaleModal}
                    disabled={packagedItems.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Quick Sale</span>
                  </button>

                  <button
                    onClick={handleOpenAddItemModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bottle Product</span>
                  </button>
                </div>
              </div>

              {/* Catalog Table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Product Name & Grade</th>
                        <th className="py-3 px-4">Pack Size</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4 text-center">In Stock</th>
                        <th className="py-3 px-4 text-right">Retail Price (Rs.)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-slate-800">
                      {filteredPackagedItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                            <div className="space-y-2">
                              <Package className="w-8 h-8 text-gray-300 mx-auto" />
                              <p className="text-slate-700 font-bold">No lubricant inventory found.</p>
                              <p className="text-xs text-gray-400">Click + Add Bottle Product to get started with your catalog.</p>
                              <button
                                onClick={handleOpenAddItemModal}
                                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add Bottle Product</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredPackagedItems.map((item) => {
                          const isLowStock = item.currentStock <= item.minReorderLevel;

                          return (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5 font-medium">
                                  <span>Grade: {item.grade}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-700">{item.packageSize}</td>
                              <td className="py-3 px-4 font-semibold text-slate-700">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                  {item.location || 'Front Rack'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                                  isLowStock 
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {item.currentStock}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                                {formatCurrency(item.retailPrice)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isLowStock ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3" />
                                    In Stock
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditItemModal(item)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Product"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Product"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: QUICK RETAIL SALE */}
      {/* ========================================================================= */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <span>Quick Retail Oil Sale</span>
              </h3>
              <button 
                onClick={() => setIsSaleModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Product</label>
                <select
                  value={saleItemId}
                  onChange={(e) => setSaleItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {packagedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.packageSize}) - {formatCurrency(item.retailPrice)} (Stock: {item.currentStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={saleQty}
                    onChange={(e) => setSaleQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Payment Method</label>
                  <select
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card / POS</option>
                    <option value="Credit">Credit Customer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Customer / Vehicle No</label>
                <input
                  type="text"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. WP-CA-8891 / Walk-in"
                />
              </div>

              {/* Total Calculation */}
              {(() => {
                const item = packagedItems.find(i => i.id === saleItemId);
                const total = item ? saleQty * item.retailPrice : 0;
                return (
                  <div className="p-3 bg-emerald-50 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-900">Total Sale Amount:</span>
                    <strong className="text-emerald-900 tabular-nums text-base">
                      {formatCurrency(total)}
                    </strong>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setIsSaleModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSaveSaleSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Processing...' : 'Complete Sale & Deduct'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD / EDIT PACKAGED ITEM */}
      {/* ========================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>{editingItem ? 'Edit Product Item' : 'Add Bottle Product'}</span>
              </h3>
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 1. Product Name */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">Product Name</label>
                <input
                  type="text"
                  value={itemFormName}
                  onChange={(e) => setItemFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. Caltex Havoline Super 4T 20W-40"
                />
              </div>

              {/* 2. Grade / Spec & 3. Pack Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Grade / Spec</label>
                  <input
                    type="text"
                    value={itemFormGrade}
                    onChange={(e) => setItemFormGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. 20W-40 / DOT 4"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Pack Size</label>
                  <input
                    type="text"
                    value={itemFormSize}
                    onChange={(e) => setItemFormSize(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. 1L Bottle, 500ml, 4L Can"
                  />
                </div>
              </div>

              {/* 4. Location & 5. Initial Stock Qty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Location</label>
                  <input
                    type="text"
                    value={itemFormLocation}
                    onChange={(e) => setItemFormLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="Front Rack"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">
                    {editingItem ? 'Current Stock (Units)' : 'Initial Stock Qty'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormStock}
                    onChange={(e) => setItemFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 6. Retail Selling Price & 7. Min Reorder Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Retail Selling Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormPrice}
                    onChange={(e) => setItemFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormMinStock}
                    onChange={(e) => setItemFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setIsItemModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSaveItemSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Catalog'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD / EDIT BULK TANK / DRUM */}
      {/* ========================================================================= */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Droplets className="w-5 h-5 text-amber-600" />
                <span>{editingBulkTank ? 'Edit Bulk Tank / Drum' : `Add Bulk ${bulkFormType === 'chamber' ? 'Chamber' : 'Drum'}`}</span>
              </h3>
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Tank / Drum Name</label>
                <input
                  type="text"
                  value={bulkFormName}
                  onChange={(e) => setBulkFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. Back Store Drum - Caltex 20W-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Storage Type</label>
                  <select
                    value={bulkFormType}
                    onChange={(e) => setBulkFormType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                  >
                    <option value="chamber">Forecourt Chamber</option>
                    <option value="drum">Back Store Drum (210L)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Oil Grade</label>
                  <input
                    type="text"
                    value={bulkFormGrade}
                    onChange={(e) => setBulkFormGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. Caltex 20W-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Capacity (Liters)</label>
                  <input
                    type="number"
                    value={bulkFormCapacity}
                    onChange={(e) => setBulkFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Current Level (Liters)</label>
                  <input
                    type="number"
                    value={bulkFormLevel}
                    onChange={(e) => setBulkFormLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Price Per Liter (Rs.)</label>
                  <input
                    type="number"
                    value={bulkFormPrice}
                    onChange={(e) => setBulkFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>

                {bulkFormType === 'chamber' && (
                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Chamber Number</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={bulkFormChamberNo}
                      onChange={(e) => setBulkFormChamberNo(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleSaveBulkSubmit}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Saving...' : editingBulkTank ? 'Save Changes' : 'Add Tank'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REFILL FORECOURT DISPENSER CHAMBER */}
      {/* ========================================================================= */}
      {isRefillModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Droplets className="w-5 h-5 text-amber-500" />
                <span>Refill Dispenser Chamber</span>
              </h3>
              <button 
                onClick={() => setIsRefillModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Target Forecourt Chamber</label>
                <select
                  value={refillTargetChamberId}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    setRefillTargetChamberId(targetId);
                    const targetChamber = forecourtChambers.find(c => c.id === targetId);
                    if (targetChamber) {
                      const matchingDrum = backStoreDrums.find(d => d.grade === targetChamber.grade);
                      if (matchingDrum) setRefillSourceDrumId(matchingDrum.id);
                      const availableSpace = Math.max(0, targetChamber.capacity - targetChamber.currentLevel);
                      setRefillLiters(Math.min(20, Math.max(1, availableSpace)));
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {forecourtChambers.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} (Current: {ch.currentLevel} / {ch.capacity} L)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Source Back Store Drum</label>
                <select
                  value={refillSourceDrumId}
                  onChange={(e) => setRefillSourceDrumId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {backStoreDrums.map(drum => (
                    <option key={drum.id} value={drum.id}>
                      {drum.name} ({drum.grade}) - Avail: {drum.currentLevel} L
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-700">Refill Volume (Liters)</label>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Available Space: {selectedTargetChamber ? Math.max(0, selectedTargetChamber.capacity - selectedTargetChamber.currentLevel) : 0} L
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={selectedTargetChamber ? selectedTargetChamber.capacity - selectedTargetChamber.currentLevel : 100}
                  value={refillLiters}
                  onChange={(e) => setRefillLiters(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                />
              </div>

              {/* Quick fill buttons */}
              <div className="flex gap-1.5 pt-0.5">
                {[10, 20, 30].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRefillLiters(amt)}
                    className="flex-1 py-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    +{amt}L
                  </button>
                ))}
                {selectedTargetChamber && (
                  <button
                    type="button"
                    onClick={() => setRefillLiters(Math.max(1, selectedTargetChamber.capacity - selectedTargetChamber.currentLevel))}
                    className="flex-1 py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px] transition-colors border border-amber-200 cursor-pointer"
                  >
                    Fill to {selectedTargetChamber.capacity}L
                  </button>
                )}
              </div>

              {/* Live Preview Summary */}
              {selectedTargetChamber && selectedSourceDrum && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5 text-xs text-amber-950">
                  <div className="flex justify-between font-medium">
                    <span>Target Chamber ({selectedTargetChamber.name.split(':')[0]}):</span>
                    <span className="font-bold tabular-nums">
                      {selectedTargetChamber.currentLevel} L &rarr; <span className="text-emerald-700 font-extrabold">{Math.min(selectedTargetChamber.capacity, selectedTargetChamber.currentLevel + refillLiters)} L</span> / {selectedTargetChamber.capacity} L
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Source Drum Stock:</span>
                    <span className="font-bold tabular-nums">
                      {selectedSourceDrum.currentLevel} L &rarr; <span className="text-rose-700 font-extrabold">{Math.max(0, selectedSourceDrum.currentLevel - refillLiters)} L</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsRefillModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveRefillSubmit}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Refilling...' : 'Confirm Refill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
