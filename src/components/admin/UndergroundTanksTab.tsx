import React, { useState, useMemo } from 'react';
import { 
  Database, Plus, Trash2, Edit2, AlertTriangle, X, Gauge 
} from 'lucide-react';
import { FuelTank, FuelType, Pump, AuthUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { saveFuelTank } from '../../lib/supabaseClient';
import { isAdmin } from '../../lib/auth';

interface UndergroundTanksTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  pumps?: Pump[];
  setPumps?: React.Dispatch<React.SetStateAction<Pump[]>>;
  showToast?: (msg: string) => void;
  formatCurrency?: (val: number) => string;
  user?: AuthUser | null;
  userRole?: string;
}

export default function UndergroundTanksTab({
  tanks,
  setTanks,
  pumps = [],
  setPumps,
  showToast,
  formatCurrency: propFormatCurrency,
  user,
  userRole
}: UndergroundTanksTabProps) {
  // Currency Formatter fallback
  const formatCurrency = (val: number) => {
    if (propFormatCurrency) return propFormatCurrency(val);
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  // Natural numerical sorting of tanks
  const sortedTanks = useMemo(() => {
    return [...tanks].sort((a, b) => 
      (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [tanks]);

  // Can Delete check: System Admins, Admins, Dev mode, or default admin access
  const canDelete = useMemo(() => {
    const role = user?.role || userRole;
    return isAdmin(role) || !role || import.meta.env.DEV;
  }, [user?.role, userRole]);

  // Modal State for Add / Edit Tank
  const [isAddTankModalOpen, setIsAddTankModalOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);
  const [tankFormName, setTankFormName] = useState('');
  const [tankFormFuelType, setTankFormFuelType] = useState<FuelType>('Petrol 92');
  const [tankFormCapacity, setTankFormCapacity] = useState<number>(15000);
  const [tankModalError, setTankModalError] = useState<string | null>(null);

  const handleOpenAddTankModal = () => {
    setEditingTank(null);
    setTankFormName('');
    setTankFormFuelType('Petrol 92');
    setTankFormCapacity(15000);
    setTankModalError(null);
    setIsAddTankModalOpen(true);
  };

  const handleOpenEditTankModal = (tank: FuelTank) => {
    setEditingTank(tank);
    setTankFormName(tank.name);
    setTankFormFuelType(tank.fuelType);
    setTankFormCapacity(tank.capacity);
    setTankModalError(null);
    setIsAddTankModalOpen(true);
  };

  const handleSaveTankSubmit = async () => {
    if (!tankFormName.trim()) {
      setTankModalError('Tank name is required (e.g. Tank 01 - Petrol 92).');
      return;
    }
    if (tankFormCapacity <= 0) {
      setTankModalError('Tank capacity must be greater than 0 liters.');
      return;
    }

    const capVal = Number(tankFormCapacity) || 0;

    if (editingTank) {
      const updatedTank: FuelTank = {
        ...editingTank,
        name: tankFormName.trim(),
        fuelType: tankFormFuelType,
        capacity: capVal,
        currentLevel: Math.min(editingTank.currentLevel, capVal),
        pricePerLiter: editingTank.pricePerLiter || 0
      };

      setTanks(prev => prev.map(t => t.id === editingTank.id ? updatedTank : t));
      try { 
        const next = tanks.map(t => t.id === editingTank.id ? updatedTank : t);
        localStorage.setItem('fms_tanks', JSON.stringify(next)); 
      } catch (_) {}

      await saveFuelTank(supabase, updatedTank);
      setIsAddTankModalOpen(false);
      showToast?.(`Underground Tank "${updatedTank.name}" updated successfully.`);
    } else {
      const newTank: FuelTank = {
        id: `tank-${Date.now().toString().slice(-6)}`,
        name: tankFormName.trim(),
        fuelType: tankFormFuelType,
        capacity: capVal,
        currentLevel: 0,
        pricePerLiter: 0
      };

      setTanks(prev => [...prev, newTank]);
      try { 
        const next = [...tanks, newTank];
        localStorage.setItem('fms_tanks', JSON.stringify(next)); 
      } catch (_) {}

      await saveFuelTank(supabase, newTank);
      setIsAddTankModalOpen(false);
      showToast?.(`Underground Tank "${newTank.name}" created successfully.`);
    }
  };

  /**
   * Robust Supabase Delete Execution with Cascading Safeguard
   */
  const handleDeleteTank = async (tankId: string, tankName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${tankName}?`)) return;

    // Check if any nozzles are mapped to this tank and unmap them locally/in DB if needed
    const mappedNozzles = pumps.filter(p => p.tankId === tankId);
    if (mappedNozzles.length > 0 && setPumps) {
      setPumps(prev => prev.map(p => p.tankId === tankId ? { ...p, tankId: undefined } : p));
      try {
        await supabase.from('pumps').update({ tank_id: null, tankid: null }).eq('tank_id', tankId);
      } catch (_) {}
    }

    // Delete the tank directly from Supabase
    let { error } = await supabase
      .from('underground_tanks')
      .delete()
      .eq('id', tankId);

    // If 'underground_tanks' table does not exist or has alternate name in schema, try 'fuel_tanks'
    if (error && (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('not found'))) {
      const fallbackRes = await supabase
        .from('fuel_tanks')
        .delete()
        .eq('id', tankId);
      
      if (!fallbackRes.error) {
        error = null;
      }
    }

    if (error) {
      console.error("Tank delete error:", error);
      alert(`Cannot delete ${tankName}: ${error.message}`);
    } else {
      // Instantly update UI state
      setTanks(prev => prev.filter(t => t.id !== tankId));
      try {
        const next = tanks.filter(t => t.id !== tankId);
        localStorage.setItem('fms_tanks', JSON.stringify(next));
      } catch (_) {}
      showToast?.(`Storage Tank "${tankName}" deleted.`);
    }
  };

  const getFuelTypeBadgeStyle = (fuelType: string) => {
    if (fuelType.includes('92')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    if (fuelType.includes('95')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    if (fuelType.includes('Super Diesel')) return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
    if (fuelType.includes('Auto Diesel')) return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    if (fuelType.includes('Ordinary') || fuelType.includes('LAD')) return 'bg-teal-500/10 text-teal-700 border-teal-500/20';
    return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleOpenAddTankModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Storage Tank</span>
        </button>
      </div>

      {/* Tanks Grid */}
      {tanks.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Database className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1C1C1C]">No Underground Storage Tanks Configured</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Click '+ Add Storage Tank' to create your first storage tank (e.g. LAD Tank, New 92 Tank).
            </p>
          </div>
          <button
            onClick={handleOpenAddTankModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Storage Tank</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedTanks.map((tank) => {
            const pct = tank.capacity > 0 ? Math.round((tank.currentLevel / tank.capacity) * 100) : 0;
            const mappedPumpsList = pumps.filter(p => p.tankId === tank.id || (!p.tankId && p.fuelType === tank.fuelType));

            return (
              <div key={tank.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 shadow-sm hover:border-gray-200 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getFuelTypeBadgeStyle(tank.fuelType)}`}>
                        {tank.fuelType}
                      </span>
                      <h3 className="text-sm font-extrabold text-[#1C1C1C] leading-snug mt-0.5">{tank.name}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenEditTankModal(tank);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer z-30"
                      title="Edit Tank"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteTank(tank.id, tank.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer z-30"
                        title="Delete Tank"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Level Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500">Current Fill Volume</span>
                    <span className={`tabular-nums ${pct < 20 ? 'text-rose-600 font-extrabold' : 'text-[#1C1C1C]'}`}>
                      {pct}% ({tank.currentLevel.toLocaleString()} L)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct < 20 ? 'bg-rose-500' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>

                {/* Details Matrix */}
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-gray-100 pt-2">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <span className="text-gray-400 font-semibold block text-[9px] uppercase">Total Capacity</span>
                    <span className="text-[#1C1C1C] font-bold tabular-nums text-xs">{tank.capacity.toLocaleString()} L</span>
                  </div>

                  <div className="bg-gray-50 p-2 rounded-lg">
                    <span className="text-gray-400 font-semibold block text-[9px] uppercase">Price / Liter</span>
                    <span className="text-blue-600 font-bold tabular-nums text-xs">{formatCurrency(tank.pricePerLiter)}</span>
                  </div>
                </div>

                {/* Connected Pumps Badge */}
                <div className="flex items-center justify-between text-xs text-gray-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                  <span className="font-medium text-gray-600 flex items-center gap-1.5 text-[11px]">
                    <Gauge className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mapped Nozzles ({mappedPumpsList.length}):</span>
                  </span>
                  <span className="font-bold text-blue-700 truncate max-w-[160px] text-xs">
                    {mappedPumpsList.length > 0 ? mappedPumpsList.map(p => p.name).join(', ') : 'None'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Tank */}
      {isAddTankModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <span>{editingTank ? 'Edit Underground Storage Tank' : 'Add Underground Storage Tank'}</span>
              </h3>
              <button 
                onClick={() => setIsAddTankModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {tankModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{tankModalError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Tank Name / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. Tank 01 - Petrol 92"
                  value={tankFormName}
                  onChange={(e) => setTankFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Fuel Grade Type</label>
                <select
                  value={tankFormFuelType}
                  onChange={(e) => setTankFormFuelType(e.target.value as FuelType)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Petrol 92">Petrol 92</option>
                  <option value="Petrol 95">Petrol 95</option>
                  <option value="Auto Diesel">Auto Diesel</option>
                  <option value="Super Diesel">Super Diesel</option>
                  <option value="Lanka Ordinary Diesel">Lanka Ordinary Diesel</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Max Capacity (L)</label>
                <input
                  type="number"
                  value={tankFormCapacity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTankFormCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 tabular-nums font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAddTankModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTankSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {editingTank ? 'Update Tank' : 'Save Tank'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
