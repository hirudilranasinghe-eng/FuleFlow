/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, Fuel, Users, Sliders, Plus, Trash2, 
  CheckCircle2, AlertTriangle, Database, Copy, Check,
  Landmark, Edit2, Search, Phone, X, RefreshCcw,
  Layers, Info, Tag, Calendar, Clock, Save, Gauge
} from 'lucide-react';
import { Employee, FuelTank, FuelType, Pump, PriceSchedule } from '../types';
import { supabase, getTanksTableName } from '../lib/supabase';
import { SUPABASE_SQL } from '../lib/sqlSchema';

interface AdminControlTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  pumps: Pump[];
  setPumps: React.Dispatch<React.SetStateAction<Pump[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  priceSchedules?: PriceSchedule[];
  setPriceSchedules?: React.Dispatch<React.SetStateAction<PriceSchedule[]>>;
  onResetAllData: () => void;
}

export default function AdminControlTab({
  tanks,
  setTanks,
  pumps,
  setPumps,
  employees,
  setEmployees,
  priceSchedules = [],
  setPriceSchedules,
  onResetAllData
}: AdminControlTabProps) {
  // Active sub-tab inside Admin Control: 'tanks' | 'mapping' | 'employees' | 'price' | 'system'
  const [adminSection, setAdminSection] = useState<'tanks' | 'mapping' | 'employees' | 'price' | 'system'>('tanks');

  // Global Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  // -------------------------------------------------------------
  // A) UNDERGROUND TANKS MANAGEMENT (Add, Edit, Delete)
  // -------------------------------------------------------------
  const [isAddTankModalOpen, setIsAddTankModalOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);

  // Form fields for Tank Add/Edit
  const [tankFormName, setTankFormName] = useState('');
  const [tankFormFuelType, setTankFormFuelType] = useState<FuelType>('Petrol 92');
  const [tankFormCapacity, setTankFormCapacity] = useState<number>(15000);
  const [tankFormCurrentLevel, setTankFormCurrentLevel] = useState<number>(10000);
  const [tankFormPrice, setTankFormPrice] = useState<number>(355);
  const [tankModalError, setTankModalError] = useState<string | null>(null);

  const handleOpenAddTankModal = () => {
    setEditingTank(null);
    setTankFormName('');
    setTankFormFuelType('Petrol 92');
    setTankFormCapacity(15000);
    setTankFormCurrentLevel(10000);
    setTankFormPrice(355);
    setTankModalError(null);
    setIsAddTankModalOpen(true);
  };

  const handleOpenEditTankModal = (tank: FuelTank) => {
    setEditingTank(tank);
    setTankFormName(tank.name);
    setTankFormFuelType(tank.fuelType);
    setTankFormCapacity(tank.capacity);
    setTankFormCurrentLevel(tank.currentLevel);
    setTankFormPrice(tank.pricePerLiter);
    setTankModalError(null);
    setIsAddTankModalOpen(true);
  };

  const handleSaveTankSubmit = async () => {
    if (!tankFormName.trim()) {
      setTankModalError('Tank name is required.');
      return;
    }
    if (tankFormCapacity <= 0) {
      setTankModalError('Tank capacity must be greater than 0 liters.');
      return;
    }
    if (tankFormCurrentLevel < 0 || tankFormCurrentLevel > tankFormCapacity) {
      setTankModalError(`Current level must be between 0 and total capacity (${tankFormCapacity.toLocaleString()} L).`);
      return;
    }

    if (editingTank) {
      // Update existing tank
      const updatedTank: FuelTank = {
        ...editingTank,
        name: tankFormName.trim(),
        fuelType: tankFormFuelType,
        capacity: tankFormCapacity,
        currentLevel: tankFormCurrentLevel,
        pricePerLiter: tankFormPrice > 0 ? tankFormPrice : 350
      };

      setTanks(prev => prev.map(t => t.id === editingTank.id ? updatedTank : t));

      try {
        const tableName = getTanksTableName();
        await supabase.from(tableName).upsert({
          id: updatedTank.id,
          name: updatedTank.name,
          fueltype: updatedTank.fuelType,
          capacity: updatedTank.capacity,
          currentlevel: updatedTank.currentLevel,
          priceperliter: updatedTank.pricePerLiter
        });
      } catch (err: any) {
        console.warn("Error updating tank in Supabase:", err);
      }

      setIsAddTankModalOpen(false);
      showToast(`Underground Tank "${updatedTank.name}" updated successfully.`);
    } else {
      // Create new tank
      const newTank: FuelTank = {
        id: `tank-${Date.now().toString().slice(-6)}`,
        name: tankFormName.trim(),
        fuelType: tankFormFuelType,
        capacity: tankFormCapacity,
        currentLevel: tankFormCurrentLevel,
        pricePerLiter: tankFormPrice > 0 ? tankFormPrice : 350
      };

      setTanks(prev => [...prev, newTank]);

      try {
        const tableName = getTanksTableName();
        await supabase.from(tableName).insert([{
          id: newTank.id,
          name: newTank.name,
          fueltype: newTank.fuelType,
          capacity: newTank.capacity,
          currentlevel: newTank.currentLevel,
          priceperliter: newTank.pricePerLiter
        }]);
      } catch (err: any) {
        console.warn("Error inserting tank into Supabase:", err);
      }

      setIsAddTankModalOpen(false);
      showToast(`Underground Tank "${newTank.name}" created successfully.`);
    }
  };

  const handleDeleteTank = async (tankId: string) => {
    const targetTank = tanks.find(t => t.id === tankId);
    if (!targetTank) return;

    const mappedPumps = pumps.filter(p => p.tankId === tankId);
    if (mappedPumps.length > 0) {
      if (!confirm(`Warning: ${mappedPumps.length} pump(s) (${mappedPumps.map(p => p.name).join(', ')}) are currently mapped to this tank. Deleting it will unmap those pumps. Continue?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete "${targetTank.name}"? This action cannot be undone.`)) {
        return;
      }
    }

    try {
      const tableName = getTanksTableName();
      await supabase.from(tableName).delete().eq('id', tankId);
    } catch (err) {
      console.warn("Supabase delete tank error:", err);
    }

    setTanks(prev => prev.filter(t => t.id !== tankId));
    showToast(`Storage Tank "${targetTank.name}" deleted.`);
  };

  // -------------------------------------------------------------
  // B) PUMP-TO-TANK MAPPING & PUMP MANAGEMENT (Add, Edit, Save, Delete)
  // -------------------------------------------------------------
  const [selectedPumpTankMap, setSelectedPumpTankMap] = useState<Record<string, string>>({});
  const [isAddPumpModalOpen, setIsAddPumpModalOpen] = useState(false);
  const [editingPump, setEditingPump] = useState<Pump | null>(null);

  // Form fields for Pump
  const [pumpFormName, setPumpFormName] = useState('');
  const [pumpFormFuelType, setPumpFormFuelType] = useState<FuelType>('Petrol 92');
  const [pumpFormTankId, setPumpFormTankId] = useState('');
  const [pumpFormStatus, setPumpFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [pumpModalError, setPumpModalError] = useState<string | null>(null);

  const handleOpenAddPumpModal = () => {
    setEditingPump(null);
    setPumpFormName('');
    const firstTank = tanks[0];
    setPumpFormFuelType(firstTank?.fuelType || 'Petrol 92');
    setPumpFormTankId(firstTank?.id || '');
    setPumpFormStatus('Active');
    setPumpModalError(null);
    setIsAddPumpModalOpen(true);
  };

  const handleOpenEditPumpModal = (pump: Pump) => {
    setEditingPump(pump);
    setPumpFormName(pump.name);
    setPumpFormFuelType(pump.fuelType);
    setPumpFormTankId(pump.tankId || '');
    setPumpFormStatus(pump.status);
    setPumpModalError(null);
    setIsAddPumpModalOpen(true);
  };

  const handleSavePumpSubmit = async () => {
    if (!pumpFormName.trim()) {
      setPumpModalError('Pump name / identifier is required.');
      return;
    }

    const selectedTank = tanks.find(t => t.id === pumpFormTankId);
    const resolvedFuelType = selectedTank ? selectedTank.fuelType : pumpFormFuelType;

    if (editingPump) {
      // Edit Pump
      const updatedPump: Pump = {
        ...editingPump,
        name: pumpFormName.trim(),
        fuelType: resolvedFuelType,
        tankId: pumpFormTankId || undefined,
        status: pumpFormStatus
      };

      try {
        const payload: any = {
          id: updatedPump.id,
          name: updatedPump.name,
          fueltype: updatedPump.fuelType,
          status: updatedPump.status
        };
        if (updatedPump.tankId) payload.tankid = updatedPump.tankId;

        let { error } = await supabase.from('pumps').upsert(payload);
        
        if (error && (error.message?.includes('tankid') || error.code === '42703' || error.message?.includes('schema cache'))) {
          console.warn("pumps table missing 'tankid' column in Supabase schema cache. Retrying upsert without tankid.");
          delete payload.tankid;
          const retry = await supabase.from('pumps').upsert(payload);
          error = retry.error;
        }

        if (error) console.warn("Supabase edit pump error:", error);

        const { data: latestPumps } = await supabase.from('pumps').select('*');
        if (latestPumps) {
          const mapped = latestPumps.map(p => ({
            id: p.id,
            name: p.name,
            fuelType: p.fueltype,
            tankId: p.tankid || undefined,
            status: p.status
          }));
          setPumps(mapped as Pump[]);
          localStorage.setItem('fms_pumps', JSON.stringify(mapped));
        } else {
          const next = pumps.map(p => p.id === editingPump.id ? updatedPump : p);
          setPumps(next);
          localStorage.setItem('fms_pumps', JSON.stringify(next));
        }

        setIsAddPumpModalOpen(false);
        showToast(`Pump "${updatedPump.name}" updated successfully.`);
      } catch (err) {
        console.warn("Supabase edit pump error:", err);
        const next = pumps.map(p => p.id === editingPump.id ? updatedPump : p);
        setPumps(next);
        localStorage.setItem('fms_pumps', JSON.stringify(next));
        setIsAddPumpModalOpen(false);
        showToast(`Pump "${updatedPump.name}" updated locally.`);
      }
    } else {
      // Add Pump
      const newPump: Pump = {
        id: `p-${Date.now().toString().slice(-4)}`,
        name: pumpFormName.trim(),
        fuelType: resolvedFuelType,
        status: pumpFormStatus,
        tankId: pumpFormTankId || undefined
      };

      try {
        const payload: any = {
          id: newPump.id,
          name: newPump.name,
          fueltype: newPump.fuelType,
          status: newPump.status
        };
        if (newPump.tankId) payload.tankid = newPump.tankId;

        let { error } = await supabase.from('pumps').insert([payload]);

        if (error && (error.message?.includes('tankid') || error.code === '42703' || error.message?.includes('schema cache'))) {
          console.warn("pumps table missing 'tankid' column in Supabase schema cache. Retrying insert without tankid.");
          delete payload.tankid;
          const retry = await supabase.from('pumps').insert([payload]);
          error = retry.error;
        }

        if (error) console.warn("Supabase insert pump error:", error);

        const { data: latestPumps } = await supabase.from('pumps').select('*');
        if (latestPumps) {
          const mapped = latestPumps.map(p => ({
            id: p.id,
            name: p.name,
            fuelType: p.fueltype,
            tankId: p.tankid || undefined,
            status: p.status
          }));
          setPumps(mapped as Pump[]);
          localStorage.setItem('fms_pumps', JSON.stringify(mapped));
        } else {
          const next = [...pumps, newPump];
          setPumps(next);
          localStorage.setItem('fms_pumps', JSON.stringify(next));
        }

        setIsAddPumpModalOpen(false);
        showToast(`New Pump "${newPump.name}" added successfully.`);
      } catch (err) {
        console.warn("Supabase add pump error:", err);
        const next = [...pumps, newPump];
        setPumps(next);
        localStorage.setItem('fms_pumps', JSON.stringify(next));
        setIsAddPumpModalOpen(false);
        showToast(`New Pump "${newPump.name}" added locally.`);
      }
    }
  };

  const handleSaveSinglePumpMapping = async (pumpId: string) => {
    const targetTankId = selectedPumpTankMap[pumpId] || pumps.find(p => p.id === pumpId)?.tankId || tanks[0]?.id;
    if (!targetTankId) return;

    const targetTank = tanks.find(t => t.id === targetTankId);
    if (!targetTank) return;

    const pumpToUpdate = pumps.find(p => p.id === pumpId);
    if (!pumpToUpdate) return;

    const updatedPump: Pump = {
      ...pumpToUpdate,
      tankId: targetTank.id,
      fuelType: targetTank.fuelType
    };

    try {
      const payload: any = {
        id: updatedPump.id,
        name: updatedPump.name,
        fueltype: updatedPump.fuelType,
        status: updatedPump.status
      };
      if (updatedPump.tankId) payload.tankid = updatedPump.tankId;

      let { error } = await supabase.from('pumps').upsert(payload);

      if (error && (error.message?.includes('tankid') || error.code === '42703' || error.message?.includes('schema cache'))) {
        console.warn("pumps table missing 'tankid' column in Supabase schema cache. Retrying upsert without tankid.");
        delete payload.tankid;
        const retry = await supabase.from('pumps').upsert(payload);
        error = retry.error;
      }

      if (error) console.warn("Supabase pump mapping error:", error);

      const nextPumps = pumps.map(p => p.id === pumpId ? updatedPump : p);
      setPumps(nextPumps);
      localStorage.setItem('fms_pumps', JSON.stringify(nextPumps));

      showToast(`Saved! ${updatedPump.name} mapped to ${targetTank.name} (${targetTank.fuelType}).`);
    } catch (err) {
      console.warn("Supabase pump mapping save error:", err);
      const nextPumps = pumps.map(p => p.id === pumpId ? updatedPump : p);
      setPumps(nextPumps);
      localStorage.setItem('fms_pumps', JSON.stringify(nextPumps));
      showToast(`Saved locally! ${updatedPump.name} mapped to ${targetTank.name}.`);
    }
  };

  const handleDeletePump = async (pumpId: string) => {
    const pump = pumps.find(p => p.id === pumpId);
    if (!pump) return;

    if (confirm(`Are you sure you want to delete "${pump.name}" (${pump.id})?`)) {
      try {
        const { error } = await supabase.from('pumps').delete().eq('id', pumpId);
        if (error) console.warn("Supabase delete pump error:", error);

        const nextPumps = pumps.filter(p => p.id !== pumpId);
        setPumps(nextPumps);
        localStorage.setItem('fms_pumps', JSON.stringify(nextPumps));

        showToast(`Pump "${pump.name}" permanently deleted.`);
      } catch (err) {
        console.warn("Supabase delete pump error:", err);
        const nextPumps = pumps.filter(p => p.id !== pumpId);
        setPumps(nextPumps);
        localStorage.setItem('fms_pumps', JSON.stringify(nextPumps));
        showToast(`Pump "${pump.name}" removed locally.`);
      }
    }
  };

  // -------------------------------------------------------------
  // C) EMPLOYEE / STAFF DIRECTORY (Add, Edit, Delete, Status Toggle)
  // -------------------------------------------------------------
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [empFormName, setEmpFormName] = useState('');
  const [empFormRole, setEmpFormRole] = useState<'Supervisor' | 'Pumper'>('Pumper');
  const [empFormPhone, setEmpFormPhone] = useState('');
  const [empFormStatus, setEmpFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [empModalError, setEmpModalError] = useState<string | null>(null);

  const avatarColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 
    'bg-purple-500', 'bg-indigo-500', 'bg-amber-500', 
    'bg-teal-500', 'bg-orange-500'
  ];

  const filteredEmployees = employees.filter(emp => {
    const q = empSearchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      emp.phone.toLowerCase().includes(q) ||
      emp.status.toLowerCase().includes(q)
    );
  });

  const handleOpenAddEmpModal = () => {
    setEditingEmp(null);
    setEmpFormName('');
    setEmpFormRole('Pumper');
    setEmpFormPhone('');
    setEmpFormStatus('Active');
    setEmpModalError(null);
    setIsAddEmpModalOpen(true);
  };

  const handleOpenEditEmpModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpFormName(emp.name);
    setEmpFormRole(emp.role);
    setEmpFormPhone(emp.phone);
    setEmpFormStatus(emp.status);
    setEmpModalError(null);
    setIsAddEmpModalOpen(true);
  };

  const handleSaveEmpSubmit = async () => {
    if (!empFormName.trim()) {
      setEmpModalError('Staff member name is required.');
      return;
    }
    if (!empFormPhone.trim()) {
      setEmpModalError('Contact phone number is required.');
      return;
    }

    if (editingEmp) {
      // Edit Employee
      const updatedEmp: Employee = {
        ...editingEmp,
        name: empFormName.trim(),
        role: empFormRole,
        phone: empFormPhone.trim(),
        status: empFormStatus
      };

      setEmployees(prev => prev.map(e => e.id === editingEmp.id ? updatedEmp : e));

      try {
        await supabase.from('employees').upsert({
          id: updatedEmp.id,
          name: updatedEmp.name,
          role: updatedEmp.role,
          phone: updatedEmp.phone,
          status: updatedEmp.status,
          avatarcolor: updatedEmp.avatarColor || 'bg-blue-500'
        });
      } catch (err) {
        console.warn("Supabase edit employee error:", err);
      }

      setIsAddEmpModalOpen(false);
      showToast(`Staff member ${updatedEmp.name} updated.`);
    } else {
      // Add Employee
      const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      const newEmp: Employee = {
        id: `emp-${Date.now().toString().slice(-4)}`,
        name: empFormName.trim(),
        role: empFormRole,
        phone: empFormPhone.trim(),
        status: empFormStatus,
        avatarColor: randomColor
      };

      setEmployees(prev => [...prev, newEmp]);

      try {
        await supabase.from('employees').insert([{
          id: newEmp.id,
          name: newEmp.name,
          role: newEmp.role,
          phone: newEmp.phone,
          status: newEmp.status,
          avatarcolor: newEmp.avatarColor
        }]);
      } catch (err) {
        console.warn("Supabase emp insert error:", err);
      }

      setIsAddEmpModalOpen(false);
      showToast(`Registered staff member ${newEmp.name}.`);
    }
  };

  const handleToggleEmpStatus = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const nextStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, status: nextStatus as 'Active' | 'Inactive' } : e));

    try {
      await supabase.from('employees').update({ status: nextStatus }).eq('id', empId);
    } catch (err) {
      console.warn("Error updating employee status:", err);
    }

    showToast(`${emp.name} set to ${nextStatus}.`);
  };

  const handleDeleteEmployee = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    if (confirm(`Are you sure you want to remove staff member "${emp.name}"?`)) {
      setEmployees(prev => prev.filter(e => e.id !== empId));
      try {
        await supabase.from('employees').delete().eq('id', empId);
      } catch (err) {
        console.warn("Error deleting employee:", err);
      }
      showToast(`Removed ${emp.name} from staff directory.`);
    }
  };

  // -------------------------------------------------------------
  // D) PRICE & TARIFF MANAGEMENT (Retail prices & Pending schedules)
  // -------------------------------------------------------------
  const [editingTankPriceId, setEditingTankPriceId] = useState<string | null>(null);
  const [tempPriceVal, setTempPriceVal] = useState<number>(0);

  const [schedFuelType, setSchedFuelType] = useState<FuelType>('Petrol 92');
  const [schedPrice, setSchedPrice] = useState<number>(0);
  const [schedDate, setSchedDate] = useState<string>('');

  const handleStartPriceEdit = (tank: FuelTank) => {
    setEditingTankPriceId(tank.id);
    setTempPriceVal(tank.pricePerLiter);
  };

  const handleSavePriceEdit = async (tankId: string) => {
    if (tempPriceVal <= 0) return;

    const updatedTanks = tanks.map(t => {
      if (t.id === tankId) {
        return { ...t, pricePerLiter: tempPriceVal };
      }
      return t;
    });

    setTanks(updatedTanks);
    setEditingTankPriceId(null);

    const targetTank = updatedTanks.find(t => t.id === tankId);
    if (targetTank) {
      try {
        const tableName = getTanksTableName();
        await supabase.from(tableName).update({ priceperliter: tempPriceVal }).eq('id', tankId);
      } catch (err) {
        console.warn("Supabase update price error:", err);
      }
      showToast(`Retail price for ${targetTank.name} updated to Rs. ${tempPriceVal.toFixed(2)}.`);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedDate || schedPrice <= 0) return;

    const newSchedule: PriceSchedule = {
      id: `sched-${Date.now()}`,
      fuelType: schedFuelType,
      newPrice: schedPrice,
      effectiveDate: schedDate,
      status: 'Pending'
    };

    if (setPriceSchedules) {
      setPriceSchedules(prev => [...prev, newSchedule]);
    }

    try {
      await supabase.from('price_schedules').insert([{
        id: newSchedule.id,
        fueltype: newSchedule.fuelType,
        newprice: newSchedule.newPrice,
        effectivedate: newSchedule.effectiveDate,
        status: newSchedule.status
      }]);
    } catch (err) {
      console.warn("Supabase price schedule insert warning:", err);
    }

    setSchedPrice(0);
    setSchedDate('');
    showToast(`Price schedule logged for ${newSchedule.fuelType} effective ${new Date(schedDate).toLocaleString()}.`);
  };

  const handleCancelSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this pending price schedule?")) return;

    try {
      await supabase.from('price_schedules').delete().eq('id', id);
    } catch (err) {
      console.warn("Supabase schedule delete error:", err);
    }

    if (setPriceSchedules) {
      setPriceSchedules(prev => prev.filter(s => s.id !== id));
    }

    showToast("Pending price schedule cancelled.");
  };

  // -------------------------------------------------------------
  // E) SYSTEM DIAGNOSTICS & SETUP
  // -------------------------------------------------------------
  const [stationName, setStationName] = useState(() => localStorage.getItem('fuelflow_station_name') || 'FuelFlow Station - Colombo 07');
  const [stationLocation, setStationLocation] = useState(() => localStorage.getItem('fuelflow_station_location') || 'Albert Crescent, Colombo, Sri Lanka');
  const [copied, setCopied] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error' | 'missing_tables'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkSupabaseConnection = async () => {
    setCheckingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');
    try {
      const { error } = await supabase.from('employees').select('id').limit(1);
      if (error) {
        if (
          error.code === '42P01' || 
          error.message?.includes('relation') || 
          error.message?.includes('does not exist')
        ) {
          setConnectionStatus('missing_tables');
          setConnectionMessage('Connected to Supabase, but database tables do not exist yet. Run the SQL schema in Supabase SQL Editor.');
        } else {
          setConnectionStatus('error');
          setConnectionMessage(error.message || 'Error communicating with Supabase API.');
        }
      } else {
        setConnectionStatus('success');
        setConnectionMessage('Success! Connected to Supabase and database tables are verified.');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message || 'Network error connecting to Supabase.');
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleSaveStationInfo = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fuelflow_station_name', stationName);
    localStorage.setItem('fuelflow_station_location', stationLocation);
    showToast('Station metadata saved.');
  };

  return (
    <div id="admin-control-root" className="space-y-4 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Page Header */}
      <div id="admin-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
                Admin Control Panel
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Centralized management for underground storage tanks, dispenser nozzles, staff registry, tariff rates, and system database
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Toast Banner */}
      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 text-emerald-800 border border-emerald-500/20 rounded-2xl text-xs flex items-center justify-between gap-2.5 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold text-emerald-900">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-3 overflow-x-auto">
        <button
          onClick={() => setAdminSection('tanks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            adminSection === 'tanks'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>Underground Storage Tanks ({tanks.length})</span>
        </button>

        <button
          onClick={() => setAdminSection('mapping')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            adminSection === 'mapping'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pump-to-Tank Mapping & Pumps ({pumps.length})</span>
        </button>

        <button
          onClick={() => setAdminSection('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            adminSection === 'employees'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({employees.length})</span>
        </button>

        <button
          onClick={() => setAdminSection('price')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            adminSection === 'price'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Price & Tariff Management</span>
        </button>

        <button
          onClick={() => setAdminSection('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            adminSection === 'system'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System & Database</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: UNDERGROUND FUEL TANKS MANAGEMENT */}
      {/* ========================================================================= */}
      {adminSection === 'tanks' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-[#1C1C1C]">Underground Storage Tanks</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure subterranean fuel vessels, max capacities, current volumes, and retail unit prices
              </p>
            </div>
            <button
              onClick={handleOpenAddTankModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Storage Tank</span>
            </button>
          </div>

          {/* Tanks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tanks.map((tank) => {
              const pct = Math.round((tank.currentLevel / tank.capacity) * 100);
              const mappedPumpsList = pumps.filter(p => p.tankId === tank.id || (!p.tankId && p.fuelType === tank.fuelType));

              return (
                <div key={tank.id} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm hover:border-gray-200 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          tank.fuelType.includes('Petrol') 
                            ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' 
                            : 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                        }`}>
                          {tank.fuelType}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">ID: {tank.id}</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-[#1C1C1C] mt-1.5">{tank.name}</h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTankModal(tank)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Edit Tank"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTank(tank.id)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete Tank"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-500">Current Fill Volume</span>
                      <span className={`tabular-nums ${pct < 20 ? 'text-rose-600 font-extrabold' : 'text-[#1C1C1C]'}`}>
                        {pct}% ({tank.currentLevel.toLocaleString()} L)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct < 20 ? 'bg-rose-500' : pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Matrix */}
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-gray-100">
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <span className="text-gray-400 font-semibold block text-[10px] uppercase">Total Capacity</span>
                      <span className="text-[#1C1C1C] font-bold tabular-nums text-sm">{tank.capacity.toLocaleString()} L</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl">
                      <span className="text-gray-400 font-semibold block text-[10px] uppercase">Price / Liter</span>
                      <span className="text-blue-600 font-bold tabular-nums text-sm">{formatCurrency(tank.pricePerLiter)}</span>
                    </div>
                  </div>

                  {/* Connected Pumps Badge */}
                  <div className="flex items-center justify-between text-xs text-gray-500 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                    <span className="font-medium text-gray-600 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mapped Pumps ({mappedPumpsList.length}):</span>
                    </span>
                    <span className="font-bold text-blue-700 truncate max-w-[180px]">
                      {mappedPumpsList.length > 0 ? mappedPumpsList.map(p => p.name).join(', ') : 'None'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: PUMP-TO-TANK MAPPING & PUMP MANAGEMENT */}
      {/* ========================================================================= */}
      {adminSection === 'mapping' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-blue-600">
                <Layers className="w-5 h-5" />
                <h2 className="text-lg font-bold text-[#1C1C1C]">Pump Dispenser & Tank Mapping Management</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Link each pump nozzle to its target subterranean tank. Use "Save Mapping" to update the binding. Automatic sales deductions will be deducted from the mapped tank.
              </p>
            </div>

            <button
              onClick={handleOpenAddPumpModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Pump / Nozzle</span>
            </button>
          </div>

          {pumps.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Gauge className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1C1C1C]">No Fuel Pumps Configured</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  There are no pumps recorded in the station database. Click below to add a fuel dispenser pump and assign its target storage tank.
                </p>
              </div>
              <button
                onClick={handleOpenAddPumpModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Pump / Nozzle</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pumps.map((pump) => {
                const currentTank = tanks.find(t => t.id === (selectedPumpTankMap[pump.id] || pump.tankId)) || tanks.find(t => t.fuelType === pump.fuelType) || tanks[0];

                return (
                  <div key={pump.id} className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 text-[#1C1C1C] flex items-center justify-center font-bold text-xs shadow-inner">
                          {pump.id.replace('p-', '#')}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-[#1C1C1C] text-sm">{pump.name}</h4>
                          <span className="text-[10px] text-gray-400 block font-mono">{pump.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          pump.status === 'Active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                        }`}>
                          {pump.status}
                        </span>

                        <button
                          onClick={() => handleOpenEditPumpModal(pump)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Pump Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeletePump(pump.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Pump"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Mapping Selector + Explicit Save Button */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        Target Underground Storage Tank
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPumpTankMap[pump.id] || pump.tankId || (currentTank?.id || '')}
                          onChange={(e) => setSelectedPumpTankMap(prev => ({ ...prev, [pump.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 text-[#1C1C1C] rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                        >
                          {tanks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.fuelType})
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleSaveSinglePumpMapping(pump.id)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                          title="Persist mapping to Supabase"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Mapping</span>
                        </button>
                      </div>
                    </div>

                    {/* Current Mapped Grade */}
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/60 flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Mapped Fuel Grade:</span>
                      <span className="font-bold text-blue-700">{pump.fuelType}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: EMPLOYEE DIRECTORY */}
      {/* ========================================================================= */}
      {adminSection === 'employees' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search staff by name, role, or phone..."
                value={empSearchQuery}
                onChange={(e) => setEmpSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 text-[#1C1C1C] rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleOpenAddEmpModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Register Staff Member</span>
            </button>
          </div>

          {/* Employees List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4 shadow-sm hover:border-gray-200 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl ${emp.avatarColor || 'bg-blue-500'} text-white flex items-center justify-center font-bold text-base shadow-sm`}>
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1C1C] text-sm">{emp.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.role === 'Supervisor' ? 'bg-purple-500/10 text-purple-700' : 'bg-blue-500/10 text-blue-700'
                        }`}>
                          {emp.role}
                        </span>
                        <span className="text-[10px] text-gray-400">{emp.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditEmpModal(emp)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Employee"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove Staff"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Phone className="w-3.5 h-3.5" />
                      Contact:
                    </span>
                    <span className="font-mono font-semibold text-[#1C1C1C]">{emp.phone}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-400">Status:</span>
                    <button
                      onClick={() => handleToggleEmpStatus(emp.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                        emp.status === 'Active' 
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' 
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      {emp.status}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION D: PRICE & TARIFF MANAGEMENT */}
      {/* ========================================================================= */}
      {adminSection === 'price' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-[#1C1C1C]">Price & Tariff Rate Management</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage global retail selling rates per liter and schedule automated price changes
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          {/* Current Retail Prices Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Current Fuel Grade Retail Rates</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/90 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Product Grade</th>
                    <th className="py-3.5 px-6">Underground Storage Tank</th>
                    <th className="py-3.5 px-6 text-right">Selling Price (per Liter)</th>
                    <th className="py-3.5 px-6 text-center w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {tanks.map((tank) => (
                    <tr key={tank.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                          tank.fuelType.includes('Petrol') ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {tank.fuelType}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-700 font-semibold">
                        {tank.name}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {editingTankPriceId === tank.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-bold text-gray-500">Rs.</span>
                            <input
                              type="number"
                              step="0.01"
                              value={tempPriceVal}
                              onChange={(e) => setTempPriceVal(parseFloat(e.target.value) || 0)}
                              className="w-28 px-3 py-1.5 border border-blue-500 bg-white text-[#1C1C1C] rounded-lg tabular-nums font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span className="tabular-nums font-extrabold text-base text-blue-600">
                            {formatCurrency(tank.pricePerLiter)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {editingTankPriceId === tank.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingTankPriceId(null)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSavePriceEdit(tank.id)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Save Rate"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartPriceEdit(tank)}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg transition-colors font-bold text-xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Rate</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Schedule Future Price Change Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <h3 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Schedule Future Price Tariff</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSchedule} className="flex flex-col md:flex-row gap-4 items-end text-xs">
                <div className="flex-1 w-full">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Fuel Grade</label>
                  <select
                    value={schedFuelType}
                    onChange={(e) => setSchedFuelType(e.target.value as FuelType)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] font-semibold focus:outline-none focus:border-blue-500"
                  >
                    {Array.from(new Set(tanks.map(t => t.fuelType))).map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 w-full">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block mb-1.5">New Retail Price (per Liter)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-500">Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="350.00"
                      value={schedPrice || ''}
                      onChange={(e) => setSchedPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] tabular-nums font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <label className="font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Effective Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full md:w-auto px-6 py-2.5 bg-[#1C1C1C] text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-sm whitespace-nowrap cursor-pointer"
                >
                  Schedule Price Change
                </button>
              </form>
            </div>
          </div>

          {/* Pending Price Schedules */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <h3 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Pending Price Schedules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/90 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-6 text-right">Scheduled Price</th>
                    <th className="py-3.5 px-6">Effective Time</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-center w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {priceSchedules.length > 0 ? (
                    priceSchedules.map((sched) => (
                      <tr key={sched.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                            sched.fuelType.includes('Petrol') ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {sched.fuelType}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="tabular-nums font-extrabold text-[#1C1C1C]">
                            {formatCurrency(sched.newPrice)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-600 font-semibold">
                          {new Date(sched.effectiveDate).toLocaleString()}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sched.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            sched.status === 'Applied' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {sched.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {sched.status === 'Pending' && (
                            <button
                              onClick={() => handleCancelSchedule(sched.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors font-bold text-xs flex items-center justify-center gap-1.5 w-full"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400 font-medium">
                        No pending price schedules found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION E: SYSTEM & DATABASE DIAGNOSTICS */}
      {/* ========================================================================= */}
      {adminSection === 'system' && (
        <div className="space-y-6 max-w-4xl">
          {/* Station Identity Metadata Form */}
          <form onSubmit={handleSaveStationInfo} className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
            <h3 className="font-bold text-[#1C1C1C] text-base flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-600" />
              <span>Station Identity Metadata</span>
            </h3>
            <p className="text-xs text-gray-500">Configure global station details displayed on reports and receipts</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Station Name</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 text-[#1C1C1C] rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Station Location</label>
                <input
                  type="text"
                  value={stationLocation}
                  onChange={(e) => setStationLocation(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 text-[#1C1C1C] rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
            >
              Save Station Info
            </button>
          </form>

          {/* Supabase Diagnostic Panel */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-[#1C1C1C] text-base">Database Verification & SQL Schema</h3>
              </div>
              <button
                type="button"
                onClick={checkSupabaseConnection}
                disabled={checkingConnection}
                className="px-3.5 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
                <span>Test Supabase Connection</span>
              </button>
            </div>

            {connectionStatus !== 'idle' && (
              <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
                connectionStatus === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                connectionStatus === 'missing_tables' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{connectionMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">Copy initialization SQL script for Supabase SQL Editor:</span>
              <button
                type="button"
                onClick={handleCopySQL}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#1C1C1C] rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied SQL' : 'Copy SQL Schema'}</span>
              </button>
            </div>

            {/* Quick Fix snippet box for missing tankid column */}
            <div className="bg-blue-50/70 border border-blue-200/80 p-3.5 rounded-xl text-xs space-y-2 mt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-blue-900">Schema Update Quick Fix (If seeing 'tankid' column error):</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("ALTER TABLE pumps ADD COLUMN IF NOT EXISTS tankid TEXT;");
                    showToast("Copied ALTER TABLE SQL to clipboard!");
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 flex-shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy SQL</span>
                </button>
              </div>
              <code className="block bg-white p-2 rounded border border-blue-200 text-blue-950 font-mono text-[11px] overflow-x-auto select-all">
                ALTER TABLE pumps ADD COLUMN IF NOT EXISTS tankid TEXT;
              </code>
            </div>
          </div>

          {/* Reset System Data */}
          <div className="bg-rose-50/50 border border-rose-200/60 p-6 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-extrabold text-sm">Emergency System Reset</h3>
            </div>
            <p className="text-xs text-rose-600">
              Clear custom station logs, pump readings, and restore initial demo tank levels and staff records.
            </p>
            <button
              onClick={() => {
                if (confirm("Reset all station logs and data back to initial defaults?")) {
                  onResetAllData();
                  window.location.reload();
                }
              }}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
            >
              Reset All Station Data
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT UNDERGROUND STORAGE TANK */}
      {/* ========================================================================= */}
      {isAddTankModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-600" />
                <span>{editingTank ? 'Edit Underground Storage Tank' : 'Add Underground Storage Tank'}</span>
              </h3>
              <button 
                onClick={() => setIsAddTankModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
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
                  placeholder="e.g. Tank 05 - Petrol 92 Reserve"
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
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Max Capacity (L)</label>
                  <input
                    type="number"
                    value={tankFormCapacity}
                    onChange={(e) => setTankFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 tabular-nums font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Current Reserve (L)</label>
                  <input
                    type="number"
                    value={tankFormCurrentLevel}
                    onChange={(e) => setTankFormCurrentLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 tabular-nums font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Retail Price per Liter (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tankFormPrice}
                  onChange={(e) => setTankFormPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 tabular-nums font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAddTankModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTankSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                {editingTank ? 'Update Tank' : 'Save Tank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PUMP DISPENSER */}
      {/* ========================================================================= */}
      {isAddPumpModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-600" />
                <span>{editingPump ? 'Edit Pump / Dispenser' : 'Add New Pump / Dispenser'}</span>
              </h3>
              <button 
                onClick={() => setIsAddPumpModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pumpModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{pumpModalError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Pump Dispenser Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pump 07 - Petrol 92"
                  value={pumpFormName}
                  onChange={(e) => setPumpFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Target Underground Storage Tank</label>
                <select
                  value={pumpFormTankId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setPumpFormTankId(selId);
                    const selected = tanks.find(t => t.id === selId);
                    if (selected) setPumpFormFuelType(selected.fuelType);
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-semibold"
                >
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.fuelType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Status</label>
                <select
                  value={pumpFormStatus}
                  onChange={(e) => setPumpFormStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive / Maintenance</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAddPumpModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePumpSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                {editingPump ? 'Update Pump' : 'Add Pump'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT STAFF MEMBER */}
      {/* ========================================================================= */}
      {isAddEmpModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>{editingEmp ? 'Edit Staff Member' : 'Register Staff Member'}</span>
              </h3>
              <button 
                onClick={() => setIsAddEmpModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {empModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{empModalError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kasun Kalhara"
                  value={empFormName}
                  onChange={(e) => setEmpFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Designation Role</label>
                <select
                  value={empFormRole}
                  onChange={(e) => setEmpFormRole(e.target.value as 'Supervisor' | 'Pumper')}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Pumper">Pump Operator (Pumper)</option>
                  <option value="Supervisor">Shift Supervisor</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 0771234567"
                  value={empFormPhone}
                  onChange={(e) => setEmpFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Employment Status</label>
                <select
                  value={empFormStatus}
                  onChange={(e) => setEmpFormStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[#1C1C1C] focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAddEmpModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmpSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                {editingEmp ? 'Update Staff' : 'Register Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
