/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Clock, Fuel, ArrowUpRight, DollarSign, 
  User, CheckCircle, AlertCircle, Sparkles, X, Download, RotateCcw,
  ShieldCheck, Check, Save, AlertTriangle, TrendingUp, RefreshCw,
  Lock, Unlock, Edit2, ArrowLeft
} from 'lucide-react';
import { Employee, FuelTank, PumpReading, Shift } from '../types';

interface ShiftManagementTabProps {
  employees: Employee[];
  tanks: FuelTank[];
  setTanks?: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  activeShift: Shift | null;
  setActiveShift: React.Dispatch<React.SetStateAction<Shift | null>>;
  onCloseShift: (closingShift: Shift) => void;
  onStartShift: (newShift: Omit<Shift, 'totalFuelSold' | 'totalNetSold' | 'totalNetSales'>) => void;
}

export default function ShiftManagementTab({
  employees,
  tanks,
  setTanks,
  activeShift,
  setActiveShift,
  onCloseShift,
  onStartShift,
}: ShiftManagementTabProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPastShift, setSelectedPastShift] = useState<Shift | null>(null);
  
  // Modals state
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isStartShiftOpen, setIsStartShiftOpen] = useState(false);
  
  // New Shift Setup Form State
  const [newShiftTemplate, setNewShiftTemplate] = useState<'Morning' | 'Evening' | 'Night' | 'Custom'>('Morning');
  const [shiftNameInput, setShiftNameInput] = useState('Morning Shift');
  const [startTimeInput, setStartTimeInput] = useState('06:00');
  const [endTimeInput, setEndTimeInput] = useState('14:00');
  const [newSupervisorId, setNewSupervisorId] = useState('');

  // Draft States for Active/Ongoing Shift (Phase 1 & 2)
  const [draftReadings, setDraftReadings] = useState<PumpReading[]>([]);
  const [draftSupervisorId, setDraftSupervisorId] = useState('');
  const [draftShiftName, setDraftShiftName] = useState('');
  const [draftStartTime, setDraftStartTime] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Track settled pumpers per active shift
  const [settledPumperIds, setSettledPumperIds] = useState<Record<string, boolean>>({});

  // Sync draft states when activeShift changes
  React.useEffect(() => {
    if (activeShift) {
      setDraftReadings(activeShift.pumpReadings);
      setDraftSupervisorId(activeShift.supervisorId);
      setDraftShiftName(activeShift.name);
      setDraftStartTime(activeShift.startTime);
      
      const stored = localStorage.getItem(`fuelflow_settled_pumpers_${activeShift.id}`);
      setSettledPumperIds(stored ? JSON.parse(stored) : {});
    } else {
      setDraftReadings([]);
      setDraftSupervisorId('');
      setDraftShiftName('');
      setDraftStartTime('');
      setSettledPumperIds({});
    }
  }, [activeShift]);

  // No unsaved changes since all edits are auto-saved in real-time to activeShift
  const hasUnsavedChanges = false;

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationOverlay, setShowValidationOverlay] = useState(false);

  // Filtered employees list
  const supervisors = useMemo(() => employees.filter(e => e.role === 'Supervisor'), [employees]);
  const pumpers = useMemo(() => employees.filter(e => e.role === 'Pumper'), [employees]);

  // Read currency symbol from settings/localStorage
  // Format currency/liters helper
  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' L';
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  const getPriceForFuelType = (type: string) => {
    const tank = tanks.find(t => t.fuelType === type);
    return tank ? tank.pricePerLiter : 1.50;
  };

  // Pre-populate supervisor
  React.useEffect(() => {
    if (supervisors.length > 0 && !newSupervisorId) {
      setNewSupervisorId(supervisors[0].id);
    }
  }, [supervisors, newSupervisorId]);

  // Handle template change
  const handleTemplateChange = (template: typeof newShiftTemplate) => {
    setNewShiftTemplate(template);
    if (template === 'Morning') {
      setShiftNameInput('Morning Shift');
      setStartTimeInput('06:00');
      setEndTimeInput('14:00');
    } else if (template === 'Evening') {
      setShiftNameInput('Evening Shift');
      setStartTimeInput('14:00');
      setEndTimeInput('22:00');
    } else if (template === 'Night') {
      setShiftNameInput('Night Shift');
      setStartTimeInput('22:00');
      setEndTimeInput('06:00');
    } else {
      setShiftNameInput('Custom Shift');
      setStartTimeInput('08:00');
      setEndTimeInput('16:00');
    }
  };

  // Active supervisor details based on draftSupervisorId
  const activeSupervisor = useMemo(() => {
    if (!activeShift) return null;
    return employees.find(e => e.id === draftSupervisorId) || null;
  }, [activeShift, draftSupervisorId, employees]);

  // Running totals calculations based on draftReadings (enables live calculation feedback)
  const stats = useMemo(() => {
    if (!activeShift || draftReadings.length === 0) {
      return { runningPumps: 0, totalFuelSold: 0, totalNetSold: 0, totalNetSales: 0 };
    }
    
    let runningPumps = 0;
    let totalFuelSold = 0;
    let totalNetSold = 0;
    let totalNetSales = 0;

    draftReadings.forEach(r => {
      if (r.assignedPumperId) {
        runningPumps++;
      }
      const fuelSold = Math.max(0, r.endMeter - r.startMeter);
      const netSold = Math.max(0, fuelSold - r.testingQty);
      const rate = getPriceForFuelType(r.fuelType);
      
      totalFuelSold += fuelSold;
      totalNetSold += netSold;
      totalNetSales += (netSold * rate);
    });

    return {
      runningPumps,
      totalFuelSold,
      totalNetSold,
      totalNetSales
    };
  }, [activeShift, draftReadings, tanks]);

  // Liters categorized by fuel type based on draftReadings
  const fuelTypeTotals = useMemo(() => {
    const totals: Record<string, { gross: number; net: number; sales: number }> = {
      'Petrol 92': { gross: 0, net: 0, sales: 0 },
      'Petrol 95': { gross: 0, net: 0, sales: 0 },
      'Auto Diesel': { gross: 0, net: 0, sales: 0 },
      'Super Diesel': { gross: 0, net: 0, sales: 0 }
    };

    if (activeShift && draftReadings.length > 0) {
      draftReadings.forEach(r => {
        const fuel = Math.max(0, r.endMeter - r.startMeter);
        const net = Math.max(0, fuel - r.testingQty);
        const rate = getPriceForFuelType(r.fuelType);
        if (totals[r.fuelType]) {
          totals[r.fuelType].gross += fuel;
          totals[r.fuelType].net += net;
          totals[r.fuelType].sales += (net * rate);
        }
      });
    }

    return totals;
  }, [activeShift, draftReadings, tanks]);

  // Group draft readings by assigned pumper for cash reconciliation
  const activePumpersData = useMemo(() => {
    const pumperGroups: Record<string, {
      pumperId: string;
      pumperName: string;
      avatarColor: string;
      readings: PumpReading[];
    }> = {};

    draftReadings.forEach(r => {
      if (r.assignedPumperId) {
        const emp = employees.find(e => e.id === r.assignedPumperId);
        if (emp) {
          if (!pumperGroups[emp.id]) {
            pumperGroups[emp.id] = {
              pumperId: emp.id,
              pumperName: emp.name,
              avatarColor: emp.avatarColor || 'bg-blue-600',
              readings: []
            };
          }
          pumperGroups[emp.id].readings.push(r);
        }
      }
    });

    return Object.values(pumperGroups);
  }, [draftReadings, employees]);

  // Handle live updates to a specific pump's readings in local draft state
  const handleUpdateReading = (
    pumpId: string,
    field: 'assignedPumperId' | 'startMeter' | 'endMeter' | 'testingQty',
    value: any
  ) => {
    if (!activeShift) return;

    const updatedReadings = draftReadings.map(r => {
      if (r.pumpId === pumpId) {
        // Block editing if completed
        if (r.status === 'Completed') {
          return r;
        }
        // Block changing start meter or pumper once saved/active
        if (r.status === 'Active' && (field === 'assignedPumperId' || field === 'startMeter')) {
          return r;
        }
        // Block changing end reading/testing qty while in Idle setup mode
        if (r.status === 'Idle' && (field === 'endMeter' || field === 'testingQty')) {
          return r;
        }
        
        const updated = {
          ...r,
          [field]: value
        };
        
        return updated;
      }
      return r;
    });

    setDraftReadings(updatedReadings);

    // Persist immediately in the global activeShift state so no progress is lost
    let totalFuel = 0;
    let totalNet = 0;
    let totalSales = 0;

    updatedReadings.forEach(dr => {
      const fuel = Math.max(0, dr.endMeter - dr.startMeter);
      const net = Math.max(0, fuel - dr.testingQty);
      totalFuel += fuel;
      totalNet += net;
      totalSales += (net * getPriceForFuelType(dr.fuelType));
    });

    setActiveShift({
      ...activeShift,
      pumpReadings: updatedReadings,
      totalFuelSold: totalFuel,
      totalNetSold: totalNet,
      totalNetSales: totalSales
    });
  };

  // Save and lock a single pump's starting readings (Assigned Pumper & Start Meter), marking it Active
  const handleSavePumpData = (pumpId: string) => {
    if (!activeShift) return;
    const r = draftReadings.find(dr => dr.pumpId === pumpId);
    if (!r) return;

    const errors: string[] = [];
    if (!r.assignedPumperId) {
      errors.push("Please assign a Pumper to this pump before saving.");
    }
    if (r.startMeter === undefined || r.startMeter === null || r.startMeter < 0 || isNaN(r.startMeter)) {
      errors.push("Start Meter reading must be a non-negative number.");
    }

    if (errors.length > 0) {
      setToastMessage(`Validation Error: ${errors[0]}`);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === pumpId) {
        // Initialize end meter from start meter if end meter is currently less
        const initialEndVal = dr.endMeter < dr.startMeter ? dr.startMeter : dr.endMeter;
        return { 
          ...dr, 
          endMeter: initialEndVal,
          isLocked: true, 
          status: 'Active' as const 
        };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

    // Persist immediately in the global activeShift state
    let totalFuel = 0;
    let totalNet = 0;
    let totalSales = 0;

    updatedReadings.forEach(dr => {
      const fuel = Math.max(0, dr.endMeter - dr.startMeter);
      const net = Math.max(0, fuel - dr.testingQty);
      totalFuel += fuel;
      totalNet += net;
      totalSales += (net * getPriceForFuelType(dr.fuelType));
    });

    setActiveShift({
      ...activeShift,
      pumpReadings: updatedReadings,
      totalFuelSold: totalFuel,
      totalNetSold: totalNet,
      totalNetSales: totalSales
    });

    setToastMessage(`${r.pumpName} successfully saved! End Meter & Testing Quantity are now unlocked.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Unlock single pump's starting readings for adjustment, moving it back to Setup (Idle) mode
  const handleUnlockPumpData = (pumpId: string) => {
    if (!activeShift) return;
    const r = draftReadings.find(dr => dr.pumpId === pumpId);
    if (!r) return;

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === pumpId) {
        return { ...dr, isLocked: false, status: 'Idle' as const };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

    // Add back the stock to the corresponding tank since we are unlocking a completed shift
    if (r.status === 'Completed' && setTanks) {
       const grossSold = r.endMeter - r.startMeter;
       const netSold = Math.max(0, grossSold - r.testingQty);
       if (netSold > 0) {
         setTanks(prevTanks => prevTanks.map(tank => {
           if (tank.fuelType === r.fuelType) {
             return { ...tank, currentLevel: Math.min(tank.capacity, tank.currentLevel + netSold) };
           }
           return tank;
         }));
       }
    }

    // Persist the unlocked state immediately back to the global state
    let totalFuel = 0;
    let totalNet = 0;
    let totalSales = 0;

    updatedReadings.forEach(dr => {
      const fuel = Math.max(0, dr.endMeter - dr.startMeter);
      const net = Math.max(0, fuel - dr.testingQty);
      totalFuel += fuel;
      totalNet += net;
      totalSales += (net * getPriceForFuelType(dr.fuelType));
    });

    // If we unlock a pump, check if the corresponding pumper was marked as settled.
    // If so, we should remove their settled status since their pump is no longer locked!
    if (r.assignedPumperId && settledPumperIds[r.assignedPumperId]) {
      const nextSettled = { ...settledPumperIds };
      delete nextSettled[r.assignedPumperId];
      setSettledPumperIds(nextSettled);
      localStorage.setItem(`fuelflow_settled_pumpers_${activeShift.id}`, JSON.stringify(nextSettled));
    }

    setActiveShift({
      ...activeShift,
      pumpReadings: updatedReadings,
      totalFuelSold: totalFuel,
      totalNetSold: totalNet,
      totalNetSales: totalSales
    });

    setToastMessage(`${r.pumpName} unlocked. Start Meter and Pumper can now be adjusted.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close shift and lock a single pump's readings permanently, marking it Completed
  const handleClosePumpShift = (pumpId: string) => {
    if (!activeShift) return;
    const r = draftReadings.find(dr => dr.pumpId === pumpId);
    if (!r) return;

    const errors: string[] = [];
    if (r.endMeter === undefined || r.endMeter === null || r.endMeter < 0 || isNaN(r.endMeter)) {
      errors.push("Please enter a valid End Meter reading.");
    } else {
      if (r.endMeter < r.startMeter) {
        errors.push(`End Meter (${r.endMeter} L) cannot be less than Start Meter (${r.startMeter} L).`);
      }
      const gross = r.endMeter - r.startMeter;
      if (r.testingQty < 0) {
        errors.push("Testing Quantity cannot be negative.");
      }
      if (gross < r.testingQty) {
        errors.push(`Testing Quantity (${r.testingQty} L) cannot exceed Gross Liters Sold (${gross.toFixed(2)} L).`);
      }
    }

    if (errors.length > 0) {
      setToastMessage(`Validation Error: ${errors[0]}`);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === pumpId) {
        return { 
          ...dr, 
          isLocked: true, 
          status: 'Completed' as const,
          unitPrice: getPriceForFuelType(dr.fuelType)
        };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

    // Deduct stock from the corresponding tank immediately
    const grossSold = r.endMeter - r.startMeter;
    const netSold = Math.max(0, grossSold - r.testingQty);
    
    if (setTanks && netSold > 0) {
      setTanks(prevTanks => prevTanks.map(tank => {
        if (tank.fuelType === r.fuelType) {
          const newLevel = Math.max(0, tank.currentLevel - netSold);
          // Show low stock warning if dropped below 15% (or some threshold)
          if (newLevel <= tank.capacity * 0.15) {
            // Note: Just using the toast for standard warning notification
            setTimeout(() => {
              setToastMessage(`⚠️ Warning: ${tank.id} stock is running low (${newLevel.toFixed(0)} L remaining).`);
              setTimeout(() => setToastMessage(null), 5000);
            }, 3000);
          }
          return { ...tank, currentLevel: newLevel };
        }
        return tank;
      }));
    }

    // Persist immediately in the global activeShift state so no progress is lost
    let totalFuel = 0;
    let totalNet = 0;
    let totalSales = 0;

    updatedReadings.forEach(dr => {
      const fuel = Math.max(0, dr.endMeter - dr.startMeter);
      const net = Math.max(0, fuel - dr.testingQty);
      totalFuel += fuel;
      totalNet += net;
      totalSales += (net * getPriceForFuelType(dr.fuelType));
    });

    setActiveShift({
      ...activeShift,
      pumpReadings: updatedReadings,
      totalFuelSold: totalFuel,
      totalNetSold: totalNet,
      totalNetSales: totalSales
    });

    setToastMessage(`${r.pumpName} shift successfully completed and locked!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle cash settled status for an active pumper
  const handleToggleSettlePumper = (pumperId: string) => {
    if (!activeShift) return;
    const next = { ...settledPumperIds, [pumperId]: !settledPumperIds[pumperId] };
    setSettledPumperIds(next);
    localStorage.setItem(`fuelflow_settled_pumpers_${activeShift.id}`, JSON.stringify(next));
    
    const pumperName = employees.find(e => e.id === pumperId)?.name || 'Pumper';
    if (next[pumperId]) {
      setToastMessage(`Cash collection for ${pumperName} successfully verified and settled.`);
    } else {
      setToastMessage(`Settle status cleared for ${pumperName}.`);
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered readings based on search and local draftReadings state
  const filteredReadings = useMemo(() => {
    if (!activeShift) return [];
    return draftReadings.filter(r => {
      const pumperName = r.assignedPumperId 
        ? employees.find(e => e.id === r.assignedPumperId)?.name || '' 
        : 'Unassigned';
      
      const query = searchQuery.toLowerCase();
      return (
        r.pumpName.toLowerCase().includes(query) ||
        r.fuelType.toLowerCase().includes(query) ||
        pumperName.toLowerCase().includes(query)
      );
    });
  }, [activeShift, draftReadings, searchQuery, employees]);

  // Handle opening shift submission
  const handleStartNewShiftSubmit = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(10 + Math.random() * 90);
    const newShiftId = `SH-${dateStr}-${randSuffix}`;

    // Get previous shift's completed readings from localStorage
    const savedHistoryStr = localStorage.getItem('fuelflow_history');
    const history: Shift[] = savedHistoryStr ? JSON.parse(savedHistoryStr) : [];
    const previousReadings = activeShift?.pumpReadings || (history.length > 0 ? history[0].pumpReadings : null);

    const defaultPumps = [
      { id: 'p-01', name: 'Pump 01', fuelType: 'Petrol 92' as const },
      { id: 'p-02', name: 'Pump 02', fuelType: 'Auto Diesel' as const },
      { id: 'p-03', name: 'Pump 03', fuelType: 'Petrol 95' as const },
      { id: 'p-04', name: 'Pump 04', fuelType: 'Auto Diesel' as const },
      { id: 'p-05', name: 'Pump 05', fuelType: 'Petrol 92' as const },
      { id: 'p-06', name: 'Pump 06', fuelType: 'Petrol 95' as const },
      { id: 'p-07', name: 'Pump 07', fuelType: 'Auto Diesel' as const },
      { id: 'p-08', name: 'Pump 08', fuelType: 'Super Diesel' as const }
    ];

    const newPumpReadings: PumpReading[] = defaultPumps.map((pump, idx) => {
      const prev = previousReadings?.find(pr => pr.pumpId === pump.id);
      
      // Carry forward previous end meter reading to start meter reading
      const carryForwardStart = prev ? prev.endMeter : (12000 + idx * 4500);

      return {
        pumpId: pump.id,
        pumpName: pump.name,
        fuelType: pump.fuelType,
        assignedPumperId: null, // start as unassigned
        startMeter: carryForwardStart,
        endMeter: carryForwardStart, // initially same
        testingQty: 0,
        status: 'Idle'
      };
    });

    const combinedShiftName = `${shiftNameInput} (${startTimeInput} - ${endTimeInput})`;

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const fullISOStart = `${datePart}T${startTimeInput}:00`;

    onStartShift({
      id: newShiftId,
      name: combinedShiftName,
      supervisorId: newSupervisorId,
      startTime: fullISOStart,
      isActive: true,
      pumpReadings: newPumpReadings
    });

    setIsStartShiftOpen(false);
  };

  // Perform validation check and open closing modal
  const handleEndShiftClick = () => {
    if (!activeShift) return;

    const errors: string[] = [];

    // Ensure Supervisor is assigned
    if (!draftSupervisorId) {
      errors.push("A Station Supervisor must be assigned to the shift.");
    }

    // Ensure Shift Name is set
    if (!draftShiftName.trim()) {
      errors.push("Shift Name / Label cannot be empty.");
    }

    // Validate that all active pumps (assigned to a pumper) are Completed / locked
    draftReadings.forEach(r => {
      if (r.assignedPumperId) {
        if (r.status === 'Idle') {
          errors.push(`${r.pumpName}: Please save the starting setup data first.`);
        } else if (r.status === 'Active') {
          errors.push(`${r.pumpName}: This pump shift is still active. Please click 'End Shift' at the bottom of the pump card first to close it.`);
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationOverlay(true);
    } else {
      setValidationErrors([]);
      setShowValidationOverlay(false);
      setIsCloseConfirmOpen(true);
    }
  };

  // Close shift permanently and lock ledger
  const handleConfirmCloseShift = () => {
    if (!activeShift) return;
    
    let totalFuel = 0;
    let totalNet = 0;
    let totalSales = 0;

    const finalReadings = draftReadings.map(r => {
      const fuel = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, fuel - r.testingQty);
      totalFuel += fuel;
      totalNet += net;
      totalSales += (net * getPriceForFuelType(r.fuelType));
      
      return {
        ...r,
        status: 'Completed' as const,
        unitPrice: r.unitPrice || getPriceForFuelType(r.fuelType)
      };
    });

    const closedShift: Shift = {
      ...activeShift,
      supervisorId: draftSupervisorId,
      name: draftShiftName,
      startTime: draftStartTime,
      isActive: false,
      endTime: new Date().toISOString(),
      pumpReadings: finalReadings,
      totalFuelSold: totalFuel,
      totalNetSold: totalNet,
      totalNetSales: totalSales
    };

    onCloseShift(closedShift);
    setIsCloseConfirmOpen(false);
  };

  // Export current shift to CSV
  const exportShiftReport = () => {
    if (!activeShift) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `FuelFlow Shift Report - ${activeShift.id}\n`;
    csvContent += `Shift Name,${activeShift.name}\n`;
    csvContent += `Supervisor,${activeSupervisor?.name || 'N/A'}\n`;
    csvContent += `Started At,${new Date(activeShift.startTime).toLocaleString()}\n\n`;
    csvContent += "Pump,Fuel Type,Assigned Pumper,Start Meter (L),End Meter (L),Fuel Sold (L),Testing Deducted (L),Net Sold (L),Fuel Price (Per Liter),Net Revenue\n";

    activeShift.pumpReadings.forEach(r => {
      const pumperName = r.assignedPumperId 
        ? employees.find(e => e.id === r.assignedPumperId)?.name || 'N/A' 
        : 'Unassigned';
      const sold = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, r.endMeter - r.startMeter - r.testingQty);
      const price = getPriceForFuelType(r.fuelType);
      const rev = net * price;

      csvContent += `"${r.pumpName}","${r.fuelType}","${pumperName}",${r.startMeter},${r.endMeter},${sold},${r.testingQty},${net},${price},${rev.toFixed(2)}\n`;
    });

    csvContent += `\nTOTALS,,, , ,${stats.totalFuelSold.toFixed(2)}, ,${stats.totalNetSold.toFixed(2)}, ,${stats.totalNetSales.toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FuelFlow_Report_${activeShift.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="shift-tab-root" className="space-y-6">
      
      {/* Control Header */}
      <div id="shift-header-section" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="shift-title" className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight font-sans">
            Shift Management
          </h1>
          <p id="shift-subtitle" className="text-gray-500 text-sm mt-1">
            Real-time digital ledger and active station control center
          </p>
        </div>

        {activeShift ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-export-report"
              onClick={exportShiftReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-all shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span>Export Report</span>
            </button>
            
            <button
              id="btn-close-shift"
              onClick={handleEndShiftClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:brightness-110 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>End Shift & Lock Ledger</span>
            </button>
          </div>
        ) : (
          <button
            id="btn-start-shift"
            onClick={() => setIsStartShiftOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Shift</span>
          </button>
        )}
      </div>

      {activeShift ? (
        <>
          {/* Active Summary Running Totals */}
          <div id="shift-summary-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Total Sales Large Bento */}
            <div className="bg-[#E8F1F5] p-6 rounded-2xl border border-[#D0E2EB] text-[#1C1C1C] shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
                  Total Expected Cash Revenue
                </span>
                <span className="text-4xl font-extrabold mt-3 block tabular-nums font-extrabold tracking-tight">
                  {formatCurrency(stats.totalNetSales)}
                </span>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>Active Shift ID: <strong className="text-[#1C1C1C] tabular-nums font-semibold">{activeShift.id}</strong></span>
                <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-semibold text-blue-600 animate-pulse uppercase border border-blue-100 shadow-sm">
                  Live Syncing
                </span>
              </div>
            </div>

            {/* Liters Sold Categorized by Fuel Type */}
            <div className="glass-panel p-5 rounded-2xl lg:col-span-2 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
                  Total Liters Sold (By Fuel Type)
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Petrol 92 */}
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Petrol 92</span>
                    <span className="text-lg font-bold text-[#1C1C1C] tabular-nums font-semibold mt-1 block">
                      {formatLiters(fuelTypeTotals['Petrol 92'].net)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {formatCurrency(fuelTypeTotals['Petrol 92'].sales)}
                    </span>
                  </div>

                  {/* Petrol 95 */}
                  <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <span className="text-[10px] font-bold text-purple-400 uppercase block">Petrol 95</span>
                    <span className="text-lg font-bold text-[#1C1C1C] tabular-nums font-semibold mt-1 block">
                      {formatLiters(fuelTypeTotals['Petrol 95'].net)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {formatCurrency(fuelTypeTotals['Petrol 95'].sales)}
                    </span>
                  </div>

                  {/* Auto Diesel */}
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-400 uppercase block">Auto Diesel</span>
                    <span className="text-lg font-bold text-[#1C1C1C] tabular-nums font-semibold mt-1 block">
                      {formatLiters(fuelTypeTotals['Auto Diesel'].net)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {formatCurrency(fuelTypeTotals['Auto Diesel'].sales)}
                    </span>
                  </div>

                  {/* Super Diesel */}
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase block">Super Diesel</span>
                    <span className="text-lg font-bold text-[#1C1C1C] tabular-nums font-semibold mt-1 block">
                      {formatLiters(fuelTypeTotals['Super Diesel'].net)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {formatCurrency(fuelTypeTotals['Super Diesel'].sales)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-blue-500" />
                  <span>Total Net Liters Sold: <strong className="text-[#1C1C1C]">{formatLiters(stats.totalNetSold)}</strong></span>
                </span>
                <span>Active Pumps: <strong className="text-[#1C1C1C]">{stats.runningPumps} of {activeShift.pumpReadings.length}</strong></span>
              </div>
            </div>
          </div>

          {/* Active Shift Details Banner (Fully Editable Phase 1 & 2 Config) */}
          <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Supervisor Selector */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${
                employees.find(e => e.id === draftSupervisorId)?.avatarColor || 'bg-blue-600'
              } text-[#1C1C1C] flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0`}>
                {employees.find(e => e.id === draftSupervisorId)?.name.split(' ').map(n => n[0]).join('') || 'SV'}
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Station Supervisor
                </label>
                <select
                  value={draftSupervisorId}
                  onChange={(e) => setDraftSupervisorId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1C1C1C] focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>-- Select Supervisor --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Shift Name/Times */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Shift Name / Times
              </label>
              <input
                type="text"
                value={draftShiftName}
                onChange={(e) => setDraftShiftName(e.target.value)}
                placeholder="e.g. Morning Shift (06:00 - 14:00)"
                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1C1C1C] focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Active Since / Start Time Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={draftStartTime ? draftStartTime.slice(0, 16) : ''}
                  onChange={(e) => setDraftStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1C1C1C] focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 self-start sm:self-auto h-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Config / Draft Mode</span>
              </span>
            </div>
          </div>

          {/* INLINE LEDGER & PUMP MANAGEMENT GRID */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight">Active Pump Ledgers</h3>
                <p className="text-xs text-gray-500 mt-0.5">Continuous digital entry. Changes are automatically updated in real-time totals and saved.</p>
              </div>
              
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search pumps or pumpers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Pump Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {filteredReadings.length > 0 ? (
                filteredReadings.map((r) => {
                  const fuelPrice = getPriceForFuelType(r.fuelType);
                  const fuelSold = Math.max(0, r.endMeter - r.startMeter);
                  const netSold = Math.max(0, fuelSold - r.testingQty);
                  const expectedCash = netSold * fuelPrice;

                  // Styling theme per fuel type
                  const isPetrol = r.fuelType.includes('Petrol');
                  const themeClasses = r.fuelType === 'Petrol 92'
                    ? { header: 'bg-blue-500/10 border-l-4 border-blue-500', text: 'text-blue-600' }
                    : r.fuelType === 'Petrol 95'
                    ? { header: 'bg-purple-500/10 border-l-4 border-purple-500', text: 'text-purple-400' }
                    : r.fuelType === 'Auto Diesel'
                    ? { header: 'bg-amber-500/10 border-l-4 border-amber-500', text: 'text-amber-400' }
                    : { header: 'bg-emerald-500/10 border-l-4 border-emerald-500', text: 'text-emerald-400' };

                  return (
                    <div 
                      key={r.pumpId} 
                      className={`glass-panel rounded-2xl transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                        r.status === 'Completed' 
                          ? 'border-emerald-500/30 shadow-emerald-500/5 bg-emerald-500/5' 
                          : r.status === 'Active'
                          ? 'border-blue-500/30 shadow-blue-500/5 bg-blue-500/5'
                          : 'hover:border-blue-500/20 hover:shadow-[0_0_15px_rgba(0,123,255,0.15)]'
                      }`}
                    >
                      {/* Card Header with Pump and Fuel Info */}
                      <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${themeClasses.header}`}>
                        <div>
                          <h4 className="font-extrabold text-[#1C1C1C] text-sm flex items-center gap-1.5">
                            {r.pumpName}
                            {r.status === 'Completed' ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[9px] font-extrabold uppercase rounded-md shadow-xs">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span>Shift Completed / Locked</span>
                              </span>
                            ) : r.status === 'Active' ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/25 text-amber-300 border border-amber-500/35 text-[9px] font-extrabold uppercase rounded-md shadow-xs animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                <span>Pump Active / In Progress</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-100 text-[9px] font-bold uppercase rounded-md">
                                <span>Setup</span>
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] tabular-nums font-semibold text-gray-500">{r.pumpId}</span>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${themeClasses.header} ${themeClasses.text}`}>
                            {r.fuelType}
                          </span>
                          <span className="block text-[9px] text-gray-500 tabular-nums font-semibold mt-0.5">
                            Price: {formatCurrency(fuelPrice)}/L
                          </span>
                        </div>
                      </div>

                      {/* Card Inputs body */}
                      <div className="p-4 space-y-4">
                        {/* Pumper Assignment Selector */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1 uppercase tracking-wider">
                            Assigned Pumper
                          </label>
                          <select
                            value={r.assignedPumperId || ''}
                            disabled={r.status !== 'Idle'}
                            onChange={(e) => handleUpdateReading(r.pumpId, 'assignedPumperId', e.target.value || null)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-xs focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-100"
                          >
                            <option value="">-- Unassigned (Idle) --</option>
                            {pumpers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Interactive Meters Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-gray-500 block mb-1 uppercase">
                              Start Meter
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={r.startMeter}
                              disabled={r.status !== 'Idle'}
                              onChange={(e) => handleUpdateReading(r.pumpId, 'startMeter', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-semibold text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-100"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-gray-500 block mb-1 uppercase">
                              End Meter
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={r.endMeter}
                              disabled={r.status !== 'Active'}
                              placeholder="0.00"
                              onChange={(e) => handleUpdateReading(r.pumpId, 'endMeter', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-semibold text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-100"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-gray-500 block mb-1 uppercase">
                              Test (L)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={r.testingQty}
                              disabled={r.status !== 'Active'}
                              onChange={(e) => handleUpdateReading(r.pumpId, 'testingQty', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-semibold text-center focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-100"
                            />
                          </div>
                        </div>

                        {/* Visual calculations feed */}
                        <div className={`p-2.5 rounded-xl text-[11px] space-y-1 font-sans border transition-colors ${
                          r.status === 'Completed'
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : r.status === 'Active'
                            ? 'bg-blue-500/10 border-blue-500/20'
                            : 'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex justify-between text-gray-500">
                            <span>Gross Fuel:</span>
                            <span className="tabular-nums font-semibold text-gray-600">{fuelSold.toFixed(2)} L</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Calibration Test:</span>
                            <span className="tabular-nums font-semibold text-red-400 font-semibold">-{r.testingQty.toFixed(1)} L</span>
                          </div>
                          <hr className="border-gray-100 my-1" />
                          <div className="flex justify-between font-bold text-gray-600">
                            <span>Net Sold:</span>
                            <span className={`tabular-nums font-semibold ${r.status !== 'Idle' ? 'text-emerald-400' : 'text-gray-500'}`}>{netSold.toFixed(2)} L</span>
                          </div>
                        </div>

                        {/* Pump Card Saving Action Controls */}
                        <div className="pt-2 border-t border-gray-100">
                          {r.status === 'Idle' ? (
                            <button
                              id={`btn-lock-${r.pumpId}`}
                              onClick={() => handleSavePumpData(r.pumpId)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-[#1C1C1C] text-xs font-extrabold rounded-xl transition-all shadow-md hover:brightness-110 cursor-pointer animate-pulse"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Pump Data</span>
                            </button>
                          ) : r.status === 'Active' ? (
                            <div className="flex flex-col gap-2 w-full">
                              <button
                                id={`btn-end-pump-${r.pumpId}`}
                                onClick={() => handleClosePumpShift(r.pumpId)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600/90 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>End Shift</span>
                              </button>
                              <button
                                id={`btn-unlock-${r.pumpId}`}
                                onClick={() => handleUnlockPumpData(r.pumpId)}
                                className="w-full flex items-center justify-center gap-1 py-1.5 bg-transparent hover:bg-gray-100 text-gray-600 hover:text-[#1C1C1C] border border-gray-200 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit Setup / Unlock</span>
                              </button>
                            </div>
                          ) : (
                            <div className="w-full text-center py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>Completed & Locked</span>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Card Footer expected revenue display */}
                      <div className={`px-4 py-3 border-t border-gray-100 flex items-center justify-between transition-colors ${
                        r.status === 'Completed' 
                          ? 'bg-emerald-500/10' 
                          : r.status === 'Active'
                          ? 'bg-blue-500/10'
                          : 'bg-gray-50'
                      }`}>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {r.status === 'Completed' ? 'Final Cash Due' : 'Expected Cash'}
                        </span>
                        <span className={`tabular-nums font-extrabold text-sm transition-colors ${
                          r.status === 'Completed' ? 'text-emerald-400' : 'text-blue-600'
                        }`}>
                          {formatCurrency(expectedCash)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-12 text-center text-gray-500 text-sm italic">
                  No pumps found matching your search query.
                </div>
              )}
            </div>

          </div>
        </>
      ) : (
        /* Empty/Inactive state */
        (() => {
          if (selectedPastShift) {
            return (
              <div id="past-shift-detail" className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
                <button
                  onClick={() => setSelectedPastShift(null)}
                  className="flex items-center gap-2 text-gray-500 hover:text-[#1C1C1C] transition-colors font-semibold text-sm cursor-pointer mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Shift List
                </button>
                
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#1C1C1C] tracking-tight">Shift #{selectedPastShift.id}</h2>
                      <p className="text-sm text-gray-500 mt-1">Supervisor: <span className="font-semibold text-gray-700">{selectedPastShift.supervisorName}</span></p>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-600 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm tabular-nums">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{new Date(selectedPastShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-gray-300">→</span>
                      <span>{selectedPastShift.endTime ? new Date(selectedPastShift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}</span>
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-x-auto">
                    <h3 className="font-bold text-[#1C1C1C] text-sm uppercase tracking-wider mb-4">Pump Meter Breakdown</h3>
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Pump</th>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4 text-right">Start Meter</th>
                          <th className="py-3 px-4 text-right">End Meter</th>
                          <th className="py-3 px-4 text-right">Total Liters</th>
                          <th className="py-3 px-4 text-right">Net Sales (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {selectedPastShift.pumpReadings.map((reading, idx) => {
                          const tank = tanks.find(t => t.id === reading.tankId);
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3 px-4 font-semibold text-[#1C1C1C]">{reading.pumpName}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${reading.fuelType === 'Petrol' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {reading.fuelType || 'Unknown'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-gray-600 tabular-nums">{(reading.startMeter || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 text-right font-medium text-gray-600 tabular-nums">{(reading.endMeter || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 text-right font-bold text-blue-600 tabular-nums">{(reading.totalDispensed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 text-right font-bold text-[#1C1C1C] tabular-nums">{formatCurrency(reading.netSales || 0)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-gray-50/50 border-t-2 border-gray-200">
                          <td colSpan={4} className="py-4 px-4 text-right font-bold text-[#1C1C1C] uppercase tracking-wider text-xs">Total</td>
                          <td className="py-4 px-4 text-right font-black text-blue-600 tabular-nums text-base">{(selectedPastShift.totalFuelSold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-4 px-4 text-right font-black text-[#1C1C1C] tabular-nums text-base">{formatCurrency(selectedPastShift.totalNetSales || 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-6 bg-gray-50/30 border-t border-gray-100">
                    <h3 className="font-bold text-[#1C1C1C] text-sm uppercase tracking-wider mb-4">Financial Reconciliation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected Cash</p>
                        <p className="text-lg font-bold text-[#1C1C1C] tabular-nums mt-1">{formatCurrency(selectedPastShift.totalNetSales || 0)}</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actual Cash Collected (Placeholder)</p>
                        <p className="text-lg font-bold text-blue-600 tabular-nums mt-1">{formatCurrency(selectedPastShift.totalNetSales || 0)}</p>
                      </div>
                      <div className={`bg-white p-4 rounded-xl border shadow-sm border-emerald-200 bg-emerald-50/50`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shortage / Overage</p>
                        <p className={`text-lg font-bold tabular-nums mt-1 text-emerald-600`}>
                          {formatCurrency(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          let todaysShifts = [];
          try {
            const history = JSON.parse(localStorage.getItem('fuelflow_history') || '[]');
            const today = new Date().toISOString().split('T')[0];
            todaysShifts = history.filter(s => s.endTime && s.endTime.startsWith(today));
          } catch (e) {
            console.error('Failed to parse history', e);
          }

          // Compute fuel distributions
          const productDistribution: Record<string, number> = {};
          let totalLiters = 0;
          let totalRevenue = 0;

          todaysShifts.forEach(shift => {
            totalLiters += (shift.totalFuelSold || 0);
            totalRevenue += (shift.totalNetSales || 0);
            (shift.pumpReadings || []).forEach(reading => {
               const fuel = reading.fuelType || 'Unknown';
               productDistribution[fuel] = (productDistribution[fuel] || 0) + (reading.totalDispensed || 0);
            });
          });

          return (
            <div id="no-shift-screen" className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">


              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* LEFT COLUMN (70%): Shift Ledger */}
                <div className="lg:w-[70%] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 shrink-0">
                     <h3 className="font-bold text-[#1C1C1C] text-sm uppercase tracking-wider">Shift Ledger</h3>
                  </div>
                  <div className="overflow-auto flex-1 relative">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm shadow-sm">
                        <tr className="border-b border-gray-100 text-gray-500 font-bold text-xs uppercase tracking-wider">
                          <th className="py-4 px-6">Shift ID</th>
                          <th className="py-4 px-6">Supervisor</th>
                          <th className="py-4 px-6 text-right">Liters</th>
                          <th className="py-4 px-6 text-right">Revenue (Rs.)</th>
                          <th className="py-4 px-6">End Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {todaysShifts.length > 0 ? (
                          todaysShifts.map(shift => (
                            <tr key={shift.id} onClick={() => setSelectedPastShift(shift)} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                              <td className="py-4 px-6 font-semibold text-[#1C1C1C] tabular-nums group-hover:text-blue-600 transition-colors">{shift.id}</td>
                              <td className="py-4 px-6 text-gray-600 font-medium">{shift.supervisorName}</td>
                              <td className="py-4 px-6 text-right tabular-nums font-semibold text-gray-700">
                                {(shift.totalFuelSold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 px-6 text-right tabular-nums font-bold text-[#1C1C1C]">
                                {formatCurrency(shift.totalNetSales || 0)}
                              </td>
                              <td className="py-4 px-6 text-gray-500 tabular-nums font-medium">
                                {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400 font-medium text-sm">
                              No shifts completed today yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT COLUMN (30%): Mini Analytics Progress */}
                <div className="lg:w-[30%] bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6 flex flex-col h-[500px] overflow-y-auto">
                   <div>
                     <h3 className="font-bold text-[#1C1C1C] text-sm uppercase tracking-wider mb-5">Today's Progress</h3>
                     
                     <div className="space-y-4">
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Revenue</p>
                          <p className="text-2xl font-extrabold text-[#1C1C1C] tabular-nums mt-1">{formatCurrency(totalRevenue)}</p>
                       </div>
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Volume</p>
                          <p className="text-2xl font-extrabold text-[#1C1C1C] tabular-nums mt-1">{totalLiters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</p>
                       </div>
                     </div>
                   </div>

                   <div>
                      <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider mb-3">Volume Distribution</h4>
                      <div className="space-y-4">
                        {Object.keys(productDistribution).length > 0 ? (
                           Object.entries(productDistribution).map(([product, vol]) => {
                             const percentage = totalLiters > 0 ? ((vol / totalLiters) * 100).toFixed(1) : 0;
                             // Assign a color dynamically based on product name
                             const isPetrol = product.toLowerCase().includes('petrol');
                             const colorClass = isPetrol ? 'bg-orange-400' : 'bg-blue-500';
                             return (
                               <div key={product}>
                                 <div className="flex justify-between text-xs font-semibold mb-1">
                                   <span className="text-[#1C1C1C]">{product}</span>
                                   <span className="tabular-nums text-gray-600">{vol.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1})} L ({percentage}%)</span>
                                 </div>
                                 <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                                 </div>
                               </div>
                             );
                           })
                        ) : (
                           <p className="text-sm text-gray-400 italic">No fuel dispensed yet.</p>
                        )}
                      </div>
                   </div>
                </div>

              </div>
            </div>
          );
        })()
      )}

      {/* --- MODAL: START NEW SHIFT --- */}
      {isStartShiftOpen && (
        <div id="start-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="start-modal-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg">Initiate New Active Shift</h3>
              <button onClick={() => setIsStartShiftOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Shift Template selection */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Select Shift Template
                </label>
                <select
                  value={newShiftTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="Morning">Morning Shift (06:00 - 14:00)</option>
                  <option value="Evening">Evening Shift (14:00 - 22:00)</option>
                  <option value="Night">Night Shift (22:00 - 06:00)</option>
                  <option value="Custom">Custom / Special Shift</option>
                </select>
              </div>

              {/* Editable Shift Name / Label */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Shift Name / Label
                </label>
                <input
                  type="text"
                  value={shiftNameInput}
                  onChange={(e) => setShiftNameInput(e.target.value)}
                  placeholder="e.g. Morning Shift"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Time pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Supervisor selection */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Assign Supervisor
                </label>
                <select
                  value={newSupervisorId}
                  onChange={(e) => setNewSupervisorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>-- Select Station Supervisor --</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Carry-Forward disclaimer */}
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-450" />
                  <span>Fully Automated Carry-Forward</span>
                </div>
                <p className="leading-relaxed text-gray-450">
                  Start meter values are carried forward automatically from the previous shift's closing values. You can modify these readings at any time during the shift.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsStartShiftOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleStartNewShiftSubmit}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
                disabled={!newSupervisorId}
              >
                Launch Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VALIDATION WARNING OVERLAY --- */}
      {showValidationOverlay && (
        <div id="validation-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="validation-card" className="bg-gray-50 rounded-2xl max-w-lg w-full shadow-2xl border border-red-500/20 overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <h3 className="font-extrabold text-[#1C1C1C] text-lg">Ledger Validation Errors</h3>
              <p className="text-gray-500 text-sm mt-1">
                Please correct the following errors before ending the shift to preserve ledger and database integrity:
              </p>

              <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-xl p-4 max-h-60 overflow-y-auto space-y-2.5">
                {validationErrors.map((err, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-red-400 font-medium leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowValidationOverlay(false)}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 text-[#1C1C1C] font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Dismiss & Review Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM CLOSE SHIFT MODAL --- */}
      {isCloseConfirmOpen && activeShift && (
        <div id="close-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="close-modal-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#1C1C1C] text-lg">End Shift & Lock Ledger?</h3>
              <p className="text-gray-500 text-sm mt-2">
                This action will lock the current ledger (<strong className="text-[#1C1C1C] tabular-nums font-semibold">{activeShift.id}</strong>), permanently save the shift to history, and deduct the sold fuel stock levels from the underground tanks.
              </p>
              
              <div className="mt-5 bg-gray-50/60 p-4 rounded-xl text-left text-xs text-gray-600 space-y-2 border border-gray-100">
                <div className="flex justify-between">
                  <span>Supervisor:</span>
                  <span className="font-semibold text-[#1C1C1C]">{activeSupervisor?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shift Name:</span>
                  <span className="font-semibold text-[#1C1C1C]">{activeShift.name}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <span>Total Net Fuel Sold:</span>
                  <span className="tabular-nums font-semibold text-[#1C1C1C]">{formatLiters(stats.totalNetSold)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Revenue:</span>
                  <span className="font-bold text-blue-600 tabular-nums font-semibold">{formatCurrency(stats.totalNetSales)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsCloseConfirmOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCloseShift}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 text-[#1C1C1C] font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Confirm & Lock Ledger
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-white text-[#1C1C1C] px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 text-sm font-semibold animate-bounce shadow-emerald-500/10">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
