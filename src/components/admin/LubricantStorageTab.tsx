/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Droplets, Plus, Trash2, Edit2, AlertTriangle, X
} from 'lucide-react';
import { OilTank, AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { saveBulkLubricant, deleteBulkLubricant } from '../../lib/lubricantsClient';
import { isAdmin } from '../../lib/auth';

interface LubricantStorageTabProps {
  oilTanks: OilTank[];
  setOilTanks: React.Dispatch<React.SetStateAction<OilTank[]>> | ((tanks: OilTank[]) => void);
  showToast: (msg: string) => void;
  formatCurrency?: (val: number) => string;
  user?: AuthUser | null;
  userRole?: string;
}

export default function LubricantStorageTab({
  oilTanks,
  setOilTanks,
  showToast,
  formatCurrency: propFormatCurrency,
  user,
  userRole
}: LubricantStorageTabProps) {
  // Currency Formatter fallback (Sri Lankan Rupees)
  const formatCurrency = (val: number) => {
    if (propFormatCurrency) return propFormatCurrency(val);
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Grade badge styling helper
  const getOilGradeBadgeStyle = (grade: string) => {
    const g = (grade || '').toLowerCase();
    if (g.includes('20w') || g.includes('15w') || g.includes('engine')) return 'bg-amber-500/10 text-amber-800 border-amber-500/20';
    if (g.includes('2t') || g.includes('two stroke')) return 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20';
    if (g.includes('hydraulic') || g.includes('68')) return 'bg-blue-500/10 text-blue-800 border-blue-500/20';
    if (g.includes('coolant') || g.includes('radiator')) return 'bg-cyan-500/10 text-cyan-800 border-cyan-500/20';
    if (g.includes('gear') || g.includes('90') || g.includes('140')) return 'bg-purple-500/10 text-purple-800 border-purple-500/20';
    if (g.includes('brake') || g.includes('dot')) return 'bg-rose-500/10 text-rose-800 border-rose-500/20';
    return 'bg-slate-500/10 text-slate-800 border-slate-500/20';
  };

  // Filter and sort Forecourt Dispenser Chambers only
  const dispenserChambers = useMemo(() => {
    const seen = new Set<string>();
    const chambers: OilTank[] = [];
    for (const t of oilTanks) {
      if (!t || !t.id) continue;
      if (seen.has(t.id)) continue;
      // Filter out back store wholesale drums
      if (t.type === 'drum' || t.name.toLowerCase().includes('drum') || t.name.toLowerCase().includes('barrel')) {
        continue;
      }
      seen.add(t.id);
      chambers.push(t);
    }
    return chambers.sort((a, b) => {
      const numA = a.chamberNumber || parseInt((a.name || '').replace(/\D/g, ''), 10) || 0;
      const numB = b.chamberNumber || parseInt((b.name || '').replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.name || a.id).localeCompare(b.name || b.id, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [oilTanks]);

  // Modal State for Adding / Editing Dispenser Chamber
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChamber, setEditingChamber] = useState<OilTank | null>(null);

  // Form Fields
  const [chamberNumber, setChamberNumber] = useState<number>(1);
  const [chamberName, setChamberName] = useState('');
  const [chamberGrade, setChamberGrade] = useState('Lanka 2T Super');
  const [chamberCapacity, setChamberCapacity] = useState<number>(100);
  const [chamberCurrentLevel, setChamberCurrentLevel] = useState<number>(0);
  const [chamberPrice, setChamberPrice] = useState<number>(0);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setEditingChamber(null);
    const nextChamberNo = dispenserChambers.length + 1;
    setChamberNumber(nextChamberNo);
    setChamberName(`Chamber 0${nextChamberNo}`);
    setChamberGrade('Lanka 2T Super');
    setChamberCapacity(100);
    setChamberCurrentLevel(0);
    setChamberPrice(0);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (chamber: OilTank) => {
    setEditingChamber(chamber);
    const num = chamber.chamberNumber || parseInt(chamber.name.replace(/\D/g, ''), 10) || 1;
    setChamberNumber(num);
    setChamberName(chamber.name);
    setChamberGrade(chamber.grade);
    setChamberCapacity(chamber.capacity);
    setChamberCurrentLevel(chamber.currentLevel);
    setChamberPrice(chamber.pricePerLiter);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async () => {
    if (!chamberName.trim()) {
      setModalError('Chamber name / identifier is required (e.g. Chamber 01).');
      return;
    }
    if (!chamberGrade.trim()) {
      setModalError('Oil grade / product name is required (e.g. Lanka 2T Super).');
      return;
    }
    if (chamberCapacity <= 0) {
      setModalError('Capacity must be greater than 0 liters.');
      return;
    }
    if (chamberCurrentLevel < 0) {
      setModalError('Current volume cannot be negative.');
      return;
    }
    if (chamberPrice < 0) {
      setModalError('Price per liter cannot be negative.');
      return;
    }

    const capVal = Number(chamberCapacity) || 0;
    const curVal = Math.min(Number(chamberCurrentLevel) || 0, capVal);
    const priceVal = Number(chamberPrice) || 0;
    const numVal = Number(chamberNumber) || 1;

    if (editingChamber) {
      const updatedChamber: OilTank = {
        ...editingChamber,
        name: chamberName.trim(),
        grade: chamberGrade.trim(),
        capacity: capVal,
        currentLevel: curVal,
        pricePerLiter: priceVal,
        type: 'chamber',
        chamberNumber: numVal
      };

      const nextTanks = oilTanks.map(t => t.id === editingChamber.id ? updatedChamber : t);
      if (typeof setOilTanks === 'function') {
        setOilTanks(nextTanks as any);
      }

      await saveBulkLubricant(updatedChamber);
      setIsModalOpen(false);
      showToast(`Dispenser Chamber "${updatedChamber.name}" updated successfully.`);
    } else {
      const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const newChamber: OilTank = {
        id: `forecourt-chamber-${uniqueSuffix}`,
        name: chamberName.trim(),
        grade: chamberGrade.trim(),
        capacity: capVal,
        currentLevel: curVal,
        pricePerLiter: priceVal,
        type: 'chamber',
        chamberNumber: numVal
      };

      const nextTanks = [...oilTanks.filter(t => t.id !== newChamber.id), newChamber];
      if (typeof setOilTanks === 'function') {
        setOilTanks(nextTanks as any);
      }

      await saveBulkLubricant(newChamber);
      setIsModalOpen(false);
      showToast(`Dispenser Chamber "${newChamber.name}" created in database.`);
    }
  };

  const handleDeleteChamber = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${name || 'this chamber'}?`);
    if (!confirmed) return;

    // 1. Try deleting from 'lubricant_chambers' or fallback 'forecourt_chambers' / 'bulk_lubricants' / 'oil_tanks'
    let { error } = await supabase
      .from('lubricant_chambers')
      .delete()
      .eq('id', id);

    if (error && (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('not found'))) {
      const res2 = await supabase.from('bulk_lubricants').delete().eq('id', id);
      if (!res2.error) {
        error = null;
      } else if (res2.error && (res2.error.code === '42P01' || res2.error.message?.includes('does not exist'))) {
        const res3 = await supabase.from('oil_tanks').delete().eq('id', id);
        if (!res3.error) error = null;
      }
    }

    try {
      await deleteBulkLubricant(id);
    } catch (_) {}

    if (error) {
      console.error("Chamber Delete Error:", error);
      alert("Error deleting chamber: " + error.message);
    } else {
      // 2. Instantly update UI State
      const nextTanks = oilTanks.filter(c => c.id !== id);
      if (typeof setOilTanks === 'function') {
        setOilTanks(nextTanks as any);
      }
      try {
        localStorage.setItem('fms_oil_tanks', JSON.stringify(nextTanks));
      } catch (_) {}
      showToast(`Deleted "${name || 'Chamber'}" from database.`);
    }
  };

  return (
    <div id="lubricant-storage-tab-root" className="space-y-6 animate-fade-in font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-[#1C1C1C]">Bulk Oil & Lubricants Configuration</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
              {dispenserChambers.length} {dispenserChambers.length === 1 ? 'Chamber' : 'Chambers'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage Forecourt Dispenser Chambers (Chamber 01, Chamber 02, etc.) for direct vehicle servicing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>+ Add Dispenser Chamber</span>
          </button>
        </div>
      </div>

      {/* Forecourt Dispenser Chambers Grid */}
      {dispenserChambers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Droplets className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1C1C1C]">No Forecourt Dispenser Chambers Configured</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Add Forecourt Dispenser Chambers (50L/100L) to establish your station's bulk lubricant dispensing infrastructure.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Droplets className="w-4 h-4" />
              <span>+ Add Dispenser Chamber</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dispenserChambers.map((chamber, idx) => {
            const chamberNo = chamber.chamberNumber || idx + 1;
            const pct = chamber.capacity > 0 ? Math.round((chamber.currentLevel / chamber.capacity) * 100) : 0;
            const totalStockVal = (chamber.currentLevel || 0) * (chamber.pricePerLiter || 0);

            return (
              <div 
                key={chamber.id} 
                className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3.5 shadow-sm hover:border-amber-200 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold bg-amber-50 text-amber-600 border border-amber-200/60">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border bg-amber-50 text-amber-800 border-amber-200">
                          Chamber 0{chamberNo}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${getOilGradeBadgeStyle(chamber.grade)}`}>
                          {chamber.grade}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[#1C1C1C] leading-snug mt-1">{chamber.name}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenEditModal(chamber);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer z-30"
                      title="Edit Configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin(user?.role || userRole) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteChamber(chamber.id, chamber.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer z-30"
                        title="Delete Dispenser Chamber"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Current Volume Level</span>
                    <div className="flex items-center gap-1.5 tabular-nums">
                      <span className={`text-xs font-extrabold ${pct < 20 ? 'text-rose-600' : pct < 40 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {pct}%
                      </span>
                      <span className="text-gray-400 font-medium">({(chamber.currentLevel || 0).toLocaleString()} L)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct < 20 ? 'bg-rose-500' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                    <span>Current: <strong className="text-gray-900 tabular-nums">{(chamber.currentLevel || 0).toLocaleString()} L</strong></span>
                    <span>Capacity: <strong className="text-gray-900 tabular-nums">{(chamber.capacity || 0).toLocaleString()} L</strong></span>
                  </div>
                </div>

                {/* Rates & Stock Valuation Footer */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100/80">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Rate / Liter</span>
                    <span className="font-bold text-slate-900 tabular-nums text-xs">
                      {formatCurrency(chamber.pricePerLiter || 0)}
                    </span>
                  </div>
                  <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100/80 text-right">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Total Stock Value</span>
                    <span className="font-bold text-emerald-700 tabular-nums text-xs">
                      {formatCurrency(totalStockVal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT FORECOURT DISPENSER CHAMBER */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold bg-amber-100 text-amber-700">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1C1C1C]">
                    {editingChamber ? 'Edit Dispenser Chamber' : 'Add Forecourt Dispenser Chamber'}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Forecourt 4-Chamber Dispenser Unit
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="font-bold text-gray-600 block mb-1">Chamber #</label>
                  <select
                    value={chamberNumber}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setChamberNumber(num);
                      setChamberName(`Chamber 0${num}`);
                    }}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>Chamber 0{n}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="font-bold text-gray-600 block mb-1">Display Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. Chamber 01"
                    value={chamberName}
                    onChange={(e) => setChamberName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Oil Grade / Lubricant Product</label>
                <input
                  type="text"
                  placeholder="e.g. Lanka 2T Super, Caltex 20W-50, 20W-40"
                  value={chamberGrade}
                  onChange={(e) => setChamberGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] font-bold"
                />
                {/* Quick Grade Presets */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'Lanka 2T Super',
                    '20W-40',
                    'Caltex 20W-50',
                    'Hydraulic 68',
                    'Engine Oil 15W-40',
                    'Gear Oil EP 90'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setChamberGrade(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        chamberGrade === preset
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-gray-600">Total Capacity (L)</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setChamberCapacity(50)}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                          chamberCapacity === 50 ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        50L
                      </button>
                      <button
                        type="button"
                        onClick={() => setChamberCapacity(100)}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                          chamberCapacity === 100 ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        100L
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={chamberCapacity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setChamberCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] tabular-nums font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Current Volume (L)</label>
                  <input
                    type="number"
                    value={chamberCurrentLevel}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setChamberCurrentLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] tabular-nums font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Price / Tariff Rate (Rs. per Liter)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rs.</span>
                  <input
                    type="number"
                    step="any"
                    value={chamberPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setChamberPrice(Number(e.target.value))}
                    className="w-full pl-10 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] tabular-nums font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubmit}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {editingChamber ? 'Update Chamber' : 'Save Chamber'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
