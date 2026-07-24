/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, AlertCircle, Database, ShieldCheck } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import ShiftManagementTab from './components/ShiftManagementTab';
import FuelStockTab from './components/FuelStockTab';
import DailySalesTab from './components/DailySalesTab';
import EmployeesTab from './components/EmployeesTab';
import SettingsTab from './components/SettingsTab';
import PriceManagementTab from './components/PriceManagementTab';
import { Employee, FuelTank, Shift, StockDelivery, PriceSchedule } from './types';
import { supabase, getTanksTableName, setTanksTableName } from './lib/supabase';



export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isRlsActive, setIsRlsActive] = useState<boolean>(false);
  const isInitialLoad = useRef(true);

  // CORE PERSISTED STATES
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [priceSchedules, setPriceSchedules] = useState<PriceSchedule[]>([]);

  // Error handling for writing state back to Supabase (e.g. Row-Level Security policy violations)
  const handleSyncWriteError = (err: any) => {
    if (!err) return;
    const errMsg = err.message || String(err);
    if (
      errMsg.toLowerCase().includes('row-level security') ||
      errMsg.toLowerCase().includes('violates row-level security policy') ||
      errMsg.toLowerCase().includes('security policy') ||
      errMsg.toLowerCase().includes('policy') ||
      err.code === '42501'
    ) {
      setIsRlsActive(true);
      console.warn("Write blocked by Supabase Row-Level Security (RLS). Automatically falling back to secure offline local storage mode.");
    } else {
      console.warn("Supabase sync write warning:", errMsg);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      const defaultEmps: Employee[] = [
        { id: 'emp-101', name: 'Samantha Silva', role: 'Supervisor', phone: '0771234567', status: 'Active', avatarColor: 'bg-blue-500' },
        { id: 'emp-102', name: 'Roshan Perera', role: 'Pumper', phone: '0712345678', status: 'Active', avatarColor: 'bg-emerald-500' },
        { id: 'emp-103', name: 'Nimal Fernando', role: 'Pumper', phone: '0753456789', status: 'Active', avatarColor: 'bg-purple-500' },
        { id: 'emp-104', name: 'Priyantha Bandara', role: 'Pumper', phone: '0724567890', status: 'Active', avatarColor: 'bg-amber-500' }
      ];

      const defaultTanks: FuelTank[] = [
        { id: 'tank-petrol92', fuelType: 'Petrol 92', name: 'Tank 01 - Petrol 92', capacity: 15000, currentLevel: 9200, pricePerLiter: 355 },
        { id: 'tank-petrol95', fuelType: 'Petrol 95', name: 'Tank 02 - Petrol 95', capacity: 15000, currentLevel: 12500, pricePerLiter: 410 },
        { id: 'tank-autodiesel', fuelType: 'Auto Diesel', name: 'Tank 03 - Auto Diesel', capacity: 20000, currentLevel: 7400, pricePerLiter: 317 },
        { id: 'tank-superdiesel', fuelType: 'Super Diesel', name: 'Tank 04 - Super Diesel', capacity: 10000, currentLevel: 3200, pricePerLiter: 343 }
      ];

      const loadLocalStorageFallback = () => {
        try {
          const storedEmps = localStorage.getItem('fms_employees');
          const storedTanks = localStorage.getItem('fms_tanks');
          const storedActiveShift = localStorage.getItem('fms_activeShift');
          const storedHistory = localStorage.getItem('fms_shiftHistory');
          const storedDeliveries = localStorage.getItem('fms_deliveries');
          const storedSchedules = localStorage.getItem('fms_priceSchedules');

          if (storedEmps) setEmployees(JSON.parse(storedEmps));
          else setEmployees(defaultEmps);

          if (storedTanks) setTanks(JSON.parse(storedTanks));
          else setTanks(defaultTanks);

          if (storedActiveShift) {
            try {
              setActiveShift(JSON.parse(storedActiveShift));
            } catch (_) {}
          }
          if (storedHistory) {
            try {
              setShiftHistory(JSON.parse(storedHistory));
            } catch (_) {}
          }
          if (storedDeliveries) {
            try {
              setDeliveries(JSON.parse(storedDeliveries));
            } catch (_) {}
          }
          if (storedSchedules) {
            try {
              setPriceSchedules(JSON.parse(storedSchedules));
            } catch (_) {}
          }
        } catch (e) {
          console.warn("Failed to load fallback from localStorage", e);
          setEmployees(defaultEmps);
          setTanks(defaultTanks);
        }
      };

      if (!isConfigured) {
        setDbError('Missing Supabase environment variables on Vercel. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel Project Settings. Running in Offline Demo Mode.');
        loadLocalStorageFallback();
        return;
      }

      const handleSupabaseError = (error: any) => {
        if (error) {
          if (
            error.code === '42P01' || 
            error.message?.includes('relation') || 
            error.message?.includes('does not exist') ||
            String(error).includes('42P01')
          ) {
            throw new Error('tables_missing');
          }
          if (
            error.message?.toLowerCase().includes('row-level security') ||
            error.message?.toLowerCase().includes('violates row-level security policy') ||
            error.message?.toLowerCase().includes('security policy') ||
            String(error).toLowerCase().includes('row-level security') ||
            String(error).toLowerCase().includes('policy')
          ) {
            throw new Error('rls_active');
          }
          throw error;
        }
      };

      try {
        // Fetch employees
        const { data: employeesData, error: empError } = await supabase.from('employees').select('*');
        if (empError) handleSupabaseError(empError);

        if (employeesData && employeesData.length > 0) {
          const mappedEmps = employeesData.map(e => ({
            id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarColor: e.avatarcolor
          }));
          setEmployees(mappedEmps as Employee[]);
        } else {
          // Empty database - seed
          setEmployees(defaultEmps);
          const dbPayload = defaultEmps.map(e => ({
            id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarcolor: e.avatarColor
          }));
          const { error: seedError } = await supabase.from('employees').insert(dbPayload);
          if (seedError) handleSupabaseError(seedError);
        }

        // Probe and fetch fuel tanks dynamically (supports plural/singular database configurations)
        let targetTbl = 'fuel_tanks';
        const { error: probeError } = await supabase.from('fuel_tanks').select('id').limit(1);
        if (probeError && (
          probeError.code === '42P01' || 
          probeError.message?.includes('relation') || 
          probeError.message?.includes('does not exist') ||
          String(probeError).includes('42P01')
        )) {
          const { error: probeError2 } = await supabase.from('fuel_tank').select('id').limit(1);
          if (!probeError2 || (probeError2.code !== '42P01' && !probeError2.message?.includes('relation') && !probeError2.message?.includes('does not exist'))) {
            targetTbl = 'fuel_tank';
            setTanksTableName('fuel_tank');
          }
        }

        const { data: tanksData, error: tankError } = await supabase.from(targetTbl).select('*');
        if (tankError) handleSupabaseError(tankError);

        if (tanksData && tanksData.length > 0) {
          const mappedTanks = tanksData.map(t => ({
            id: t.id, fuelType: t.fueltype, name: t.name, capacity: t.capacity, currentLevel: t.currentlevel, pricePerLiter: t.priceperliter
          }));
          setTanks(mappedTanks as FuelTank[]);
        } else {
          // Empty database - seed
          setTanks(defaultTanks);
          const dbPayload = defaultTanks.map(t => ({
            id: t.id, fueltype: t.fuelType, name: t.name, capacity: t.capacity, currentlevel: t.currentLevel, priceperliter: t.pricePerLiter
          }));
          const { error: seedError } = await supabase.from(getTanksTableName()).insert(dbPayload);
          if (seedError) handleSupabaseError(seedError);
        }

        // Fetch shifts with pump readings
        const { data: shiftsData, error: shiftError } = await supabase.from('shifts').select(`
          *,
          pumpReadings:pump_readings(*)
        `).order('starttime', { ascending: false });
        if (shiftError) handleSupabaseError(shiftError);

        if (shiftsData) {
          const mappedShifts = shiftsData.map(s => ({
            id: s.id,
            name: s.name,
            supervisorId: s.supervisorid,
            startTime: s.starttime,
            endTime: s.endtime,
            isActive: s.isactive,
            totalFuelSold: s.totalfuelsold,
            totalNetSold: s.totalnetsold,
            totalNetSales: s.totalnetsales,
            pumpReadings: (s.pumpReadings || []).map((r: any) => ({
              pumpId: r.pumpid,
              pumpName: r.pumpname,
              fuelType: r.fueltype,
              assignedPumperId: r.assignedpumperid,
              startMeter: r.startmeter,
              endMeter: r.endmeter,
              testingQty: r.testingqty,
              status: r.status,
              isLocked: r.islocked,
              unitPrice: r.unitprice
            }))
          }));
          const active = mappedShifts.find(s => s.isActive);
          const history = mappedShifts.filter(s => !s.isActive);
          setActiveShift(active as unknown as Shift || null);
          setShiftHistory(history as unknown as Shift[]);
        }

        // Fetch deliveries
        const { data: deliveriesData, error: deliveryError } = await supabase.from('stock_deliveries').select('*').order('date', { ascending: false });
        if (deliveryError) handleSupabaseError(deliveryError);

        if (deliveriesData) {
          const mappedDeliveries = deliveriesData.map(d => ({
            id: d.id, date: d.date, fuelType: d.fueltype, quantity: d.quantity, supplier: d.supplier, cost: d.cost
          }));
          setDeliveries(mappedDeliveries as StockDelivery[]);
        }

        // Fetch price schedules
        const { data: schedulesData, error: scheduleError } = await supabase.from('price_schedules').select('*').order('effectivedate', { ascending: false });
        if (scheduleError) handleSupabaseError(scheduleError);

        if (schedulesData) {
          const mappedSchedules = schedulesData.map(s => ({
            id: s.id, fuelType: s.fueltype, newPrice: s.newprice, effectiveDate: s.effectivedate, status: s.status
          }));
          setPriceSchedules(mappedSchedules as PriceSchedule[]);
        }

        setTimeout(() => {
          isInitialLoad.current = false;
        }, 1000);
      } catch (err: any) {
        if (err.message === 'tables_missing') {
          setDbError('Supabase tables do not exist. Please go to your Supabase Dashboard SQL Editor, paste and run the contents of `supabase_schema.sql` to initialize your database tables.');
          console.log("Supabase setup notice: tables_missing");
          loadLocalStorageFallback();
        } else if (err.message === 'rls_active' || String(err).toLowerCase().includes('row-level security') || String(err).toLowerCase().includes('policy')) {
          setIsRlsActive(true);
          console.warn("Supabase Row-Level Security (RLS) is active. Operating in fallback offline mode.");
          loadLocalStorageFallback();
        } else {
          console.warn("Database connection issue. Falling back to offline mode. Details:", err?.message || String(err));
          loadLocalStorageFallback();
        }
        setTimeout(() => {
          isInitialLoad.current = false;
        }, 1000);
      }
    };

    fetchAllData();
  }, []);


  // Sync changes to Supabase and local storage upon state updates
  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (employees.length > 0) {
      localStorage.setItem('fms_employees', JSON.stringify(employees));
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    if (employees.length > 0) {
      const dbPayload = employees.map(e => ({
        id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarcolor: e.avatarColor
      }));
      supabase.from('employees').upsert(dbPayload).then(({ error }) => {
        if (error) handleSyncWriteError(error);
      });
    }
  }, [employees, dbError, isRlsActive]);

  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (tanks.length > 0) {
      localStorage.setItem('fms_tanks', JSON.stringify(tanks));
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    if (tanks.length > 0) {
      const dbPayload = tanks.map(t => ({
        id: t.id, fueltype: t.fuelType, name: t.name, capacity: t.capacity, currentlevel: t.currentLevel, priceperliter: t.pricePerLiter
      }));
      supabase.from(getTanksTableName()).upsert(dbPayload).then(({ error }) => {
        if (error) handleSyncWriteError(error);
      });
    }
  }, [tanks, dbError, isRlsActive]);

  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (activeShift) {
      localStorage.setItem('fms_activeShift', JSON.stringify(activeShift));
    } else {
      localStorage.removeItem('fms_activeShift');
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    const syncActiveShift = async () => {
      if (activeShift) {
        const { pumpReadings, ...shiftData } = activeShift;
        const { error: shiftErr } = await supabase.from('shifts').upsert({
          id: shiftData.id, name: shiftData.name, supervisorid: shiftData.supervisorId, starttime: shiftData.startTime, endtime: shiftData.endTime, isactive: shiftData.isActive, totalfuelsold: shiftData.totalFuelSold, totalnetsold: shiftData.totalNetSold, totalnetsales: shiftData.totalNetSales
        });
        if (shiftErr) {
          handleSyncWriteError(shiftErr);
          return;
        }
        if (pumpReadings && pumpReadings.length > 0) {
          const readingsToUpsert = pumpReadings.map(r => ({
            id: (r as any).id, shift_id: activeShift.id, pumpid: r.pumpId, pumpname: r.pumpName, fueltype: r.fuelType, assignedpumperid: r.assignedPumperId, startmeter: r.startMeter, endmeter: r.endMeter, testingqty: r.testingQty, status: r.status, islocked: r.isLocked, unitprice: r.unitPrice
          }));
          const { error: readingsErr } = await supabase.from('pump_readings').upsert(readingsToUpsert);
          if (readingsErr) handleSyncWriteError(readingsErr);
        }
      }
    };
    syncActiveShift();
  }, [activeShift, dbError, isRlsActive]);

  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (shiftHistory.length > 0) {
      localStorage.setItem('fms_shiftHistory', JSON.stringify(shiftHistory));
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    const syncHistory = async () => {
      if (shiftHistory.length > 0) {
        for (const shift of shiftHistory) {
          const { pumpReadings, ...shiftData } = shift;
          const { error: shiftErr } = await supabase.from('shifts').upsert({
            id: shiftData.id, name: shiftData.name, supervisorid: shiftData.supervisorId, starttime: shiftData.startTime, endtime: shiftData.endTime, isactive: shiftData.isActive, totalfuelsold: shiftData.totalFuelSold, totalnetsold: shiftData.totalNetSold, totalnetsales: shiftData.totalNetSales
          });
          if (shiftErr) {
            handleSyncWriteError(shiftErr);
            continue;
          }
          if (pumpReadings && pumpReadings.length > 0) {
            const readingsToUpsert = pumpReadings.map(r => ({
              id: (r as any).id, shift_id: shift.id, pumpid: r.pumpId, pumpname: r.pumpName, fueltype: r.fuelType, assignedpumperid: r.assignedPumperId, startmeter: r.startMeter, endmeter: r.endMeter, testingqty: r.testingQty, status: r.status, islocked: r.isLocked, unitprice: r.unitPrice
            }));
            const { error: readingsErr } = await supabase.from('pump_readings').upsert(readingsToUpsert);
            if (readingsErr) handleSyncWriteError(readingsErr);
          }
        }
      }
    };
    syncHistory();
  }, [shiftHistory, dbError, isRlsActive]);

  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (deliveries.length > 0) {
      localStorage.setItem('fms_deliveries', JSON.stringify(deliveries));
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    if (deliveries.length > 0) {
      const dbPayload = deliveries.map(d => ({
        id: d.id, date: d.date, fueltype: d.fuelType, quantity: d.quantity, supplier: d.supplier, cost: d.cost
      }));
      supabase.from('stock_deliveries').upsert(dbPayload).then(({ error }) => {
        if (error) handleSyncWriteError(error);
      });
    }
  }, [deliveries, dbError, isRlsActive]);

  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    if (priceSchedules.length > 0) {
      localStorage.setItem('fms_priceSchedules', JSON.stringify(priceSchedules));
    }

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    if (priceSchedules.length > 0) {
      const dbPayload = priceSchedules.map(p => ({
        id: p.id, fueltype: p.fuelType, newprice: p.newPrice, effectivedate: p.effectiveDate, status: p.status
      }));
      supabase.from('price_schedules').upsert(dbPayload).then(({ error }) => {
        if (error) handleSyncWriteError(error);
      });
    }
  }, [priceSchedules, dbError, isRlsActive]);

  // Automated Price Checker Engine
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      let hasUpdates = false;
      let newTanks = [...tanks];
      let newSchedules = [...priceSchedules];

      newSchedules = newSchedules.map(schedule => {
        if (schedule.status === 'Pending' && new Date(schedule.effectiveDate) <= now) {
          hasUpdates = true;
          // Apply to tanks
          newTanks = newTanks.map(t => {
            if (t.fuelType === schedule.fuelType) {
              return { ...t, pricePerLiter: schedule.newPrice };
            }
            return t;
          });
          return { ...schedule, status: 'Applied' as const };
        }
        return schedule;
      });

      if (hasUpdates) {
        setTanks(newTanks);
        setPriceSchedules(newSchedules);
      }
    };

    // Check immediately and then every minute
    checkSchedules();
    const interval = setInterval(checkSchedules, 10000); // Check every 10s for demo purposes

    return () => clearInterval(interval);
  }, [tanks, priceSchedules]);

  // Action: Close operational shift and update stock levels automatically
  const handleCloseShift = (closedShift: Shift) => {
    // 1. Add shift to completed history list
    const updatedHistory = [closedShift, ...shiftHistory];
    setShiftHistory(updatedHistory);

    // 2. Reset assigned pumper states in the employees directory back to Active/Off-duty
    const updatedEmployees = employees.map(emp => {
      if (emp.status === 'On Shift') {
        return {
          ...emp,
          status: 'Active' as const
        };
      }
      return emp;
    });
    setEmployees(updatedEmployees);

    // 3. Set active shift to null
    setActiveShift(null);
  };

  // Action: Launch a new shift
  const handleStartShift = (newShiftData: Omit<Shift, 'totalFuelSold' | 'totalNetSold' | 'totalNetSales'>) => {
    const fullNewShift: Shift = {
      ...newShiftData,
      totalFuelSold: 0,
      totalNetSold: 0,
      totalNetSales: 0
    };

    setActiveShift(fullNewShift);

    // Update employees assigned to this new shift
    const updatedEmployees = employees.map(emp => {
      // Mark supervisor as on shift
      if (emp.id === newShiftData.supervisorId) {
        return { ...emp, status: 'On Shift' as const };
      }
      return emp;
    });
    setEmployees(updatedEmployees);
  };

  // Action: Diagnostic hard reset back to default demo database
  const handleResetAllData = () => {
    // Clear all offline local storage caches
    const fmsKeys = [
      'fms_employees',
      'fms_tanks',
      'fms_activeShift',
      'fms_shiftHistory',
      'fms_deliveries',
      'fms_priceSchedules',
      'fuelflow_station_name',
      'fuelflow_station_location',
      'fuelflow_station_currency'
    ];
    fmsKeys.forEach(k => localStorage.removeItem(k));
    console.log('Cleared all offline local caches to pull fresh from Supabase.');
  };

  return (
    <div id="app-root-layout" className="flex min-h-screen bg-[#F4F7F6] text-[#1C1C1C] font-sans antialiased tabular-nums">
      {/* Sidebar - fixed left panel */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content Area */}
      <div id="main-content-panel" className="flex-1 ml-64 p-8 min-h-screen overflow-x-hidden">
        {isRlsActive && (
          <div id="supabase-rls-alert" className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-3 animate-fade-in relative shadow-sm">
            <ShieldCheck className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-sm text-amber-950 font-sans">Supabase Row-Level Security (RLS) is Active</span>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed font-sans">
                Your database queries succeeded, but write operations are blocked by active RLS security policies. To fix this and enable seamless cloud-mode saving:
                <br />
                1. Go to your <strong>Settings Tab</strong> below.
                <br />
                2. Click <strong>Copy SQL Script</strong>.
                <br />
                3. Go to your Supabase Dashboard <strong>SQL Editor</strong>, paste and run the query to configure appropriate write permissions.
                <br />
                <span className="font-bold text-amber-950 mt-1 block">Note: The app is operating in Local Storage offline fallback mode, so you will not lose any active work, added tanks, employees, or shift logs!</span>
              </p>
              <div className="mt-3 flex gap-3">
                <button 
                  onClick={() => setIsRlsActive(false)}
                  className="px-3 py-1.5 bg-amber-200/60 hover:bg-amber-200 text-amber-950 font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                >
                  Dismiss Warning
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-[#1C1C1C] font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                >
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        )}
        {dbError && (
          <div id="supabase-status-alert" className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-3 animate-fade-in relative shadow-sm">
            <Info className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-sm text-amber-950">Supabase Connection Notice</span>
              <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                {dbError}
              </p>
              <div className="mt-3 flex gap-3">
                <button 
                  onClick={() => setDbError(null)}
                  className="px-3 py-1.5 bg-amber-200/60 hover:bg-amber-200 text-amber-900 font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                >
                  Dismiss Notice
                </button>
              </div>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`tab-content-wrapper-${activeTab}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full h-full"
          >
            {activeTab === 'dashboard' && (
              <DashboardTab
                employees={employees}
                tanks={tanks}
                activeShift={activeShift}
                shiftHistory={shiftHistory}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'shift' && (
              <ShiftManagementTab
                employees={employees}
                tanks={tanks}
                setTanks={setTanks}
                activeShift={activeShift}
                setActiveShift={setActiveShift}
                onCloseShift={handleCloseShift}
                onStartShift={handleStartShift}
              />
            )}

            {activeTab === 'stock' && (
              <FuelStockTab
                tanks={tanks}
                setTanks={setTanks}
                deliveries={deliveries}
                setDeliveries={setDeliveries}
              />
            )}

            {activeTab === 'sales' && (
              <DailySalesTab
                shiftHistory={shiftHistory}
                employees={employees}
                tanks={tanks}
              />
            )}

            {activeTab === 'employees' && (
              <EmployeesTab
                employees={employees}
                setEmployees={setEmployees}
              />
            )}

            
            {activeTab === 'price' && (
              <PriceManagementTab
                tanks={tanks}
                setTanks={setTanks}
                priceSchedules={priceSchedules}
                setPriceSchedules={setPriceSchedules}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                tanks={tanks}
                setTanks={setTanks}
                onResetAllData={handleResetAllData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
