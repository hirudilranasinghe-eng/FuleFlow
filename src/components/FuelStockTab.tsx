/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, Calendar, ShieldCheck, AlertTriangle, Truck, 
  DollarSign, RefreshCcw, Info, Fuel, X, CheckCircle2, Trash2,
  ShoppingBag, ShoppingCart, Database
} from 'lucide-react';
import { FuelTank, StockDelivery, FuelType, Pump } from '../types';
import { supabase, getTanksTableName } from '../lib/supabase';

interface FuelStockTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  pumps?: Pump[];
  setPumps?: React.Dispatch<React.SetStateAction<Pump[]>>;
  deliveries: StockDelivery[];
  setDeliveries: React.Dispatch<React.SetStateAction<StockDelivery[]>>;
  onNavigateToAdminTanks?: () => void;
  setActiveTab?: (tab: string, subTab?: string) => void;
}

export default function FuelStockTab({
  tanks,
  setTanks,
  pumps,
  setPumps,
  deliveries,
  setDeliveries,
  onNavigateToAdminTanks,
  setActiveTab,
}: FuelStockTabProps) {

  // Delivery Modal State
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedTankId, setSelectedTankId] = useState<string>('');
  const [deliveryFuelType, setDeliveryFuelType] = useState<FuelType>('Petrol 92');
  const [deliveryQty, setDeliveryQty] = useState<number | ''>('');
  const [deliverySupplier, setDeliverySupplier] = useState('Ceylon Petroleum Corporation');
  const [deliveryInvoiceNo, setDeliveryInvoiceNo] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [modalError, setModalError] = useState<string | null>(null);

  // Price Edit State
  const [isAddTankModalOpen, setIsAddTankModalOpen] = useState(false);
  const [newTankName, setNewTankName] = useState('');
  const [newTankFuelType, setNewTankFuelType] = useState<FuelType>('Petrol 92');
  const [newTankCapacity, setNewTankCapacity] = useState<number>(10000);
  const [newTankCurrentLevel, setNewTankCurrentLevel] = useState<number>(0);
  const [addTankError, setAddTankError] = useState<string | null>(null);

  const handleAddTankSubmit = async () => {
    if (!newTankName) {
      setAddTankError('Tank name is required.');
      return;
    }
    if (newTankCurrentLevel > newTankCapacity) {
      setAddTankError('Current volume cannot exceed tank capacity.');
      return;
    }

    const newTankId = `tank-${Date.now()}`;
    const newTank: FuelTank = {
      id: newTankId,
      name: newTankName,
      fuelType: newTankFuelType,
      capacity: newTankCapacity,
      currentLevel: newTankCurrentLevel,
      pricePerLiter: 0
    };
    
    const dbPayload = {
      id: newTank.id,
      name: newTank.name,
      fueltype: newTank.fuelType,
      capacity: newTank.capacity,
      currentlevel: newTank.currentLevel,
      priceperliter: newTank.pricePerLiter
    };

    try {
      const { data, error } = await supabase.from(getTanksTableName()).insert([dbPayload]).select();
      if (error) {
        if (
          error.message?.toLowerCase().includes('row-level security') ||
          error.message?.toLowerCase().includes('policy') ||
          error.code === '42501'
        ) {
          console.warn("Supabase RLS active. Saving tank locally.");
        } else {
          throw error;
        }
      }

      setTanks([...tanks, newTank]);
      setIsAddTankModalOpen(false);
      setNewTankName('');
      setNewTankCapacity(10000);
      setNewTankCurrentLevel(0);
      setAddTankError(null);
    } catch (err: any) {
      console.error("Supabase Insert Error:", err.message || err);
      setAddTankError(err.message || 'Failed to add tank. Please check console for details.');
    }
  };
  const [editingTankId, setEditingTankId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  // Compute total volume summary
  const totalVolume = tanks.reduce((acc, t) => acc + t.currentLevel, 0);
  const totalCapacity = tanks.reduce((acc, t) => acc + t.capacity, 0);

  // Natural numerical sorting of tanks (Tank 01, Tank 02, etc.)
  const sortedTanks = useMemo(() => {
    return [...tanks].sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [tanks]);

  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(val) + ' L';
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  // Handle adding delivery
  const handleAddDeliverySubmit = async () => {
    const numQty = typeof deliveryQty === 'number' ? deliveryQty : parseFloat(deliveryQty) || 0;
    if (numQty <= 0) {
      setModalError('Delivery volume must be a positive number.');
      return;
    }
    
    // Find selected target tank
    const targetTank = tanks.find(t => t.id === selectedTankId) || tanks.find(t => t.fuelType === deliveryFuelType) || tanks[0];
    if (!targetTank) {
      setModalError('Please select a target storage tank.');
      return;
    }

    const freeSpace = targetTank.capacity - targetTank.currentLevel;
    if (numQty > freeSpace) {
      setModalError(`Delivery volume (${numQty.toLocaleString()} L) exceeds target tank free space (${freeSpace.toFixed(1)} L) for ${targetTank.name}! Max volume you can add is ${freeSpace.toFixed(1)} L.`);
      return;
    }

    const updatedLevel = Math.min(targetTank.capacity, targetTank.currentLevel + numQty);

    // Update target tank current level locally
    const updatedTanks = tanks.map(t => {
      if (t.id === targetTank.id) {
        return {
          ...t,
          currentLevel: updatedLevel
        };
      }
      return t;
    });

    setTanks(updatedTanks);

    const autoCost = Math.round(numQty * (targetTank.pricePerLiter || 0));
    const deliveryId = deliveryInvoiceNo.trim() || `DEL-${Date.now().toString().slice(-6)}`;
    const deliveryIsoDate = deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString();
    const supplierName = deliverySupplier.trim() || 'Ceylon Petroleum Corporation';

    // Create delivery record with target tank details locally
    const newDelivery: StockDelivery = {
      id: deliveryId,
      date: deliveryIsoDate,
      fuelType: targetTank.fuelType,
      tankId: targetTank.id,
      tankName: targetTank.name,
      quantity: numQty,
      supplier: supplierName,
      cost: autoCost
    };

    setDeliveries([newDelivery, ...deliveries]);

    // Persist changes directly to Supabase tables
    try {
      // 1. Save purchase row to stock_deliveries strictly with valid columns (cost omitted)
      const deliveryPayload = {
        id: deliveryId,
        date: deliveryIsoDate,
        fueltype: targetTank.fuelType,
        quantity: numQty,
        supplier: supplierName
      };

      const { data, error } = await supabase.from('stock_deliveries').upsert([deliveryPayload]).select();
      if (error) {
        console.error('Purchase Save Error:', error);
      } else {
        console.log('Purchase Saved:', data);
      }

      // 2. Auto-increment tank level in fuel_tanks table in Supabase
      const tankPayload = {
        id: targetTank.id,
        name: targetTank.name,
        fueltype: targetTank.fuelType,
        capacity: targetTank.capacity,
        currentlevel: updatedLevel,
        priceperliter: targetTank.pricePerLiter
      };

      const { error: tankErr } = await supabase.from(getTanksTableName()).upsert([tankPayload]);
      if (tankErr) {
        console.warn("Supabase fuel_tanks level auto-increment notice:", tankErr.message || tankErr);
      }
    } catch (err: any) {
      console.error("Supabase purchase persistence error:", err?.message || err);
    }

    setIsDeliveryModalOpen(false);
    setDeliveryQty('');
    setDeliveryInvoiceNo('');
    setDeliverySupplier('Ceylon Petroleum Corporation');
    setModalError(null);
  };

  // Start pricing edit
  const handleStartEditPrice = (tank: FuelTank) => {
    setEditingTankId(tank.id);
    setTempPrice(tank.pricePerLiter);
  };

  // Save modified price per liter
  const handleSavePrice = (tankId: string) => {
    if (tempPrice <= 0) return;
    const updated = tanks.map(t => {
      if (t.id === tankId) {
        return {
          ...t,
          pricePerLiter: tempPrice
        };
      }
      return t;
    });
    setTanks(updated);
    setEditingTankId(null);
  };

  const handleDeleteTank = async (tankId: string) => {
    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return;
    if (confirm(`Are you sure you want to delete tank "${tank.name}" (${tank.fuelType})?`)) {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          const tableName = getTanksTableName();
          const { error } = await supabase.from(tableName).delete().eq('id', tankId);
          if (error) console.warn("Supabase tank delete error:", error.message);
        } catch (err) {
          console.warn("Tank delete error:", err);
        }
      }
      const updated = tanks.filter(t => t.id !== tankId);
      setTanks(updated);
      localStorage.setItem('fms_tanks', JSON.stringify(updated));
    }
  };

  const handleDeleteDelivery = async (delId: string) => {
    if (confirm("Are you sure you want to delete this delivery entry?")) {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          const { error } = await supabase.from('stock_deliveries').delete().eq('id', delId);
          if (error) console.warn("Supabase delivery delete error:", error.message);
        } catch (err) {
          console.warn("Delivery delete error:", err);
        }
      }
      const updated = deliveries.filter(d => d.id !== delId);
      setDeliveries(updated);
      localStorage.setItem('fms_deliveries', JSON.stringify(updated));
    }
  };

  return (
    <div id="fuel-stock-root" className="space-y-4">
      {/* Tab Title Block */}
      <div id="stock-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
            Underground Stock Control
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Real-time liquid levels in underground storage tanks linked with pricing boards
          </p>
        </div>
      </div>

      {/* Tank Gauges Grid (Beautiful visual representations of tanks or clean empty state) */}
      {sortedTanks.length === 0 ? (
        <div id="no-tanks-empty-card" className="p-8 sm:p-12 text-center rounded-2xl bg-white border border-gray-200/90 shadow-2xs">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Database className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#1C1C1C] mb-1.5 font-sans">
            No Underground Fuel Tanks Found
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed font-sans">
            No underground fuel tanks found. Go to Admin Control → Underground Tanks to configure station tanks.
          </p>
          {(onNavigateToAdminTanks || setActiveTab) && (
            <button
              onClick={() => {
                if (onNavigateToAdminTanks) {
                  onNavigateToAdminTanks();
                } else if (setActiveTab) {
                  setActiveTab('admin', 'tanks');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1C] hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>Go to Admin Control → Underground Tanks</span>
            </button>
          )}
        </div>
      ) : (
        <div id="tanks-visual-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedTanks.map((tank) => {
            const fillPercent = Math.round((tank.currentLevel / tank.capacity) * 100);
            const isLowStock = fillPercent < 40;
            const isCritical = fillPercent < 15;

            const getFuelTypeBadgeStyle = (fuelType: string) => {
              if (fuelType.includes('92')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
              if (fuelType.includes('95')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
              if (fuelType.includes('Super Diesel')) return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
              if (fuelType.includes('Auto Diesel')) return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
              if (fuelType.includes('Ordinary') || fuelType.includes('LAD')) return 'bg-teal-500/10 text-teal-700 border-teal-500/20';
              return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
            };

            // Determine color profiles based on fuel level state
            let progressColor = 'bg-[#00BFFF]';
            let borderHoverColor = 'hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(0,123,255,0.15)]';
            let liquidWaveColor = 'from-blue-600/80 to-cyan-500/90';

            if (tank.fuelType.includes('Diesel')) {
              progressColor = 'bg-amber-500';
              borderHoverColor = 'hover:border-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]';
              liquidWaveColor = 'from-amber-600/80 to-amber-500/90';
            }
            if (isLowStock) {
              progressColor = 'bg-orange-500';
              liquidWaveColor = 'from-orange-500/80 to-orange-400/90';
            }
            if (isCritical) {
              progressColor = 'bg-red-500';
              liquidWaveColor = 'from-red-600/80 to-red-500/90';
            }

            return (
              <div 
                key={tank.id} 
                className={`glass-panel rounded-2xl p-4 shadow-sm transition-all duration-300 ${borderHoverColor} flex flex-col justify-between`}
              >
                <div>
                  {/* Tank Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getFuelTypeBadgeStyle(tank.fuelType)} mb-0.5`}>
                          {tank.fuelType}
                        </span>
                        <h3 className="font-bold text-[#1C1C1C] text-sm leading-tight">{tank.name}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isCritical ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-extrabold uppercase animate-pulse">Critical</span>
                      ) : isLowStock ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase">Low Stock</span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase">Secure</span>
                      )}
                    </div>
                  </div>

                  {/* VISUAL LIQUID GAUGE (Simulated underground tank cylindrical view) */}
                  <div className="my-3 relative w-full h-24 bg-gray-100 border border-gray-100 rounded-xl overflow-hidden flex items-end justify-center group shadow-inner">
                    {/* Grid Lines inside tank */}
                    <div className="absolute inset-x-0 top-1/4 border-t border-gray-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/4 border-t border-gray-100 pointer-events-none" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-gray-100 pointer-events-none" />
                    
                    {/* Liquid Fill Level with animation */}
                    <div 
                      className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${liquidWaveColor} transition-all duration-1000 ease-out overflow-hidden`}
                      style={{ height: `${fillPercent}%` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-3 bg-white/20 animate-pulse"></div>
                      <svg className="absolute -top-1 w-full h-3 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10">
                         <path d="M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z" fill="currentColor" className="text-white">
                           <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z; M0,5 Q25,10 50,5 T100,5 L100,10 L0,10 Z; M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z"/>
                         </path>
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                    </div>

                    {/* Centered Volume Overlay */}
                    <div className="z-10 text-center select-none px-3 py-1.5 bg-gray-50/95 backdrop-blur-md rounded-lg shadow-sm border border-gray-200 mb-2 transition-transform duration-300 group-hover:scale-105">
                      <span className="text-base tabular-nums font-extrabold text-[#1C1C1C] block leading-tight">{fillPercent}%</span>
                      <span className="text-[10px] text-gray-500 font-medium">{formatLiters(tank.currentLevel)}</span>
                    </div>
                  </div>

                  {/* Connected Pumps list */}
                  {(() => {
                    const linkedPumps = (pumps || []).filter(p => p.tankId === tank.id || (!p.tankId && p.fuelType === tank.fuelType));
                    return (
                      <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-100 py-1.5">
                        <span>Mapped Pumps:</span>
                        <span className="font-bold text-blue-600 text-right truncate max-w-[160px]" title={linkedPumps.map(p => `${p.name} (${p.fuelType})`).join(', ')}>
                          {linkedPumps.length > 0 ? linkedPumps.map(p => p.name).join(', ') : 'None'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Capacity stats */}
                  <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-100 py-1.5">
                    <span>Tank Capacity:</span>
                    <span className="tabular-nums font-semibold text-[#1C1C1C]">{formatLiters(tank.capacity)}</span>
                  </div>
                </div>

                {/* Dynamic Price Controller Section */}
                <div className="mt-2 pt-2 flex items-center justify-between border-t border-gray-100">
                  <div>
                    <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Unit Price</span>
                    <span className="tabular-nums font-extrabold text-base text-[#1C1C1C] block leading-tight">
                      {formatCurrency(tank.pricePerLiter)} <span className="text-[10px] text-gray-500 font-sans font-medium">/ L</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deliveries History moved to Reports Tab */}

      {/* --- SUPPLIER STOCK PURCHASE MODAL --- */}
      {isDeliveryModalOpen && (
        <div id="delivery-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="delivery-modal-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <span>New Fuel Purchase</span>
              </h3>
              <button onClick={() => setIsDeliveryModalOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs flex items-start gap-2 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Target Storage Tank Selector */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Target Storage Tank</span>
                  <span className="text-blue-600 text-[11px] font-bold">Required</span>
                </label>
                <select
                  id="purchase-target-tank"
                  value={selectedTankId || (sortedTanks[0]?.id || '')}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setSelectedTankId(tId);
                    const tank = sortedTanks.find(t => t.id === tId);
                    if (tank) setDeliveryFuelType(tank.fuelType);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {sortedTanks.map((t) => {
                    const freeSpace = Math.max(0, t.capacity - t.currentLevel);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.fuelType}) — Free Space: {formatLiters(freeSpace)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Volume Quantity to add */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Delivery Volume (Liters)
                </label>
                <input
                  id="purchase-delivery-qty"
                  type="number"
                  step="0.01"
                  value={deliveryQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDeliveryQty(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Supplier name */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Supplier Name
                </label>
                <input
                  id="purchase-supplier-name"
                  type="text"
                  value={deliverySupplier}
                  onChange={(e) => setDeliverySupplier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Ceylon Petroleum Corporation"
                />
              </div>

              {/* Invoice Number */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Invoice / Ref Number
                </label>
                <input
                  id="purchase-invoice-no"
                  type="text"
                  value={deliveryInvoiceNo}
                  onChange={(e) => setDeliveryInvoiceNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. INV-2026-8891"
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Delivery Date
                </label>
                <input
                  id="purchase-delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeliveryModalOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDeliverySubmit}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                Confirm Purchase & Receive Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD NEW TANK MODAL --- */}
      {isAddTankModalOpen && (
        <div id="add-tank-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="add-tank-modal-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg">Add New Underground Tank</h3>
              <button onClick={() => setIsAddTankModalOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {addTankError && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs flex items-start gap-2 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{addTankError}</span>
                </div>
              )}
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Tank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tank 3 - Petrol 95"
                  value={newTankName}
                  onChange={(e) => setNewTankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Fuel Type
                </label>
                <select
                  value={newTankFuelType}
                  onChange={(e) => setNewTankFuelType(e.target.value as FuelType)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="Petrol 92">Octane 92</option>
                  <option value="Petrol 95">Octane 95</option>
                  <option value="Auto Diesel">Auto Diesel</option>
                  <option value="Super Diesel">Super Diesel</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Tank Capacity (Liters)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newTankCapacity || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewTankCapacity(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Initial Current Volume (Liters)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newTankCurrentLevel || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewTankCurrentLevel(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAddTankModalOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTankSubmit}
                className="px-5 py-2 bg-[#1C1C1C] text-white font-bold text-xs rounded-lg hover:bg-gray-800 transition-all cursor-pointer shadow-md"
              >
                + Add Tank
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
