/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Plus, Clock, Fuel, ArrowUpRight, DollarSign, 
  User, CheckCircle, AlertCircle, Sparkles, X, Download, RotateCcw,
  ShieldCheck, Check, Save, AlertTriangle, TrendingUp, RefreshCw,
  Lock, Unlock, Edit2, ArrowLeft, Users, Package
} from 'lucide-react';
import { supabase, saveCreditSale, saveCardSale, syncCreditAndCardSales, upsertPumpReadings } from '../lib/supabaseClient';
import { Employee, FuelTank, Pump, PumpReading, Shift, FuelType } from '../types';

interface ShiftManagementTabProps {
  employees: Employee[];
  tanks: FuelTank[];
  setTanks?: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  pumps?: Pump[];
  setPumps?: React.Dispatch<React.SetStateAction<Pump[]>>;
  activeShift: Shift | null;
  setActiveShift: React.Dispatch<React.SetStateAction<Shift | null>>;
  shiftHistory?: Shift[];
  onCloseShift: (closingShift: Shift) => void;
  onStartShift: (newShift: Omit<Shift, 'totalFuelSold' | 'totalNetSold' | 'totalNetSales'>) => void;
}

const defaultPumpsList: Pump[] = [
  { id: 'pump-101', name: 'Pump 01', fuelType: 'Petrol 92', tankId: 'tank-petrol92', status: 'Active' },
  { id: 'pump-102', name: 'Pump 02', fuelType: 'Petrol 92', tankId: 'tank-petrol92', status: 'Active' },
  { id: 'pump-103', name: 'Pump 03', fuelType: 'Petrol 95', tankId: 'tank-petrol95', status: 'Active' },
  { id: 'pump-104', name: 'Pump 04', fuelType: 'Petrol 95', tankId: 'tank-petrol95', status: 'Active' },
  { id: 'pump-105', name: 'Pump 05', fuelType: 'Auto Diesel', tankId: 'tank-autodiesel', status: 'Active' },
  { id: 'pump-106', name: 'Pump 06', fuelType: 'Auto Diesel', tankId: 'tank-autodiesel', status: 'Active' },
  { id: 'pump-107', name: 'Pump 07', fuelType: 'Super Diesel', tankId: 'tank-superdiesel', status: 'Active' },
  { id: 'pump-108', name: 'Pump 08', fuelType: 'Super Diesel', tankId: 'tank-superdiesel', status: 'Active' },
  { id: 'pump-oil-bay', name: 'Oil & Lubricants Bay', fuelType: 'Oil & Lubricants', tankId: '', status: 'Active' }
];

export default function ShiftManagementTab({
  employees,
  tanks,
  setTanks,
  pumps,
  setPumps,
  activeShift,
  setActiveShift,
  shiftHistory,
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

  // Debounce timer store for remote database syncing
  const debounceTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Mid-Shift Handover & Cash Collection state
  const [initialPumperCash, setInitialPumperCash] = useState<number | ''>(0);
  const [replacementPumperCash, setReplacementPumperCash] = useState<number | ''>(0);
  const [replacementPumperId, setReplacementPumperId] = useState<string>('');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  // Pump Transfer / Handover Modal State
  const [handoverPumpModal, setHandoverPumpModal] = useState<PumpReading | null>(null);
  const [modalHandoverMeter, setModalHandoverMeter] = useState<number | ''>(0);
  const [modalReplacementPumperId, setModalReplacementPumperId] = useState<string>('');
  const [modalOutgoingCash, setModalOutgoingCash] = useState<number | ''>(0);
  const [modalHandoverNotes, setModalHandoverNotes] = useState<string>('');

  // Handover Modal handlers
  const handleOpenHandoverModal = (reading: PumpReading) => {
    setHandoverPumpModal(reading);
    const fuelPrice = getPriceForFuelType(reading.fuelType);
    const currentEnd = reading.endMeter > reading.startMeter ? reading.endMeter : reading.startMeter;
    setModalHandoverMeter(currentEnd);
    
    const handoverLiters = Math.max(0, currentEnd - reading.startMeter);
    const netLiters = Math.max(0, handoverLiters - reading.testingQty);
    const defaultCash = netLiters * fuelPrice;
    setModalOutgoingCash(defaultCash);
    
    setModalReplacementPumperId(reading.replacementPumperId || '');
    setModalHandoverNotes(reading.handoverNotes || '');
  };

  const handleConfirmHandover = () => {
    if (!handoverPumpModal || !activeShift) return;

    const hMeter = Number(modalHandoverMeter) || 0;
    if (hMeter < handoverPumpModal.startMeter) {
      setToastMessage(`Validation Error: Handover meter (${hMeter} L) cannot be less than Start meter (${handoverPumpModal.startMeter} L).`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (!modalReplacementPumperId) {
      setToastMessage(`Validation Error: Please select a replacement pumper.`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const outgoingCash = Number(modalOutgoingCash) || 0;

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === handoverPumpModal.pumpId) {
        return {
          ...dr,
          replacementPumperId: modalReplacementPumperId,
          handoverMeter: hMeter,
          initialPumperCash: outgoingCash,
          handoverNotes: modalHandoverNotes,
          assignedPumperId: modalReplacementPumperId
        };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

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
      totalNetSales: totalSales,
      initialPumperCash: (activeShift.initialPumperCash || 0) + outgoingCash,
      replacementPumperId: modalReplacementPumperId
    });

    const replacementPumperName = employees.find(e => e.id === modalReplacementPumperId)?.name || 'Replacement Pumper';
    setToastMessage(`Mid-shift transfer recorded for ${handoverPumpModal.pumpName}! Replacement Pumper: ${replacementPumperName}`);
    setTimeout(() => setToastMessage(null), 4000);

    setHandoverPumpModal(null);
  };
  
  // Track settled pumpers per active shift
  const [settledPumperIds, setSettledPumperIds] = useState<Record<string, boolean>>({});

  // Sync draft states when activeShift changes
  React.useEffect(() => {
    if (activeShift) {
      const availablePumpsList = (pumps && pumps.length > 0) ? pumps : defaultPumpsList;
      const availablePumps = availablePumpsList.some(p => p.id === 'pump-oil-bay')
        ? availablePumpsList
        : [...availablePumpsList, { id: 'pump-oil-bay', name: 'Oil & Lubricants Bay', fuelType: 'Oil & Lubricants' as FuelType, tankId: '', status: 'Active' }];
      const currentReadings = activeShift.pumpReadings || [];
      const readingMap = new Map(currentReadings.map(r => [r.pumpId, r]));

      const ensuredReadings: PumpReading[] = availablePumps.map(p => {
        if (readingMap.has(p.id)) {
          return readingMap.get(p.id)!;
        }
        const carryForward = getPreviousEndMeterForPump(p.id);
        const tank = tanks.find(t => t.id === p.tankId || t.fuelType === p.fuelType);
        return {
          pumpId: p.id,
          pumpName: p.name,
          fuelType: p.fuelType,
          tankId: p.tankId || tank?.id || '',
          assignedPumperId: null,
          startMeter: carryForward,
          endMeter: 0,
          testingQty: 0,
          status: 'Idle',
          isLocked: false,
          unitPrice: tank ? tank.pricePerLiter : 355
        };
      });

      setDraftReadings(ensuredReadings);
      setDraftSupervisorId(activeShift.supervisorId);
      setDraftShiftName(activeShift.name);
      setDraftStartTime(activeShift.startTime);
      setInitialPumperCash(activeShift.initialPumperCash !== undefined ? activeShift.initialPumperCash : 0);
      setReplacementPumperCash(activeShift.replacementPumperCash !== undefined ? activeShift.replacementPumperCash : 0);
      setReplacementPumperId(activeShift.replacementPumperId || '');
      setHandoverNotes(activeShift.handoverNotes || '');
      
      const stored = localStorage.getItem(`fuelflow_settled_pumpers_${activeShift.id}`);
      setSettledPumperIds(stored ? JSON.parse(stored) : {});
    } else {
      setDraftReadings([]);
      setDraftSupervisorId('');
      setDraftShiftName('');
      setDraftStartTime('');
      setInitialPumperCash(0);
      setReplacementPumperCash(0);
      setReplacementPumperId('');
      setHandoverNotes('');
      setSettledPumperIds({});
    }
  }, [activeShift, pumps, tanks]);

  // Fetch latest recorded end meters for pumps from Supabase for automatic start meter carryover
  const [supabaseLatestMeters, setSupabaseLatestMeters] = React.useState<Record<string, number>>({});
  
  // Closed shifts fetched from Supabase & local history for the Shift Ledger
  const [closedLedgerShifts, setClosedLedgerShifts] = useState<any[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  React.useEffect(() => {
    const fetchClosedShiftsFromSupabase = async () => {
      setIsLoadingLedger(true);
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      let fetched: any[] = [];

      if (isConfigured) {
        try {
          const { data, error } = await supabase
            .from('shifts')
            .select(`
              *,
              pumpReadings:pump_readings(*)
            `)
            .eq('isactive', false)
            .order('starttime', { ascending: false });

          if (data && !error && data.length > 0) {
            fetched = data.map((s: any) => ({
              id: s.id,
              name: s.name,
              supervisorId: s.supervisorid,
              supervisorName: employees.find(e => e.id === s.supervisorid)?.name || 'Unassigned',
              startTime: s.starttime,
              endTime: s.endtime,
              isActive: s.isactive,
              totalFuelSold: s.totalfuelsold || 0,
              totalNetSold: s.totalnetsold || 0,
              totalNetSales: s.totalnetsales || 0,
              initialPumperCash: s.initialpumpercash || s.initialPumperCash || 0,
              replacementPumperCash: s.replacementpumpercash || s.replacementPumperCash || 0,
              totalPhysicalCash: s.totalphysicalcash || s.totalPhysicalCash || 0,
              cashVariance: s.cashvariance !== undefined ? s.cashvariance : s.cashVariance,
              handoverNotes: s.handovernotes || s.handoverNotes || '',
              replacementPumperId: s.replacementpumperid || s.replacementPumperId || '',
              pumpReadings: (s.pumpReadings || []).map((r: any) => ({
                pumpId: r.pump_id || r.pumpid,
                pumpName: r.pump_name || r.pumpname,
                fuelType: r.fuel_type || r.fueltype,
                tankId: r.tank_id || r.tankid,
                assignedPumperId: r.assigned_pumper_id || r.assignedpumperid,
                startMeter: Number(r.start_meter !== undefined ? r.start_meter : r.startmeter) || 0,
                endMeter: Number(r.end_meter !== undefined ? r.end_meter : r.endmeter) || 0,
                testingQty: Number(r.testing_qty !== undefined ? r.testing_qty : r.testingqty) || 0,
                status: r.status,
                isLocked: r.is_locked !== undefined ? r.is_locked : r.islocked,
                unitPrice: Number(r.unit_price || r.unitprice) || 0,
                actualCash: Number(r.actual_cash ?? r.actualcash) || 0,
                cashVariance: Number(r.cash_variance ?? r.cashvariance) || 0,
                creditSalesAmount: Number(r.credit_sales_amount ?? r.creditsalesamount) || 0,
                cardSalesAmount: Number(r.card_sales_amount ?? r.cardsalesamount) || 0,
                oilSalesAmount: Number(r.oil_sales_amount ?? r.oilsalesamount) || 0,
                totalDispensed: Math.max(0, (Number(r.end_meter ?? r.endmeter) || 0) - (Number(r.start_meter ?? r.startmeter) || 0)),
                netSales: Math.max(0, ((Number(r.end_meter ?? r.endmeter) || 0) - (Number(r.start_meter ?? r.startmeter) || 0) - (Number(r.testing_qty ?? r.testingqty) || 0))) * (Number(r.unit_price || r.unitprice) || 0)
              }))
            }));
          }
        } catch (err) {
          console.warn("Notice: Error loading closed shifts from Supabase:", err);
        }
      }

      // Merge with shiftHistory prop and local storage
      const localHistory: any[] = (() => {
        try {
          return JSON.parse(localStorage.getItem('fms_shiftHistory') || localStorage.getItem('fuelflow_history') || '[]');
        } catch (e) {
          return [];
        }
      })();

      const combinedMap = new Map<string, any>();
      (shiftHistory || []).forEach(s => {
        if (!s.isActive) combinedMap.set(s.id, s);
      });
      localHistory.forEach(s => {
        if (!s.isActive && !combinedMap.has(s.id)) combinedMap.set(s.id, s);
      });
      fetched.forEach(s => {
        combinedMap.set(s.id, s);
      });

      const list = Array.from(combinedMap.values()).sort((a, b) => {
        const tA = new Date(b.startTime || b.endTime || 0).getTime();
        const tB = new Date(a.startTime || a.endTime || 0).getTime();
        return tA - tB;
      });

      setClosedLedgerShifts(list);
      setIsLoadingLedger(false);
    };

    fetchClosedShiftsFromSupabase();
  }, [activeShift, shiftHistory, employees]);

  React.useEffect(() => {
    const fetchLatestReadingsFromSupabase = async () => {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!isConfigured) return;

      try {
        const { data, error } = await supabase
          .from('pump_readings')
          .select('pumpid, endmeter')
          .order('id', { ascending: false });

        if (data && data.length > 0) {
          const metersMap: Record<string, number> = {};
          data.forEach((row: any) => {
            const pid = row.pumpid || row.pumpId;
            const endM = row.endmeter !== undefined ? row.endmeter : row.endMeter;
            if (pid && endM !== undefined && endM !== null && !metersMap[pid]) {
              metersMap[pid] = Number(endM);
            }
          });
          setSupabaseLatestMeters(metersMap);
        }
      } catch (err) {
        console.warn("Notice: Could not fetch latest pump readings from Supabase:", err);
      }
    };

    fetchLatestReadingsFromSupabase();
  }, []);

  // Helper: Retrieve previous shift's recorded endmeter for a given pump
  const getPreviousEndMeterForPump = (pumpId: string): number => {
    // 1. Check activeShift if it exists
    if (activeShift?.pumpReadings) {
      const reading = activeShift.pumpReadings.find(pr => pr.pumpId === pumpId);
      if (reading && reading.endMeter > 0) {
        return reading.endMeter;
      }
    }

    // 2. Check supabaseLatestMeters map
    if (supabaseLatestMeters[pumpId] !== undefined && supabaseLatestMeters[pumpId] > 0) {
      return supabaseLatestMeters[pumpId];
    }

    // 3. Check shiftHistory array passed in props
    const historyToSearch = shiftHistory || [];
    for (const shift of historyToSearch) {
      if (shift.pumpReadings) {
        const reading = shift.pumpReadings.find(pr => pr.pumpId === pumpId);
        if (reading && reading.endMeter !== undefined && reading.endMeter !== null && reading.endMeter > 0) {
          return reading.endMeter;
        }
      }
    }

    // 4. Check fms_shiftHistory & fuelflow_history in localStorage
    try {
      const keys = ['fms_shiftHistory', 'fuelflow_history'];
      for (const k of keys) {
        const savedStr = localStorage.getItem(k);
        if (savedStr) {
          const history: Shift[] = JSON.parse(savedStr);
          for (const shift of history) {
            if (shift.pumpReadings) {
              const reading = shift.pumpReadings.find((pr: any) => (pr.pumpId || pr.pumpid) === pumpId);
              const endM = reading ? (reading.endMeter !== undefined ? reading.endMeter : (reading as any).endmeter) : null;
              if (endM !== null && endM !== undefined && Number(endM) > 0) {
                return Number(endM);
              }
            }
          }
        }
      }
    } catch (e) {}

    return 0;
  };

  // No unsaved changes since all edits are auto-saved in real-time to activeShift
  const hasUnsavedChanges = false;

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationOverlay, setShowValidationOverlay] = useState(false);

  // Filtered employees list
  const supervisors = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const filtered = employees.filter(e => e.role?.toLowerCase() === 'supervisor');
    return filtered.length > 0 ? filtered : employees;
  }, [employees]);

  const pumpers = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const filtered = employees.filter(e => e.role?.toLowerCase() === 'pumper');
    return filtered.length > 0 ? filtered : employees;
  }, [employees]);

  // Read currency symbol from settings/localStorage
  // Format currency/liters helper
  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' L';
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  const getPriceForFuelType = (type: string) => {
    if (type === 'Oil & Lubricants') return 0;
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
      return { runningPumps: 0, totalFuelSold: 0, totalNetSold: 0, totalFuelSales: 0, totalOilSales: 0, totalNetSales: 0 };
    }
    
    let runningPumps = 0;
    let totalFuelSold = 0;
    let totalNetSold = 0;
    let totalFuelSales = 0;
    let totalOilSales = 0;

    draftReadings.forEach(r => {
      if (r.assignedPumperId) {
        runningPumps++;
      }
      const fuelSold = Math.max(0, r.endMeter - r.startMeter);
      const netSold = Math.max(0, fuelSold - r.testingQty);
      const rate = getPriceForFuelType(r.fuelType);
      const fuelRev = netSold * rate;
      const oilRev = r.oilSalesAmount || 0;
      
      totalFuelSold += fuelSold;
      totalNetSold += netSold;
      totalFuelSales += fuelRev;
      totalOilSales += oilRev;
    });

    const totalNetSales = totalFuelSales + totalOilSales;

    return {
      runningPumps,
      totalFuelSold,
      totalNetSold,
      totalFuelSales,
      totalOilSales,
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

  // Filter pumpers assigned to 2 or more active/draft pumps for multi-pump consolidation
  const multiPumpersData = useMemo(() => {
    return activePumpersData.filter(p => p.readings.length >= 2);
  }, [activePumpersData]);

  // Compute consolidated totals for ALL active pumpers (whether 1 or multiple pumps)
  const allPumperStats = useMemo(() => {
    return activePumpersData.map(pumper => {
      let totalGrossRevenue = 0;
      let totalFuelRevenue = 0;
      let totalOilSales = 0;
      let totalNetLiters = 0;
      let totalCreditSales = 0;
      let totalCardSales = 0;
      let totalNetExpCash = 0;
      let totalActualCash = 0;

      pumper.readings.forEach(r => {
        const fuelPrice = getPriceForFuelType(r.fuelType);
        const fuelSold = Math.max(0, r.endMeter - r.startMeter);
        const netSold = Math.max(0, fuelSold - r.testingQty);
        const grossFuelRev = netSold * fuelPrice;
        const oilSales = r.oilSalesAmount || 0;
        const grossTotalRev = grossFuelRev + oilSales;
        const creditVal = r.creditSalesAmount || 0;
        const cardVal = r.cardSalesAmount || 0;
        const netExp = Math.max(0, grossTotalRev - (creditVal + cardVal));
        const actCash = r.actualCash || 0;

        totalFuelRevenue += grossFuelRev;
        totalOilSales += oilSales;
        totalGrossRevenue += grossTotalRev;
        totalNetLiters += netSold;
        totalCreditSales += creditVal;
        totalCardSales += cardVal;
        totalNetExpCash += netExp;
        totalActualCash += actCash;
      });

      const totalCashVariance = totalActualCash - totalNetExpCash;

      return {
        ...pumper,
        totalGrossRevenue,
        totalFuelRevenue,
        totalOilSales,
        totalNetLiters,
        totalCreditSales,
        totalCardSales,
        totalNetExpCash,
        totalActualCash,
        totalCashVariance,
        overallVariance: totalCashVariance
      };
    });
  }, [activePumpersData, activeShift, tanks]);

  // Alias pumperStats for widget rendering
  const pumperStats = allPumperStats;

  // Handle consolidated single cash handover entry for multi-pump assigned pumper
  const handleUpdateConsolidatedCashForPumper = (pumperId: string, newTotalCash: number) => {
    if (!activeShift) return;

    const pumperReadings = draftReadings.filter(r => r.assignedPumperId === pumperId);
    if (pumperReadings.length === 0) return;

    const pumpData = pumperReadings.map(r => {
      const fuelPrice = getPriceForFuelType(r.fuelType);
      const fuelSold = Math.max(0, r.endMeter - r.startMeter);
      const netSold = Math.max(0, fuelSold - r.testingQty);
      const grossFuelRev = netSold * fuelPrice;
      const oilSales = r.oilSalesAmount || 0;
      const grossTotalRev = grossFuelRev + oilSales;
      const creditVal = r.creditSalesAmount || 0;
      const cardVal = r.cardSalesAmount || 0;
      const netExpCash = Math.max(0, grossTotalRev - (creditVal + cardVal));
      return { pumpId: r.pumpId, netExpCash, status: r.status };
    });

    const totalNetExpCash = pumpData.reduce((acc, p) => acc + p.netExpCash, 0);

    let allocatedSoFar = 0;
    const newCashPerPump: Record<string, number> = {};

    pumpData.forEach((p, idx) => {
      if (idx === pumpData.length - 1) {
        newCashPerPump[p.pumpId] = Math.max(0, Math.round((newTotalCash - allocatedSoFar) * 100) / 100);
      } else {
        let allocated = 0;
        if (totalNetExpCash > 0) {
          allocated = Math.round((p.netExpCash / totalNetExpCash) * newTotalCash * 100) / 100;
        } else {
          allocated = Math.round((newTotalCash / pumpData.length) * 100) / 100;
        }
        newCashPerPump[p.pumpId] = allocated;
        allocatedSoFar += allocated;
      }
    });

    const updatedReadings = draftReadings.map(r => {
      if (r.assignedPumperId === pumperId && newCashPerPump[r.pumpId] !== undefined) {
        if (r.status === 'Completed') return r; // preserve locked pump status

        const actCash = newCashPerPump[r.pumpId];
        const fuelPrice = getPriceForFuelType(r.fuelType);
        const fuelSold = Math.max(0, r.endMeter - r.startMeter);
        const netSold = Math.max(0, fuelSold - r.testingQty);
        const grossFuelRev = netSold * fuelPrice;
        const oilSales = r.oilSalesAmount || 0;
        const grossTotalRev = grossFuelRev + oilSales;
        const creditVal = r.creditSalesAmount || 0;
        const cardVal = r.cardSalesAmount || 0;
        const netExpCash = Math.max(0, grossTotalRev - (creditVal + cardVal));
        const computedVariance = actCash - netExpCash;

        return {
          ...r,
          actualCash: actCash,
          cashVariance: computedVariance
        };
      }
      return r;
    });

    setDraftReadings(updatedReadings);

    // Sync activeShift
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

  // Handle live updates to a specific pump's readings in local draft state
  const handleUpdateReading = (
    pumpId: string,
    field: 'assignedPumperId' | 'startMeter' | 'endMeter' | 'testingQty' | 'actualCash' | 'creditSalesAmount' | 'cardSalesAmount' | 'oilSalesAmount',
    value: any
  ) => {
    if (!activeShift) return;

    const updatedReadings = draftReadings.map(r => {
      if (r.pumpId === pumpId) {
        // Block editing if completed
        if (r.status === 'Completed') {
          return r;
        }

        const fuelPrice = getPriceForFuelType(r.fuelType);
        const startM = field === 'startMeter' ? (parseFloat(value) || 0) : r.startMeter;
        const endM = field === 'endMeter' ? (parseFloat(value) || 0) : r.endMeter;
        const testQ = field === 'testingQty' ? (parseFloat(value) || 0) : r.testingQty;
        const creditVal = field === 'creditSalesAmount' ? (parseFloat(value) || 0) : (r.creditSalesAmount ?? 0);
        const cardVal = field === 'cardSalesAmount' ? (parseFloat(value) || 0) : (r.cardSalesAmount ?? 0);
        const oilVal = field === 'oilSalesAmount' ? (parseFloat(value) || 0) : (r.oilSalesAmount ?? 0);
        const actCash = field === 'actualCash' ? (parseFloat(value) || 0) : (r.actualCash ?? 0);

        const fuelSold = Math.max(0, endM - startM);
        const netSold = Math.max(0, fuelSold - testQ);
        const grossFuelRevenue = netSold * fuelPrice;
        const totalGrossRevenue = grossFuelRevenue + oilVal;
        const netExpectedCash = Math.max(0, totalGrossRevenue - (creditVal + cardVal));
        const computedVariance = actCash - netExpectedCash;

        const updated = {
          ...r,
          [field]: value,
          creditSalesAmount: creditVal,
          cardSalesAmount: cardVal,
          oilSalesAmount: oilVal,
          actualCash: actCash,
          cashVariance: computedVariance
        };

        // Debounce Supabase remote sync calls (500ms) to prevent database call spamming on every keystroke
        const syncKey = `${pumpId}_sync`;
        if (debounceTimersRef.current[syncKey]) {
          clearTimeout(debounceTimersRef.current[syncKey]);
        }

        debounceTimersRef.current[syncKey] = setTimeout(() => {
          if (field === 'creditSalesAmount' && creditVal > 0) {
            saveCreditSale(supabase, {
              shift_id: activeShift.id,
              pump_id: pumpId,
              customer_name: 'Credit Customer',
              fuel_type: r.fuelType || 'Fuel',
              liters: netSold,
              amount: Number(creditVal),
              status: 'Approved'
            });
          }

          if (field === 'cardSalesAmount' && cardVal > 0) {
            saveCardSale(supabase, {
              shift_id: activeShift.id,
              pump_id: pumpId,
              card_type: 'POS Card',
              amount: Number(cardVal),
              status: 'Settled'
            });
          }

          // Direct fallback write to pump_readings table so card_sales_amount & credit_sales_amount are updated
          upsertPumpReadings(supabase, [updated], activeShift.id);
        }, 500);
        
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
        return { 
          ...dr, 
          endMeter: dr.endMeter || 0,
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

  // Dynamically update a pump's target underground storage tank mapping
  const handleUpdatePumpTankMapping = (pumpId: string, newTankId: string) => {
    const selectedTank = tanks.find(t => t.id === newTankId);
    if (!selectedTank) return;

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === pumpId) {
        return {
          ...dr,
          tankId: newTankId,
          fuelType: selectedTank.fuelType
        };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

    if (activeShift) {
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
    }

    if (setPumps) {
      setPumps(prev => prev.map(p => {
        if (p.id === pumpId) {
          return {
            ...p,
            tankId: newTankId,
            fuelType: selectedTank.fuelType
          };
        }
        return p;
      }));
    }

    setToastMessage(`Pump ${pumpId} successfully mapped to ${selectedTank.name} (${selectedTank.fuelType})`);
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

    // Add back the stock to the corresponding target tank since we are unlocking a completed shift
    if (r.status === 'Completed' && setTanks) {
       const grossSold = r.endMeter - r.startMeter;
       const netSold = Math.max(0, grossSold - r.testingQty);
       if (netSold > 0) {
         const targetTankId = r.tankId || (tanks.find(t => t.fuelType === r.fuelType)?.id);
         setTanks(prevTanks => prevTanks.map(tank => {
           if (tank.id === targetTankId || (!r.tankId && tank.fuelType === r.fuelType)) {
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

    const isOilBay = r.pumpId === 'pump-oil-bay' || r.fuelType === 'Oil & Lubricants' || r.pumpName.toLowerCase().includes('oil');

    const errors: string[] = [];
    if (!isOilBay) {
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
    } else {
      if ((r.oilSalesAmount ?? 0) < 0) {
        errors.push("Oil & Lubricants sales amount cannot be negative.");
      }
    }

    if (errors.length > 0) {
      setToastMessage(`Validation Error: ${errors[0]}`);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const updatedReadings = draftReadings.map(dr => {
      if (dr.pumpId === pumpId) {
        const price = getPriceForFuelType(dr.fuelType);
        const fuel = Math.max(0, dr.endMeter - dr.startMeter);
        const net = Math.max(0, fuel - dr.testingQty);
        const grossRev = net * price;
        const creditVal = dr.creditSalesAmount ?? 0;
        const cardVal = dr.cardSalesAmount ?? 0;
        const netExpCash = Math.max(0, grossRev - (creditVal + cardVal));
        const actCash = dr.actualCash ?? 0;
        const pVariance = dr.cashVariance ?? (actCash - netExpCash);

        return { 
          ...dr, 
          isLocked: true, 
          status: 'Completed' as const,
          unitPrice: price,
          creditSalesAmount: creditVal,
          cardSalesAmount: cardVal,
          actualCash: actCash,
          cashVariance: pVariance
        };
      }
      return dr;
    });

    setDraftReadings(updatedReadings);

    // Deduct stock from the corresponding tank immediately
    const grossSold = r.endMeter - r.startMeter;
    const netSold = Math.max(0, grossSold - r.testingQty);
    
    if (setTanks && netSold > 0) {
      const targetTankId = r.tankId || (tanks.find(t => t.fuelType === r.fuelType)?.id);
      setTanks(prevTanks => prevTanks.map(tank => {
        if (tank.id === targetTankId || (!r.tankId && tank.fuelType === r.fuelType)) {
          const newLevel = Math.max(0, tank.currentLevel - netSold);
          // Show low stock warning if dropped below 15%
          if (newLevel <= tank.capacity * 0.15) {
            setTimeout(() => {
              setToastMessage(`⚠️ Warning: ${tank.name} stock is running low (${newLevel.toFixed(0)} L remaining).`);
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
    if (!draftReadings || draftReadings.length === 0) return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return draftReadings;

    return draftReadings.filter(r => {
      const pumperName = r.assignedPumperId 
        ? employees.find(e => e.id === r.assignedPumperId)?.name || '' 
        : 'Unassigned';
      
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

    const pumpsListRaw = (pumps && pumps.length > 0) ? pumps : defaultPumpsList;
    const pumpsList = pumpsListRaw.some(p => p.id === 'pump-oil-bay')
      ? pumpsListRaw
      : [...pumpsListRaw, { id: 'pump-oil-bay', name: 'Oil & Lubricants Bay', fuelType: 'Oil & Lubricants' as FuelType, tankId: '', status: 'Active' }];

    const newPumpReadings: PumpReading[] = pumpsList.map((pump) => {
      // Automatically fetch previous shift's recorded endmeter for each pump
      const carryForwardStart = getPreviousEndMeterForPump(pump.id);

      return {
        pumpId: pump.id,
        pumpName: pump.name,
        fuelType: pump.fuelType,
        tankId: pump.tankId,
        assignedPumperId: null, // start as unassigned
        startMeter: carryForwardStart,
        endMeter: 0, // initially 0 until manually entered
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
    let totalPumpsActualCash = 0;

    const finalReadings = draftReadings.map(r => {
      const fuel = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, fuel - r.testingQty);
      const price = getPriceForFuelType(r.fuelType);
      const grossFuelRev = net * price;
      const oilSales = r.oilSalesAmount ?? 0;
      const totalGrossRev = grossFuelRev + oilSales;
      const creditVal = r.creditSalesAmount ?? 0;
      const cardVal = r.cardSalesAmount ?? 0;
      const netExpCash = Math.max(0, totalGrossRev - (creditVal + cardVal));
      const actCash = r.actualCash ?? 0;
      const pVariance = r.cashVariance ?? (actCash - netExpCash);

      totalFuel += fuel;
      totalNet += net;
      totalSales += totalGrossRev;
      totalPumpsActualCash += actCash;
      
      return {
        ...r,
        status: 'Completed' as const,
        unitPrice: r.unitPrice || price,
        oilSalesAmount: oilSales,
        creditSalesAmount: creditVal,
        cardSalesAmount: cardVal,
        actualCash: actCash,
        cashVariance: pVariance
      };
    });

    const initCash = Number(initialPumperCash) || 0;
    const replCash = Number(replacementPumperCash) || 0;
    const physCash = totalPumpsActualCash > 0 ? totalPumpsActualCash : (initCash + replCash);
    const variance = physCash - totalSales;

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
      totalNetSales: totalSales,
      initialPumperCash: initCash,
      replacementPumperCash: replCash,
      totalPhysicalCash: physCash,
      cashVariance: variance,
      handoverNotes: handoverNotes,
      replacementPumperId: replacementPumperId
    };

    syncCreditAndCardSales(supabase, finalReadings, closedShift.id);

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
    csvContent += "Pump,Fuel Type,Assigned Pumper,Start Meter (L),End Meter (L),Fuel Sold (L),Testing Deducted (L),Net Sold (L),Fuel Price (Per Liter),Fuel Revenue,Oil/Lube Sales,Total Revenue,Credit Sales,Card Sales,Actual Cash\n";

    activeShift.pumpReadings.forEach(r => {
      const pumperName = r.assignedPumperId 
        ? employees.find(e => e.id === r.assignedPumperId)?.name || 'N/A' 
        : 'Unassigned';
      const sold = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, r.endMeter - r.startMeter - r.testingQty);
      const price = getPriceForFuelType(r.fuelType);
      const fuelRev = net * price;
      const oilRev = r.oilSalesAmount || 0;
      const totalRev = fuelRev + oilRev;
      const creditVal = r.creditSalesAmount || 0;
      const cardVal = r.cardSalesAmount || 0;
      const actCash = r.actualCash || 0;

      csvContent += `"${r.pumpName}","${r.fuelType}","${pumperName}",${r.startMeter},${r.endMeter},${sold},${r.testingQty},${net},${price},${fuelRev.toFixed(2)},${oilRev.toFixed(2)},${totalRev.toFixed(2)},${creditVal.toFixed(2)},${cardVal.toFixed(2)},${actCash.toFixed(2)}\n`;
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
    <div id="shift-tab-root" className="space-y-4">
      
      {/* Control Header */}
      <div id="shift-header-section" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 id="shift-title" className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            Shift Management
          </h1>
          <p id="shift-subtitle" className="text-gray-500 text-xs sm:text-sm mt-0.5">
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
                  const isOilBay = r.pumpId === 'pump-oil-bay' || r.fuelType === 'Oil & Lubricants' || r.pumpName.toLowerCase().includes('oil');
                  const fuelPrice = getPriceForFuelType(r.fuelType);
                  const fuelSold = isOilBay ? 0 : Math.max(0, r.endMeter - r.startMeter);
                  const netSold = isOilBay ? 0 : Math.max(0, fuelSold - r.testingQty);
                  const expectedCash = isOilBay ? (r.oilSalesAmount || 0) : (netSold * fuelPrice);

                  // Styling theme per fuel type
                  const isPetrol = r.fuelType.includes('Petrol');
                  const themeClasses = isOilBay
                    ? { header: 'bg-amber-500/10 border-l-4 border-amber-500', text: 'text-amber-600' }
                    : r.fuelType === 'Petrol 92'
                    ? { header: 'bg-blue-500/10 border-l-4 border-blue-500', text: 'text-blue-600' }
                    : r.fuelType === 'Petrol 95'
                    ? { header: 'bg-purple-500/10 border-l-4 border-purple-500', text: 'text-purple-400' }
                    : r.fuelType === 'Auto Diesel'
                    ? { header: 'bg-amber-500/10 border-l-4 border-amber-500', text: 'text-amber-400' }
                    : { header: 'bg-emerald-500/10 border-l-4 border-emerald-500', text: 'text-emerald-400' };

                  const initialPumper = employees.find(e => e.id === r.assignedPumperId);
                  const replacementPumper = employees.find(e => e.id === r.replacementPumperId);

                  return (
                    <div 
                      key={r.pumpId} 
                      className={`glass-panel rounded-2xl transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                        r.status === 'Completed' 
                          ? 'border-emerald-500/30 shadow-emerald-500/5 bg-emerald-500/5' 
                          : r.status === 'Active'
                          ? isOilBay ? 'border-amber-500/30 shadow-amber-500/5 bg-amber-500/5' : 'border-blue-500/30 shadow-blue-500/5 bg-blue-500/5'
                          : 'hover:border-blue-500/20 hover:shadow-[0_0_15px_rgba(0,123,255,0.15)]'
                      }`}
                    >
                      {/* Card Header with Pump and Fuel Info */}
                      <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${themeClasses.header}`}>
                        <div>
                          <h4 className="font-extrabold text-[#1C1C1C] text-sm flex items-center gap-1.5">
                            {isOilBay && <Package className="w-4 h-4 text-amber-600 shrink-0" />}
                            <span>{r.pumpName}</span>
                            {r.status === 'Completed' ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/25 text-emerald-700 border border-emerald-500/35 text-[9px] font-extrabold uppercase rounded-md shadow-xs">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>{isOilBay ? 'Bay Closed / Locked' : 'Shift Completed / Locked'}</span>
                              </span>
                            ) : r.status === 'Active' ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/25 text-amber-700 border border-amber-500/35 text-[9px] font-extrabold uppercase rounded-md shadow-xs animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                <span>{isOilBay ? 'Bay Active / In Progress' : 'Pump Active / In Progress'}</span>
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
                            {isOilBay ? 'Oil & Lubricants' : r.fuelType}
                          </span>
                          {!isOilBay && (
                            <span className="block text-[9px] text-gray-500 tabular-nums font-semibold mt-0.5">
                              Price: {formatCurrency(fuelPrice)}/L
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Inputs body */}
                      <div className="p-4 space-y-3.5">
                        {/* Pumper Assignment Selector */}
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1 uppercase tracking-wider">
                            Assigned Pumper
                          </label>
                          <select
                            value={r.assignedPumperId || ''}
                            disabled={r.status !== 'Idle'}
                            onChange={(e) => handleUpdateReading(r.pumpId, 'assignedPumperId', e.target.value || null)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-xs focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-100 font-medium"
                          >
                            <option value="">-- Unassigned (Idle) --</option>
                            {pumpers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Mid-shift transfer status badge if active */}
                        {r.replacementPumperId && (
                          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/80 text-[11px] space-y-1">
                            <div className="flex justify-between items-center text-blue-900 font-bold">
                              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                                <RefreshCw className="w-3 h-3 text-blue-600" /> Handover Transfer
                              </span>
                              <span className="tabular-nums text-blue-700 font-extrabold text-[10px]">
                                {isOilBay ? `Sales at Transfer: ${formatCurrency(r.oilSalesAmount || 0)}` : `Meter: ${r.handoverMeter?.toFixed(2) || '0.00'} L`}
                              </span>
                            </div>
                            <div className="text-gray-600 flex justify-between text-[10px]">
                              <span>Outgoing Cash:</span>
                              <span className="font-bold text-gray-800 tabular-nums">{formatCurrency(r.initialPumperCash || 0)}</span>
                            </div>
                            {r.handoverNotes && (
                              <div className="text-[10px] text-gray-500 italic truncate">
                                "{r.handoverNotes}"
                              </div>
                            )}
                          </div>
                        )}

                        {isOilBay ? (
                          /* Dedicated Oil & Lubricant Bay Inputs */
                          <div className="space-y-2.5">
                            <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Oil & Lube Sales Entry</span>
                                </span>
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                                  Virtual Bay
                                </span>
                              </div>

                              {/* Primary Sales Entry: Total Oil Sales (Rs.) */}
                              <div>
                                <label className="text-[10px] font-extrabold text-gray-700 block mb-1 uppercase tracking-wider flex items-center justify-between">
                                  <span>Total Oil / Lube Sales (Rs.)</span>
                                  {r.status !== 'Completed' && <Edit2 className="w-2.5 h-2.5 text-amber-600" />}
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.oilSalesAmount ?? 0}
                                    disabled={r.status === 'Completed'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'oilSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 bg-white border border-amber-300 text-[#1C1C1C] rounded-xl text-xs sm:text-sm tabular-nums font-extrabold text-right focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Non-Cash Collections Section */}
                            <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl space-y-2">
                              <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider block">
                                Oil Bay Non-Cash Collections
                              </span>
                              
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-gray-600 flex-1 min-w-0">
                                  Credit Sales (Rs.)
                                </label>
                                <div className="w-28 sm:w-32">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.creditSalesAmount ?? 0}
                                    disabled={r.status === 'Completed'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'creditSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-extrabold text-right focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-gray-600 flex-1 min-w-0">
                                  Card Sales (Rs.)
                                </label>
                                <div className="w-28 sm:w-32">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.cardSalesAmount ?? 0}
                                    disabled={r.status === 'Completed'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'cardSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-extrabold text-right focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Standard Fuel Pump Inputs Grid */
                          <div className="space-y-2.5">
                            {/* Start Meter & End Meter prominent 2-column layout for maximum digit width */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[10px] font-extrabold text-gray-500 block mb-1 uppercase tracking-wider flex items-center justify-between">
                                  <span>Start Meter</span>
                                  {r.status !== 'Idle' && <Lock className="w-2.5 h-2.5 text-gray-400" />}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={r.startMeter ?? 0}
                                  disabled={r.status !== 'Idle'}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateReading(r.pumpId, 'startMeter', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-xs sm:text-sm tabular-nums font-extrabold text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-extrabold text-gray-500 block mb-1 uppercase tracking-wider flex items-center justify-between">
                                  <span>End Meter</span>
                                  {r.status === 'Active' && <Edit2 className="w-2.5 h-2.5 text-blue-500" />}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={r.endMeter ?? 0}
                                  disabled={r.status !== 'Active'}
                                  placeholder="0.000"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateReading(r.pumpId, 'endMeter', parseFloat(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-xs sm:text-sm tabular-nums font-extrabold text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                />
                              </div>
                            </div>

                            {/* Calibration Test (Testing Qty) field */}
                            <div className="flex items-center justify-between bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100 gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                                  Calibration Test (L)
                                </span>
                              </div>
                              <div className="w-28 sm:w-32">
                                <input
                                  type="number"
                                  step="any"
                                  value={r.testingQty ?? 0}
                                  disabled={r.status !== 'Active'}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateReading(r.pumpId, 'testingQty', parseFloat(e.target.value) || 0)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs sm:text-sm tabular-nums font-bold text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>

                            {/* Engine Oil / Lubricant Sales Section */}
                            <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider block flex items-center gap-1">
                                <Package className="w-3 h-3 text-amber-600" />
                                <span>Engine Oil / Lubricant Sales</span>
                              </span>
                              
                              {/* Oil/Lube Sales (Rs.) */}
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-gray-700 flex-1 min-w-0">
                                  Oil/Lube Sales (Rs.)
                                </label>
                                <div className="w-28 sm:w-32">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.oilSalesAmount ?? 0}
                                    disabled={r.status !== 'Active'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'oilSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 bg-white border border-amber-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-extrabold text-right focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Pumper Non-Cash Collections: Credit Sales and Card Sales */}
                            <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl space-y-2">
                              <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider block">
                                Pumper Non-Cash Collections
                              </span>
                              
                              {/* Credit Sales (Rs.) */}
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-gray-600 flex-1 min-w-0">
                                  Credit Sales (Rs.)
                                </label>
                                <div className="w-28 sm:w-32">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.creditSalesAmount ?? 0}
                                    disabled={r.status !== 'Active'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'creditSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-extrabold text-right focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>

                              {/* Card Sales (Rs.) */}
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-gray-600 flex-1 min-w-0">
                                  Card Sales (Rs.)
                                </label>
                                <div className="w-28 sm:w-32">
                                  <input
                                    type="number"
                                    step="any"
                                    value={r.cardSalesAmount ?? 0}
                                    disabled={r.status !== 'Active'}
                                    placeholder="0.00"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleUpdateReading(r.pumpId, 'cardSalesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2.5 py-1 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs tabular-nums font-extrabold text-right focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Visual calculations feed & Cash breakdown */}
                        {(() => {
                          if (isOilBay) {
                            const oilSalesAmount = r.oilSalesAmount || 0;
                            const creditSalesAmount = r.creditSalesAmount || 0;
                            const cardSalesAmount = r.cardSalesAmount || 0;
                            const netPhysicalCashDue = Math.max(0, oilSalesAmount - (creditSalesAmount + cardSalesAmount));

                            return (
                              <div className={`p-3 rounded-xl text-[11px] space-y-1.5 font-sans border transition-colors ${
                                r.status === 'Completed'
                                  ? 'bg-emerald-500/10 border-emerald-500/20'
                                  : r.status === 'Active'
                                  ? 'bg-amber-500/10 border-amber-500/20'
                                  : 'bg-gray-50 border-gray-100'
                              }`}>
                                <div className="flex justify-between font-extrabold text-amber-900">
                                  <span>Total Oil Revenue:</span>
                                  <span className="tabular-nums font-extrabold text-amber-700">{formatCurrency(oilSalesAmount)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                  <span>(-) Credit Sales:</span>
                                  <span className="tabular-nums font-semibold text-purple-600">-{formatCurrency(creditSalesAmount)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                  <span>(-) Card Payments:</span>
                                  <span className="tabular-nums font-semibold text-indigo-600">-{formatCurrency(cardSalesAmount)}</span>
                                </div>
                                <hr className="border-gray-200/80 my-1" />
                                <div className="flex justify-between font-extrabold text-[#1C1C1C]">
                                  <span>= Net Physical Cash Due:</span>
                                  <span className="tabular-nums text-blue-600">{formatCurrency(netPhysicalCashDue)}</span>
                                </div>
                              </div>
                            );
                          }

                          const grossFuelRevenue = netSold * fuelPrice;
                          const oilSalesAmount = r.oilSalesAmount || 0;
                          const totalGrossRevenue = grossFuelRevenue + oilSalesAmount;
                          const creditSalesAmount = r.creditSalesAmount || 0;
                          const cardSalesAmount = r.cardSalesAmount || 0;
                          const netPhysicalCashDue = Math.max(0, totalGrossRevenue - (creditSalesAmount + cardSalesAmount));

                          return (
                            <div className={`p-3 rounded-xl text-[11px] space-y-1.5 font-sans border transition-colors ${
                              r.status === 'Completed'
                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                : r.status === 'Active'
                                ? 'bg-blue-500/10 border-blue-500/20'
                                : 'bg-gray-50 border-gray-100'
                            }`}>
                              <div className="flex justify-between text-gray-500">
                                <span>Gross Fuel Liters:</span>
                                <span className="tabular-nums font-semibold text-gray-600">{fuelSold.toFixed(2)} L</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>Calibration Test:</span>
                                <span className="tabular-nums font-semibold text-red-400">-{r.testingQty.toFixed(1)} L</span>
                              </div>
                              <div className="flex justify-between font-bold text-gray-700">
                                <span>Net Fuel Sold:</span>
                                <span className="tabular-nums text-gray-900">{netSold.toFixed(2)} L</span>
                              </div>
                              <hr className="border-gray-200/60 my-1" />
                              <div className="flex justify-between text-gray-600 font-medium">
                                <span>Fuel Revenue:</span>
                                <span className="tabular-nums font-bold text-gray-800">{formatCurrency(grossFuelRevenue)}</span>
                              </div>
                              <div className="flex justify-between text-amber-700 font-semibold">
                                <span>(+) Oil/Lube Sales:</span>
                                <span className="tabular-nums font-bold text-amber-600">+{formatCurrency(oilSalesAmount)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>(-) Credit Sales:</span>
                                <span className="tabular-nums font-semibold text-purple-600">-{formatCurrency(creditSalesAmount)}</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>(-) Card Payments:</span>
                                <span className="tabular-nums font-semibold text-indigo-600">-{formatCurrency(cardSalesAmount)}</span>
                              </div>
                              <hr className="border-gray-200/80 my-1" />
                              <div className="flex justify-between font-extrabold text-[#1C1C1C]">
                                <span>= Net Physical Cash Due:</span>
                                <span className="tabular-nums text-blue-600">{formatCurrency(netPhysicalCashDue)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Pump Card Action Controls */}
                        <div className="pt-2 border-t border-gray-100">
                          {r.status === 'Idle' ? (
                            <button
                              id={`btn-lock-${r.pumpId}`}
                              onClick={() => handleSavePumpData(r.pumpId)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-white text-xs font-extrabold rounded-xl transition-all shadow-md hover:brightness-110 cursor-pointer animate-pulse"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Pump Data</span>
                            </button>
                          ) : r.status === 'Active' ? (
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  id={`btn-transfer-${r.pumpId}`}
                                  onClick={() => handleOpenHandoverModal(r)}
                                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Transfer Pumper</span>
                                </button>
                                <button
                                  id={`btn-unlock-${r.pumpId}`}
                                  onClick={() => handleUnlockPumpData(r.pumpId)}
                                  className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-[#1C1C1C] border border-gray-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit Setup</span>
                                </button>
                              </div>
                              <button
                                id={`btn-end-pump-${r.pumpId}`}
                                onClick={() => handleClosePumpShift(r.pumpId)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>End Pump Shift</span>
                              </button>
                            </div>
                          ) : (
                            <div className="w-full text-center py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>Completed & Locked</span>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Card Footer expected revenue display, actual cash handover input & live variance */}
                      <div className={`px-4 py-3 border-t border-gray-100 transition-colors space-y-2.5 ${
                        r.status === 'Completed' 
                          ? 'bg-emerald-500/10' 
                          : r.status === 'Active'
                          ? 'bg-blue-500/10'
                          : 'bg-gray-50'
                      }`}>
                        {/* Net Expected Physical Cash Display */}
                        {(() => {
                          const grossFuelRevenue = netSold * fuelPrice;
                          const oilSalesAmount = r.oilSalesAmount || 0;
                          const totalGrossRevenue = grossFuelRevenue + oilSalesAmount;
                          const creditSalesAmount = r.creditSalesAmount || 0;
                          const cardSalesAmount = r.cardSalesAmount || 0;
                          const netExpCash = Math.max(0, totalGrossRevenue - (creditSalesAmount + cardSalesAmount));

                          return (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                {r.status === 'Completed' ? 'Final Net Cash Due' : 'Expected Physical Cash'}
                              </span>
                              <span className={`tabular-nums font-extrabold text-sm transition-colors ${
                                r.status === 'Completed' ? 'text-emerald-600' : 'text-blue-600'
                              }`}>
                                {formatCurrency(netExpCash)}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Manual Physical Cash Handover Input Field */}
                        <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wider flex-1 min-w-0">
                              Actual Cash Handed Over (Rs.)
                            </label>
                            <div className="w-28 sm:w-32">
                              <input
                                type="number"
                                step="any"
                                value={r.actualCash ?? 0}
                                disabled={r.status === 'Completed'}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdateReading(r.pumpId, 'actualCash', parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-xs sm:text-sm tabular-nums font-extrabold text-right focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                              />
                            </div>
                          </div>

                          {/* Dynamic Live Variance Status */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                              Cash Variance
                            </span>
                            {(() => {
                              const actCash = r.actualCash ?? 0;
                              const grossFuelRevenue = netSold * fuelPrice;
                              const oilSalesAmount = r.oilSalesAmount || 0;
                              const totalGrossRevenue = grossFuelRevenue + oilSalesAmount;
                              const creditSalesAmount = r.creditSalesAmount || 0;
                              const cardSalesAmount = r.cardSalesAmount || 0;
                              const netExpCash = Math.max(0, totalGrossRevenue - (creditSalesAmount + cardSalesAmount));
                              const varVal = actCash - netExpCash;
                              const absFormatted = formatCurrency(Math.abs(varVal));

                              if (varVal < -0.01) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-red-500/10 text-red-600 border border-red-500/20 tabular-nums">
                                    - {absFormatted} (Shortage)
                                  </span>
                                );
                              } else if (varVal > 0.01) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 tabular-nums">
                                    + {absFormatted} (Excess)
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200 tabular-nums">
                                    Rs. 0.00 (Balanced)
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>
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

            {/* Consolidated Multi-Pump Summary Widget */}
            {multiPumpersData.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200/80 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1C1C1C] tracking-tight">
                      Pumper Consolidated Multi-Pump Summary
                    </h3>
                    <p className="text-xs text-gray-500">
                      Combined sales breakdown & single cash handover option for pumpers managing 2 or more pumps.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pumperStats.map(p => {
                    const absVar = Math.abs(p.totalCashVariance);
                    const absVarFormatted = formatCurrency(absVar);

                    return (
                      <div
                        key={`multi-pumper-${p.pumperId}`}
                        className="bg-white border border-blue-100/80 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:border-blue-300"
                      >
                        {/* Banner Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/30 to-purple-50/20 border-b border-blue-100 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0 ${p.avatarColor}`}>
                              {p.pumperName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-[#1C1C1C] text-sm truncate">
                                {p.pumperName}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md uppercase tracking-wider">
                                  {p.readings.length} Pumps Assigned
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Pump Pills */}
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {p.readings.map(r => (
                              <span
                                key={`p-pill-${r.pumpId}`}
                                className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-2xs tabular-nums"
                              >
                                Pump {r.pumpId.replace('pump-', '')} ({r.fuelType})
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Metrics Breakdown */}
                        <div className="p-4 space-y-3 bg-white">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                                Net Fuel Sold
                              </span>
                              <span className="font-extrabold text-[#1C1C1C] text-sm tabular-nums">
                                {p.totalNetLiters.toFixed(2)} L
                              </span>
                            </div>

                            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                                Gross Revenue
                              </span>
                              <span className="font-extrabold text-[#1C1C1C] text-sm tabular-nums">
                                {formatCurrency(p.totalGrossRevenue)}
                              </span>
                            </div>

                            <div className="p-2.5 bg-purple-50/70 rounded-xl border border-purple-100 col-span-2 sm:col-span-1">
                              <span className="text-[10px] font-extrabold text-purple-900 uppercase tracking-wider block mb-0.5">
                                Non-Cash Deductions
                              </span>
                              <span className="font-extrabold text-purple-700 text-sm tabular-nums block">
                                {formatCurrency(p.totalCreditSales + p.totalCardSales)}
                              </span>
                              <span className="text-[9px] text-purple-600 font-semibold block mt-0.5">
                                Credit: {formatCurrency(p.totalCreditSales)} | Card: {formatCurrency(p.totalCardSales)}
                              </span>
                            </div>
                          </div>

                          {/* Net Physical Cash Due */}
                          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-900">
                              Total Net Physical Cash Due:
                            </span>
                            <span className="text-base font-extrabold text-blue-700 tabular-nums">
                              {formatCurrency(p.totalNetExpCash)}
                            </span>
                          </div>

                          {/* Consolidated Cash Handover Input */}
                          <div className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider flex-1 min-w-0">
                                Consolidated Cash Handed Over (Rs.)
                              </label>
                              <div className="w-32 sm:w-36">
                                <input
                                  type="number"
                                  step="any"
                                  value={p.totalActualCash ?? 0}
                                  placeholder="0.00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateConsolidatedCashForPumper(p.pumperId, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2.5 py-1.5 bg-white border border-gray-300 text-[#1C1C1C] rounded-lg text-sm tabular-nums font-extrabold text-right focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                />
                              </div>
                            </div>

                            {/* Net Shift Variance */}
                            <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                              <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                                Shift Net Cash Variance
                              </span>
                              {p.totalCashVariance < -0.01 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-red-500/10 text-red-600 border border-red-500/20 tabular-nums">
                                  - {absVarFormatted} (Shortage)
                                </span>
                              ) : p.totalCashVariance > 0.01 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 tabular-nums">
                                  + {absVarFormatted} (Excess)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                                  Rs. 0.00 (Balanced)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

          // Compute fuel distributions & totals for completed shifts
          const productDistribution: Record<string, number> = {};
          let totalLiters = 0;
          let totalRevenue = 0;

          closedLedgerShifts.forEach(shift => {
            totalLiters += (shift.totalNetSold || shift.totalFuelSold || 0);
            totalRevenue += (shift.totalNetSales || 0);
            (shift.pumpReadings || []).forEach((reading: any) => {
               const fuel = reading.fuelType || reading.fueltype || 'Unknown';
               const start = reading.startMeter !== undefined ? reading.startMeter : reading.startmeter || 0;
               const end = reading.endMeter !== undefined ? reading.endMeter : reading.endmeter || 0;
               const dispensed = reading.totalDispensed !== undefined ? reading.totalDispensed : Math.max(0, end - start);
               productDistribution[fuel] = (productDistribution[fuel] || 0) + dispensed;
            });
          });

          return (
            <div id="no-shift-screen" className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">


              <div className="flex flex-col lg:flex-row gap-6">
                
                {/* LEFT COLUMN (70%): Shift Ledger */}
                <div className="lg:w-[70%] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
                  <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 shrink-0 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <h3 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider">Shift Ledger</h3>
                       <span className="px-2 py-0.5 rounded-full bg-gray-200/60 text-gray-600 text-[10px] font-semibold tabular-nums">
                         {closedLedgerShifts.length} {closedLedgerShifts.length === 1 ? 'Record' : 'Records'}
                       </span>
                     </div>
                     {isLoadingLedger && (
                       <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                         <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
                       </span>
                     )}
                  </div>
                  <div className="overflow-auto flex-1 relative">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-xs">
                        <tr className="text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-4">Shift ID / Name</th>
                          <th className="py-2.5 px-4">Supervisor</th>
                          <th className="py-2.5 px-4 text-right">Liters Sold</th>
                          <th className="py-2.5 px-4 text-right">Revenue (Rs.)</th>
                          <th className="py-2.5 px-4 text-right">Cash Rec. / Variance</th>
                          <th className="py-2.5 px-4">End Time & Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {closedLedgerShifts.length > 0 ? (
                          closedLedgerShifts.map(shift => {
                            const supervisorName = employees.find(e => e.id === shift.supervisorId || e.id === shift.supervisorid)?.name || shift.supervisorName || 'Unassigned';
                            const liters = shift.totalNetSold || shift.totalFuelSold || 0;
                            const revenue = shift.totalNetSales || 0;
                            const physCash = shift.totalPhysicalCash !== undefined && shift.totalPhysicalCash > 0 
                              ? shift.totalPhysicalCash 
                              : ((shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0));
                            const hasHandover = physCash > 0 || !!shift.handoverNotes || !!shift.replacementPumperId;
                            const variance = shift.cashVariance !== undefined ? shift.cashVariance : (physCash > 0 ? physCash - revenue : 0);

                            const formattedDate = shift.endTime 
                              ? new Date(shift.endTime).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'Completed';

                            return (
                              <tr 
                                key={shift.id} 
                                className="hover:bg-gray-50/70 transition-colors"
                              >
                                <td className="py-2.5 px-4 font-semibold text-[#1C1C1C] tabular-nums">
                                  {shift.id} {shift.name ? <span className="text-[11px] font-normal text-gray-500">({shift.name})</span> : ''}
                                  {hasHandover && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-medium text-[9px] uppercase tracking-wider">
                                      Handover
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-gray-600 font-medium">{supervisorName}</td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-700">
                                  {liters.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-bold text-[#1C1C1C]">
                                  {formatCurrency(revenue)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                                  {hasHandover ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-gray-800">{formatCurrency(physCash)}</span>
                                      {variance === 0 ? (
                                        <span className="text-[10px] text-emerald-600 font-semibold">Balanced</span>
                                      ) : variance > 0 ? (
                                        <span className="text-[10px] text-emerald-600 font-semibold">+{formatCurrency(variance)}</span>
                                      ) : (
                                        <span className="text-[10px] text-red-500 font-semibold">{formatCurrency(variance)}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 font-normal text-[11px]">Match ({formatCurrency(revenue)})</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-gray-500 tabular-nums font-medium text-[11px]">
                                  {formattedDate}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-gray-400 font-medium text-xs">
                              No completed shifts recorded yet.
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
          <div id="close-modal-card" className="bg-gray-50 rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 text-center overflow-y-auto space-y-4">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#1C1C1C] text-lg">End Shift & Lock Ledger?</h3>
              <p className="text-gray-500 text-xs">
                This action will lock current shift ledger (<strong className="text-[#1C1C1C] tabular-nums font-semibold">{activeShift.id}</strong>), save readings permanently, and deduct sold fuel from underground storage tanks.
              </p>
              
              {/* Overall Shift Revenue Summary Box */}
              <div className="bg-white p-4 rounded-xl text-left text-xs text-gray-600 space-y-2.5 border border-gray-200/80 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span className="font-bold text-gray-700">Supervisor: <strong className="text-[#1C1C1C]">{activeSupervisor?.name || 'N/A'}</strong></span>
                  <span className="font-bold text-gray-700">Shift: <strong className="text-[#1C1C1C]">{activeShift.name}</strong></span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Net Fuel Sold</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#1C1C1C] tabular-nums">{formatLiters(stats.totalNetSold)}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Gross Fuel Revenue</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#1C1C1C] tabular-nums">{formatCurrency(stats.totalFuelSales)}</span>
                  </div>
                  <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-amber-900 uppercase font-bold block">(+) Oil/Lube Sales</span>
                    <span className="text-xs sm:text-sm font-extrabold text-amber-700 tabular-nums">+{formatCurrency(stats.totalOilSales)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
                  <span className="font-extrabold text-gray-800">Total Consolidated System Revenue:</span>
                  <span className="font-extrabold text-blue-600 tabular-nums text-base">{formatCurrency(stats.totalNetSales)}</span>
                </div>
              </div>

              {/* Pumper Consolidated Shift Summary */}
              {allPumperStats.length > 0 && (
                <div className="text-left space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      Pumper Consolidated Shift Summary
                    </h4>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full">
                      {allPumperStats.length} {allPumperStats.length === 1 ? 'Pumper Account' : 'Pumper Accounts'}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allPumperStats.map((p) => {
                      const absVar = Math.abs(p.overallVariance);
                      const absVarFormatted = formatCurrency(absVar);

                      return (
                        <div key={`modal-pumper-${p.pumperId}`} className="bg-white p-3 rounded-xl border border-gray-200/90 shadow-2xs space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0 ${p.avatarColor}`}>
                                {p.pumperName.charAt(0)}
                              </div>
                              <span className="font-bold text-[#1C1C1C]">{p.pumperName}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.readings.map(r => (
                                <span key={`m-pill-${r.pumpId}`} className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-md tabular-nums border border-gray-200/60">
                                  {r.pumpName}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Financial Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                            <div>
                              <span className="text-[9px] font-semibold text-gray-400 block uppercase">Fuel Sales</span>
                              <span className="font-bold text-gray-700 tabular-nums">{formatCurrency(p.totalFuelRevenue)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-amber-700 block uppercase">Oil/Lube Sales</span>
                              <span className="font-bold text-amber-700 tabular-nums">+{formatCurrency(p.totalOilSales)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-purple-600 block uppercase">Non-Cash (Credit/Card)</span>
                              <span className="font-bold text-purple-700 tabular-nums">-{formatCurrency(p.totalCreditSales + p.totalCardSales)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-extrabold text-blue-900 block uppercase">Net Cash Due</span>
                              <span className="font-extrabold text-blue-700 tabular-nums">{formatCurrency(p.totalNetExpCash)}</span>
                            </div>
                          </div>

                          {/* Cash Handover & Variance Status */}
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <div className="flex items-center gap-1 text-gray-600">
                              <span className="font-medium">Actual Cash Handed Over:</span>
                              <span className="font-bold text-[#1C1C1C] tabular-nums">{formatCurrency(p.totalActualCash)}</span>
                            </div>
                            <div>
                              {p.overallVariance < -0.01 ? (
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-red-100 text-red-700 border border-red-200 tabular-nums">
                                  -{absVarFormatted} (Shortage)
                                </span>
                              ) : p.overallVariance > 0.01 ? (
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200 tabular-nums">
                                  +{absVarFormatted} (Excess)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-gray-100 text-gray-700 border border-gray-200 tabular-nums">
                                  Rs. 0.00 (Balanced)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsCloseConfirmOpen(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 font-bold text-xs rounded-lg hover:bg-gray-100 cursor-pointer shadow-2xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCloseShift}
                className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                Confirm & Lock Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MID-SHIFT PUMPER TRANSFER MODAL */}
      {handoverPumpModal && (
        <div id="handover-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="handover-modal-card" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Mid-Shift Pumper Transfer</h3>
                  <p className="text-blue-100 text-xs">{handoverPumpModal.pumpName} • {handoverPumpModal.fuelType}</p>
                </div>
              </div>
              <button
                onClick={() => setHandoverPumpModal(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Outgoing Pumper Summary */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Outgoing Pumper</span>
                  <span className="font-bold text-[#1C1C1C] text-sm">
                    {employees.find(e => e.id === handoverPumpModal.assignedPumperId)?.name || 'Unassigned'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Start Meter</span>
                  <span className="font-bold text-gray-700 tabular-nums">{handoverPumpModal.startMeter.toFixed(2)} L</span>
                </div>
              </div>

              {/* Handover Meter Reading */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Handover Meter Reading (L)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={modalHandoverMeter}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                    setModalHandoverMeter(val);
                    if (typeof val === 'number') {
                      const fuelPrice = getPriceForFuelType(handoverPumpModal.fuelType);
                      const hLiters = Math.max(0, val - handoverPumpModal.startMeter);
                      const netLiters = Math.max(0, hLiters - handoverPumpModal.testingQty);
                      setModalOutgoingCash(netLiters * fuelPrice);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-[#1C1C1C] tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Liters dispensed by outgoing pumper: <strong className="text-blue-600 tabular-nums font-bold">
                    {Math.max(0, (Number(modalHandoverMeter) || 0) - handoverPumpModal.startMeter).toFixed(2)} L
                  </strong>
                </p>
              </div>

              {/* Outgoing Pumper Cash Collected */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Outgoing Pumper Cash Collected (Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={modalOutgoingCash}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setModalOutgoingCash(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-[#1C1C1C] tabular-nums focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Replacement Pumper Selection */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Select Replacement Pumper (Incoming)
                </label>
                <select
                  value={modalReplacementPumperId}
                  onChange={(e) => setModalReplacementPumperId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#1C1C1C] focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Replacement Pumper --</option>
                  {pumpers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Handover / Reason Notes */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Transfer Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swapped for meal break (1:00 PM)"
                  value={modalHandoverNotes}
                  onChange={(e) => setModalHandoverNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-medium text-[#1C1C1C] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setHandoverPumpModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmHandover}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Transfer</span>
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
