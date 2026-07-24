/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Calendar, ShieldCheck, AlertTriangle, Truck, 
  DollarSign, RefreshCcw, Info, Fuel, X, CheckCircle2, Trash2
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
}

export default function FuelStockTab({
  tanks,
  setTanks,
  pumps,
  setPumps,
  deliveries,
  setDeliveries,
}: FuelStockTabProps) {

  // Delivery Modal State
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedTankId, setSelectedTankId] = useState<string>('');
  const [deliveryFuelType, setDeliveryFuelType] = useState<FuelType>('Petrol 92');
  const [deliveryQty, setDeliveryQty] = useState<number>(5000);
  const [deliverySupplier, setDeliverySupplier] = useState('Lanka IOC PLC');
  const [deliveryCost, setDeliveryCost] = useState<number>(6500);
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

  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(val) + ' L';
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  // Handle adding delivery
  const handleAddDeliverySubmit = () => {
    if (deliveryQty <= 0) {
      setModalError('Delivery quantity must be a positive number.');
      return;
    }
    
    // Find selected target tank
    const targetTank = tanks.find(t => t.id === selectedTankId) || tanks.find(t => t.fuelType === deliveryFuelType) || tanks[0];
    if (!targetTank) {
      setModalError('Please select a target storage tank.');
      return;
    }

    const freeSpace = targetTank.capacity - targetTank.currentLevel;
    if (deliveryQty > freeSpace) {
      setModalError(`Delivery volume (${deliveryQty.toLocaleString()} L) exceeds target tank free space (${freeSpace.toFixed(1)} L) for ${targetTank.name}! Max volume you can add is ${freeSpace.toFixed(1)} L.`);
      return;
    }

    // Update target tank current level
    const updatedTanks = tanks.map(t => {
      if (t.id === targetTank.id) {
        return {
          ...t,
          currentLevel: Math.min(t.capacity, t.currentLevel + deliveryQty)
        };
      }
      return t;
    });

    setTanks(updatedTanks);

    // Create delivery record with target tank details
    const newDelivery: StockDelivery = {
      id: `del-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      fuelType: targetTank.fuelType,
      tankId: targetTank.id,
      tankName: targetTank.name,
      quantity: deliveryQty,
      supplier: deliverySupplier || 'Lanka IOC PLC',
      cost: deliveryCost
    };

    setDeliveries([newDelivery, ...deliveries]);
    setIsDeliveryModalOpen(false);
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
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            Underground Stock Control
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Real-time liquid levels in underground storage tanks linked with pricing boards
          </p>
        </div>

                <button
          id="btn-trigger-delivery"
          onClick={() => {
            setModalError(null);
            setIsDeliveryModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
        >
          <Truck className="w-4 h-4" />
          <span>Log Supplier Delivery</span>
        </button>
      </div>

      {/* Tank Gauges Grid (Beautiful visual representations of tanks!) */}
      <div id="tanks-visual-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tanks.map((tank) => {
          const fillPercent = Math.round((tank.currentLevel / tank.capacity) * 100);
          const isLowStock = fillPercent < 40;
          const isCritical = fillPercent < 15;

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
              className={`glass-panel rounded-2xl p-5 shadow-sm transition-all duration-300 ${borderHoverColor} flex flex-col justify-between`}
            >
              <div>
                {/* Tank Metadata */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] tabular-nums font-semibold text-gray-500 font-bold tracking-wider uppercase block">{tank.id}</span>
                    <h3 className="font-bold text-[#1C1C1C] text-base mt-0.5">{tank.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCritical ? (
                      <span className="inline-flex px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-extrabold uppercase animate-pulse">Critical</span>
                    ) : isLowStock ? (
                      <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase">Low Stock</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase">Secure</span>
                    )}
                  </div>
                </div>

                {/* VISUAL LIQUID GAUGE (Simulated underground tank cylindrical view) */}
                <div className="my-6 relative w-full h-40 bg-gray-100 border border-gray-100 rounded-2xl overflow-hidden flex items-end justify-center group shadow-inner">
                  {/* Grid Lines inside tank */}
                  <div className="absolute inset-x-0 top-1/4 border-t border-gray-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-2/4 border-t border-gray-100 pointer-events-none" />
                  <div className="absolute inset-x-0 top-3/4 border-t border-gray-100 pointer-events-none" />
                  
                  {/* Liquid Fill Level with animation */}
                  <div 
                    className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${liquidWaveColor} transition-all duration-1000 ease-out overflow-hidden`}
                    style={{ height: `${fillPercent}%` }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 animate-pulse"></div>
                    <svg className="absolute -top-1 w-full h-4 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10">
                       <path d="M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z" fill="currentColor" className="text-white">
                         <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z; M0,5 Q25,10 50,5 T100,5 L100,10 L0,10 Z; M0,5 Q25,0 50,5 T100,5 L100,10 L0,10 Z"/>
                       </path>
                    </svg>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                  </div>

                  {/* Centered Volume Overlay */}
                  <div className="z-10 text-center select-none p-4 bg-gray-50/95 backdrop-blur-md rounded-xl shadow-md border border-gray-200 mb-4 transition-transform duration-300 group-hover:scale-105">
                    <span className="text-xl tabular-nums font-extrabold text-[#1C1C1C] block">{fillPercent}%</span>
                    <span className="text-[10px] text-gray-500 font-sans font-medium">{formatLiters(tank.currentLevel)}</span>
                  </div>
                </div>

                {/* Connected Pumps list */}
                {(() => {
                  const linkedPumps = (pumps || []).filter(p => p.tankId === tank.id || (!p.tankId && p.fuelType === tank.fuelType));
                  return (
                    <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-100 py-2">
                      <span>Mapped Pumps:</span>
                      <span className="font-bold text-blue-600 text-right truncate max-w-[180px]" title={linkedPumps.map(p => `${p.name} (${p.fuelType})`).join(', ')}>
                        {linkedPumps.length > 0 ? linkedPumps.map(p => p.name).join(', ') : 'None'}
                      </span>
                    </div>
                  );
                })()}

                {/* Capacity stats */}
                <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-100 py-2">
                  <span>Tank Capacity:</span>
                  <span className="tabular-nums font-semibold text-[#1C1C1C]">{formatLiters(tank.capacity)}</span>
                </div>
              </div>

              {/* Dynamic Price Controller Section */}
              <div className="mt-4 pt-1 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 block font-bold uppercase tracking-wider">Unit Price</span>
                  {editingTankId === tank.id ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(parseFloat(e.target.value) || 0)}
                        className="w-16 px-1.5 py-0.5 border border-blue-500 bg-white text-[#1C1C1C] rounded-md tabular-nums font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                      />
                    </div>
                  ) : (
                    <span className="tabular-nums font-extrabold text-lg text-[#1C1C1C] mt-0.5 block">
                      {formatCurrency(tank.pricePerLiter)} <span className="text-[10px] text-gray-500 font-sans font-medium">/ L</span>
                    </span>
                  )}
                </div>

                <div>
                  {editingTankId === tank.id ? (
                    <button
                      onClick={() => handleSavePrice(tank.id)}
                      className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartEditPrice(tank)}
                      className="text-xs text-blue-600 hover:text-blue-300 hover:underline font-bold cursor-pointer"
                    >
                      Edit Board Price
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deliveries & Instructions Block */}
      <div id="stock-lower-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Deliveries History List */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div>
            <h3 className="font-bold text-[#1C1C1C] text-base">Wholesale Deliveries History</h3>
            <p className="text-xs text-gray-500 mt-0.5">Audit log of recent fuel supply shipments received</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="pb-3">Delivery ID</th>
                  <th className="pb-3">Target Tank</th>
                  <th className="pb-3">Fuel Type</th>
                  <th className="pb-3 text-right">Volume</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3 text-right">Wholesale Cost</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 tabular-nums font-bold text-blue-600">{del.id}</td>
                    <td className="py-3.5 font-bold text-[#1C1C1C]">
                      {del.tankName || tanks.find(t => t.id === del.tankId)?.name || del.fuelType}
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        del.fuelType.includes('Petrol') 
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {del.fuelType}
                      </span>
                    </td>
                    <td className="py-3.5 text-right tabular-nums font-semibold text-gray-600">{formatLiters(del.quantity)}</td>
                    <td className="py-3.5 text-gray-600 font-medium">{del.supplier}</td>
                    <td className="py-3.5 text-right tabular-nums font-bold text-[#1C1C1C]">{formatCurrency(del.cost)}</td>
                    <td className="py-3.5 text-gray-500">{new Date(del.date).toLocaleDateString()}</td>
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => handleDeleteDelivery(del.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Delete Delivery Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informative instructions / leakage control */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#1C1C1C] text-base">Leakage & Evaporation Audit</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              FuelFlow maintains automatic telemetry constraints. Every time an active shift is officially closed on the Shift Management page, the physical fuel sales (Net Sold) are immediately deducted from these underground tank values.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500 mt-4 space-y-2">
            <div className="flex gap-2">
              <span className="font-bold text-blue-600">Tip:</span>
              <span>Keep board prices updated in accordance with governmental tariff adjustments to maximize margins instantly.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold text-emerald-400">Automated:</span>
              <span>All sales computations globally reference these dynamic prices in real-time.</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- SUPPLIER STOCK DELIVERY LOG MODAL --- */}
      {isDeliveryModalOpen && (
        <div id="delivery-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="delivery-modal-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg">Log Wholesale Stock Delivery</h3>
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
                  <span>Select Target Storage Tank</span>
                  <span className="text-blue-600 text-[11px] font-bold">Required</span>
                </label>
                <select
                  value={selectedTankId || (tanks[0]?.id || '')}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setSelectedTankId(tId);
                    const tank = tanks.find(t => t.id === tId);
                    if (tank) setDeliveryFuelType(tank.fuelType);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm font-semibold focus:outline-none focus:border-blue-500"
                >
                  {tanks.map((t) => {
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
                  Delivered Fuel Volume (Liters)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Supplier name */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Supplier
                </label>
                <input
                  type="text"
                  value={deliverySupplier}
                  onChange={(e) => setDeliverySupplier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Wholesale cost */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Wholesale Cost (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
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
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Accept Delivery & Fill
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
