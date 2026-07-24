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
import AdminControlTab from './components/AdminControlTab';
import PriceManagementTab from './components/PriceManagementTab';
import LoginPage from './components/LoginPage';
import { AuthUser, Employee, FuelTank, Pump, Shift, StockDelivery, PriceSchedule, resolveUserRole } from './types';
import { supabase, getTanksTableName, setTanksTableName } from './lib/supabase';

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

export const defaultPumps: Pump[] = [
  { id: 'pump-101', name: 'Pump 01', fuelType: 'Petrol 92', tankId: 'tank-petrol92', status: 'Active' },
  { id: 'pump-102', name: 'Pump 02', fuelType: 'Petrol 92', tankId: 'tank-petrol92', status: 'Active' },
  { id: 'pump-103', name: 'Pump 03', fuelType: 'Petrol 95', tankId: 'tank-petrol95', status: 'Active' },
  { id: 'pump-104', name: 'Pump 04', fuelType: 'Petrol 95', tankId: 'tank-petrol95', status: 'Active' },
  { id: 'pump-105', name: 'Pump 05', fuelType: 'Auto Diesel', tankId: 'tank-autodiesel', status: 'Active' },
  { id: 'pump-106', name: 'Pump 06', fuelType: 'Auto Diesel', tankId: 'tank-autodiesel', status: 'Active' },
  { id: 'pump-107', name: 'Pump 07', fuelType: 'Super Diesel', tankId: 'tank-superdiesel', status: 'Active' },
  { id: 'pump-108', name: 'Pump 08', fuelType: 'Super Diesel', tankId: 'tank-superdiesel', status: 'Active' }
];

export default function App() {
  // Auth state & session guard
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('fms_user');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  });

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isRlsActive, setIsRlsActive] = useState<boolean>(false);
  const isInitialLoad = useRef(true);

  // Sync Supabase Auth session if configured
  useEffect(() => {
    const checkSession = async () => {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const u = data.session.user;
            const userEmail = u.email || 'admin@fuelflow.lk';
            const { roleTitle } = resolveUserRole(userEmail, u.user_metadata?.role);

            const authUser: AuthUser = {
              id: u.id,
              email: userEmail,
              name: u.user_metadata?.full_name || u.user_metadata?.name || (roleTitle === 'System Admin' ? 'Rumesh Anjana' : 'Station User'),
              role: roleTitle,
              avatarColor: roleTitle === 'System Admin' ? 'bg-blue-600' : 'bg-purple-600',
            };
            setUser(authUser);
            localStorage.setItem('fms_user', JSON.stringify(authUser));
          }
        } catch (err) {
          console.warn("Supabase auth session check notice:", err);
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const userEmail = u.email || 'admin@fuelflow.lk';
        const { roleTitle } = resolveUserRole(userEmail, u.user_metadata?.role);

        const authUser: AuthUser = {
          id: u.id,
          email: userEmail,
          name: u.user_metadata?.full_name || u.user_metadata?.name || (roleTitle === 'System Admin' ? 'Rumesh Anjana' : 'Station User'),
          role: roleTitle,
          avatarColor: roleTitle === 'System Admin' ? 'bg-blue-600' : 'bg-purple-600',
        };
        setUser(authUser);
        localStorage.setItem('fms_user', JSON.stringify(authUser));
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Redirect non-admin users away from 'admin' tab if attempted
  useEffect(() => {
    if (user) {
      const { role } = resolveUserRole(user.email, user.role);
      if (role !== 'admin' && activeTab === 'admin') {
        setActiveTab('dashboard');
      }
    }
  }, [user, activeTab]);

  const handleLoginSuccess = (signedInUser: AuthUser) => {
    setUser(signedInUser);
    try {
      localStorage.setItem('fms_user', JSON.stringify(signedInUser));
    } catch (_) {}
  };

  const handleLogout = async () => {
    try {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        await supabase.auth.signOut();
      }
    } catch (_) {}
    setUser(null);
    try {
      localStorage.removeItem('fms_user');
    } catch (_) {}
  };

  // Core persisted states
  const [employees, setEmployees] = useState<Employee[]>(defaultEmps);
  const [tanks, setTanks] = useState<FuelTank[]>(defaultTanks);
  const [pumps, setPumps] = useState<Pump[]>(() => {
    try {
      const stored = localStorage.getItem('fms_pumps');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return defaultPumps;
  });
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    try {
      const stored = localStorage.getItem('fms_activeShift') || localStorage.getItem('active_shift_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.isActive || parsed.isactive)) return parsed;
      }
    } catch (_) {}
    return null;
  });
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
          const storedPumps = localStorage.getItem('fms_pumps');
          const storedHistory = localStorage.getItem('fms_shiftHistory');
          const storedDeliveries = localStorage.getItem('fms_deliveries');
          const storedSchedules = localStorage.getItem('fms_priceSchedules');

          if (storedEmps !== null) {
            try { setEmployees(JSON.parse(storedEmps)); } catch (_) { setEmployees([]); }
          } else {
            setEmployees(defaultEmps);
          }

          if (storedTanks !== null) {
            try { setTanks(JSON.parse(storedTanks)); } catch (_) { setTanks([]); }
          } else {
            setTanks(defaultTanks);
          }

          if (storedPumps !== null) {
            try { 
              const parsed = JSON.parse(storedPumps);
              setPumps(Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultPumps); 
            } catch (_) { 
              setPumps(defaultPumps); 
            }
          } else {
            setPumps(defaultPumps);
          }

          const storedActiveShift = localStorage.getItem('fms_activeShift') || localStorage.getItem('active_shift_data');
          if (storedActiveShift) {
            try {
              const parsed = JSON.parse(storedActiveShift);
              if (parsed && (parsed.isActive || parsed.isactive)) {
                setActiveShift(parsed);
              }
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

        if (employeesData) {
          const mappedEmps = employeesData.map(e => ({
            id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarColor: e.avatarcolor
          }));
          setEmployees(mappedEmps as Employee[]);
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

        if (tanksData) {
          const mappedTanks = tanksData.map(t => ({
            id: t.id, fuelType: t.fueltype, name: t.name, capacity: t.capacity, currentLevel: t.currentlevel, pricePerLiter: t.priceperliter
          }));
          setTanks(mappedTanks as FuelTank[]);
        }

        // Fetch pumps table
        const { data: pumpsData } = await supabase.from('pumps').select('*');
        if (pumpsData && pumpsData.length > 0) {
          const mappedPumps = pumpsData.map(p => ({
            id: p.id,
            name: p.name,
            fuelType: p.fueltype,
            tankId: p.tankid || undefined,
            status: p.status || 'Active'
          }));
          setPumps(mappedPumps as Pump[]);
        } else {
          // Fallback if pumps table in Supabase is empty
          const storedPumps = localStorage.getItem('fms_pumps');
          if (storedPumps) {
            try {
              const parsed = JSON.parse(storedPumps);
              setPumps(Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultPumps);
            } catch (_) {
              setPumps(defaultPumps);
            }
          } else {
            setPumps(defaultPumps);
          }
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
            totalFuelSold: Number(s.totalfuelsold) || 0,
            totalNetSold: Number(s.totalnetsold) || 0,
            totalNetSales: Number(s.totalnetsales) || 0,
            initialPumperCash: Number(s.initialpumpercash || s.initialPumperCash) || 0,
            replacementPumperCash: Number(s.replacementpumpercash || s.replacementPumperCash) || 0,
            totalPhysicalCash: Number(s.totalphysicalcash || s.totalPhysicalCash) || 0,
            cashVariance: s.cashvariance,
            handoverNotes: s.handovernotes || '',
            replacementPumperId: s.replacementpumperid || '',
            pumpReadings: (s.pumpReadings || []).map((r: any) => ({
              pumpId: r.pumpid || r.pumpId,
              pumpName: r.pumpname || r.pumpName,
              fuelType: r.fueltype || r.fuelType,
              tankId: r.tankid || r.tankId || (r.fueltype === 'Petrol 92' ? 'tank-petrol92' : r.fueltype === 'Petrol 95' ? 'tank-petrol95' : r.fueltype === 'Auto Diesel' ? 'tank-autodiesel' : 'tank-superdiesel'),
              assignedPumperId: r.assignedpumperid || r.assignedPumperId || null,
              replacementPumperId: r.replacementpumperid || r.replacementPumperId || null,
              initialPumperCash: Number(r.initialpumpercash || r.initialPumperCash) || 0,
              handoverMeter: Number(r.handovermeter || r.handoverMeter) || 0,
              handoverNotes: r.handovernotes || r.handoverNotes || '',
              startMeter: Number(r.startmeter !== undefined ? r.startmeter : r.startMeter) || 0,
              endMeter: Number(r.endmeter !== undefined ? r.endmeter : r.endMeter) || 0,
              testingQty: Number(r.testingqty !== undefined ? r.testingqty : r.testingQty) || 0,
              status: r.status || 'Idle',
              isLocked: r.islocked !== undefined ? r.islocked : r.isLocked,
              unitPrice: Number(r.unitprice || r.unitPrice) || 0
            }))
          }));

          const dbActive = mappedShifts.find(s => s.isActive);
          const history = mappedShifts.filter(s => !s.isActive);

          const storedActiveStr = localStorage.getItem('fms_activeShift') || localStorage.getItem('active_shift_data');
          let localActive: Shift | null = null;
          if (storedActiveStr) {
            try { localActive = JSON.parse(storedActiveStr); } catch (_) {}
          }

          if (dbActive) {
            const mergedReadings = dbActive.pumpReadings.map(dpr => {
              const lpr = localActive?.pumpReadings?.find(r => r.pumpId === dpr.pumpId);
              if (lpr) {
                return {
                  ...dpr,
                  startMeter: lpr.startMeter !== undefined ? lpr.startMeter : dpr.startMeter,
                  endMeter: lpr.endMeter !== undefined ? lpr.endMeter : dpr.endMeter,
                  testingQty: lpr.testingQty !== undefined ? lpr.testingQty : dpr.testingQty,
                  assignedPumperId: lpr.assignedPumperId || dpr.assignedPumperId || null,
                  replacementPumperId: lpr.replacementPumperId || dpr.replacementPumperId || null,
                  initialPumperCash: lpr.initialPumperCash || dpr.initialPumperCash || 0,
                  handoverMeter: lpr.handoverMeter || dpr.handoverMeter || 0,
                  handoverNotes: lpr.handoverNotes || dpr.handoverNotes || '',
                  status: lpr.status || dpr.status || 'Idle',
                  isLocked: lpr.isLocked !== undefined ? lpr.isLocked : dpr.isLocked,
                  unitPrice: lpr.unitPrice || dpr.unitPrice || 0
                };
              }
              return dpr;
            });

            if (localActive && localActive.pumpReadings) {
              localActive.pumpReadings.forEach(lpr => {
                if (!mergedReadings.some(dpr => dpr.pumpId === lpr.pumpId)) {
                  mergedReadings.push(lpr);
                }
              });
            }

            setActiveShift({
              ...dbActive,
              supervisorId: localActive?.supervisorId || dbActive.supervisorId,
              name: localActive?.name || dbActive.name,
              startTime: localActive?.startTime || dbActive.startTime,
              pumpReadings: mergedReadings
            } as unknown as Shift);
          } else if (localActive && (localActive.isActive || (localActive as any).isactive)) {
            setActiveShift(localActive);
          }

          setShiftHistory(history as unknown as Shift[]);
        }

        // Fetch deliveries
        const { data: deliveriesData, error: deliveryError } = await supabase.from('stock_deliveries').select('*').order('date', { ascending: false });
        if (deliveryError) handleSupabaseError(deliveryError);

        if (deliveriesData) {
          const mappedDeliveries = deliveriesData.map(d => ({
            id: d.id, date: d.date, fuelType: d.fueltype, tankId: d.tankid, quantity: d.quantity, supplier: d.supplier, cost: d.cost
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
    
    // Always persist pumps array to localStorage
    localStorage.setItem('fms_pumps', JSON.stringify(pumps));

    if (!isConfigured || isInitialLoad.current || dbError || isRlsActive) return;

    if (pumps.length > 0) {
      const dbPayload = pumps.map(p => {
        const item: any = { id: p.id, name: p.name, fueltype: p.fuelType, status: p.status };
        if (p.tankId) item.tankid = p.tankId;
        return item;
      });
      supabase.from('pumps').upsert(dbPayload).then(async ({ error }) => {
        if (error && (error.message?.includes('tankid') || error.code === '42703' || error.message?.includes('schema cache'))) {
          // Fallback without tankid if column missing in Supabase schema cache
          const fallbackPayload = pumps.map(p => ({
            id: p.id, name: p.name, fueltype: p.fuelType, status: p.status
          }));
          const { error: fbErr } = await supabase.from('pumps').upsert(fallbackPayload);
          if (fbErr) handleSyncWriteError(fbErr);
        } else if (error) {
          handleSyncWriteError(error);
        }
      });
    }
  }, [pumps, dbError, isRlsActive]);

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
          id: shiftData.id,
          name: shiftData.name,
          supervisorid: shiftData.supervisorId,
          starttime: shiftData.startTime,
          endtime: shiftData.endTime || null,
          isactive: shiftData.isActive,
          totalfuelsold: shiftData.totalFuelSold || 0,
          totalnetsold: shiftData.totalNetSold || 0,
          totalnetsales: shiftData.totalNetSales || 0,
          initialpumpercash: shiftData.initialPumperCash || 0,
          replacementpumpercash: shiftData.replacementPumperCash || 0,
          totalphysicalcash: shiftData.totalPhysicalCash || 0,
          cashvariance: shiftData.cashVariance || 0,
          handovernotes: shiftData.handoverNotes || '',
          replacementpumperid: shiftData.replacementPumperId || null
        });

        if (shiftErr) {
          if (shiftErr.code === '42703' || shiftErr.message?.includes('column')) {
            await supabase.from('shifts').upsert({
              id: shiftData.id,
              name: shiftData.name,
              supervisorid: shiftData.supervisorId,
              starttime: shiftData.startTime,
              endtime: shiftData.endTime || null,
              isactive: shiftData.isActive,
              totalfuelsold: shiftData.totalFuelSold || 0,
              totalnetsold: shiftData.totalNetSold || 0,
              totalnetsales: shiftData.totalNetSales || 0
            });
          } else {
            handleSyncWriteError(shiftErr);
            return;
          }
        }

        if (pumpReadings && pumpReadings.length > 0) {
          const readingsToUpsert = pumpReadings.map(r => ({
            id: (r as any).id || `${activeShift.id}_${r.pumpId}`,
            shift_id: activeShift.id,
            pumpid: r.pumpId,
            pumpname: r.pumpName,
            fueltype: r.fuelType,
            tankid: r.tankId || (r.fuelType === 'Petrol 92' ? 'tank-petrol92' : r.fuelType === 'Petrol 95' ? 'tank-petrol95' : r.fuelType === 'Auto Diesel' ? 'tank-autodiesel' : 'tank-superdiesel'),
            assignedpumperid: r.assignedPumperId || null,
            replacementpumperid: r.replacementPumperId || null,
            initialpumpercash: r.initialPumperCash || 0,
            handovermeter: r.handoverMeter || 0,
            handovernotes: r.handoverNotes || '',
            startmeter: r.startMeter || 0,
            endmeter: r.endMeter || 0,
            testingqty: r.testingQty || 0,
            status: r.status,
            islocked: r.isLocked || false,
            unitprice: r.unitPrice || 0
          }));

          const { error: readingsErr } = await supabase.from('pump_readings').upsert(readingsToUpsert);
          if (readingsErr) {
            if (readingsErr.code === '42703' || readingsErr.message?.includes('column')) {
              const basicReadings = pumpReadings.map(r => ({
                id: (r as any).id || `${activeShift.id}_${r.pumpId}`,
                shift_id: activeShift.id,
                pumpid: r.pumpId,
                pumpname: r.pumpName,
                fueltype: r.fuelType,
                tankid: r.tankId,
                assignedpumperid: r.assignedPumperId || null,
                startmeter: r.startMeter || 0,
                endmeter: r.endMeter || 0,
                testingqty: r.testingQty || 0,
                status: r.status,
                islocked: r.isLocked || false,
                unitprice: r.unitPrice || 0
              }));
              const { error: basicErr } = await supabase.from('pump_readings').upsert(basicReadings);
              if (basicErr) handleSyncWriteError(basicErr);
            } else {
              handleSyncWriteError(readingsErr);
            }
          }
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
    // 1. Deduct Net Sold volume from fuel tanks (testing quantity is returned to underground tanks so 0 deduction for test fuel)
    const netSoldByTank: Record<string, number> = {};
    const netSoldByFuelType: Record<string, number> = {};

    closedShift.pumpReadings.forEach(r => {
      const gross = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, gross - (r.testingQty || 0)); // Net Sold excludes testing quantity
      
      if (r.tankId) {
        netSoldByTank[r.tankId] = (netSoldByTank[r.tankId] || 0) + net;
      }
      if (r.fuelType) {
        netSoldByFuelType[r.fuelType] = (netSoldByFuelType[r.fuelType] || 0) + net;
      }
    });

    const updatedTanks = tanks.map(tank => {
      const netSold = netSoldByTank[tank.id] ?? netSoldByFuelType[tank.fuelType] ?? 0;
      if (netSold > 0) {
        const newLevel = Math.max(0, tank.currentLevel - netSold);
        return {
          ...tank,
          currentLevel: newLevel
        };
      }
      return tank;
    });

    setTanks(updatedTanks);
    try {
      localStorage.setItem('fms_tanks', JSON.stringify(updatedTanks));
    } catch (_) {}

    // Persist updated tank levels directly to Supabase fuel_tanks table
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (isConfigured && !dbError && !isRlsActive) {
      const tankPayload = updatedTanks.map(t => ({
        id: t.id,
        fueltype: t.fuelType,
        name: t.name,
        capacity: t.capacity,
        currentlevel: t.currentLevel,
        priceperliter: t.pricePerLiter
      }));
      supabase.from(getTanksTableName()).upsert(tankPayload).then(({ error }) => {
        if (error) console.warn("Supabase tank level deduction update notice:", error?.message || error);
      });
    }

    // 2. Add shift to completed history list
    const updatedHistory = [closedShift, ...shiftHistory];
    setShiftHistory(updatedHistory);

    // Explicitly update closed shift and completed pump readings in Supabase
    if (isConfigured && !dbError && !isRlsActive) {
      const { pumpReadings, ...shiftData } = closedShift;
      const closedTime = shiftData.endTime || new Date().toISOString();
      
      supabase.from('shifts').upsert({
        id: shiftData.id,
        name: shiftData.name,
        supervisorid: shiftData.supervisorId,
        starttime: shiftData.startTime,
        endtime: closedTime,
        isactive: false,
        totalfuelsold: shiftData.totalFuelSold || 0,
        totalnetsold: shiftData.totalNetSold || 0,
        totalnetsales: shiftData.totalNetSales || 0,
        initialpumpercash: shiftData.initialPumperCash || 0,
        replacementpumpercash: shiftData.replacementPumperCash || 0,
        totalphysicalcash: shiftData.totalPhysicalCash || 0,
        cashvariance: shiftData.cashVariance || 0,
        handovernotes: shiftData.handoverNotes || '',
        replacementpumperid: shiftData.replacementPumperId || null
      }).then(({ error: sErr }) => {
        if (sErr) console.warn("Supabase shift close notice:", sErr?.message || sErr);
      });

      if (pumpReadings && pumpReadings.length > 0) {
        const readingsToUpsert = pumpReadings.map(r => ({
          id: (r as any).id,
          shift_id: closedShift.id,
          pumpid: r.pumpId,
          pumpname: r.pumpName,
          fueltype: r.fuelType,
          tankid: r.tankId || (r.fuelType === 'Petrol 92' ? 'tank-petrol92' : r.fuelType === 'Petrol 95' ? 'tank-petrol95' : r.fuelType === 'Auto Diesel' ? 'tank-autodiesel' : 'tank-superdiesel'),
          assignedpumperid: r.assignedPumperId,
          startmeter: r.startMeter,
          endmeter: r.endMeter,
          testingqty: r.testingQty || 0,
          status: 'Completed',
          islocked: true,
          unitprice: r.unitPrice
        }));
        supabase.from('pump_readings').upsert(readingsToUpsert).then(({ error: prErr }) => {
          if (prErr) console.warn("Supabase pump_readings close notice:", prErr?.message || prErr);
        });
      }
    }

    // 3. Reset assigned pumper states in the employees directory back to Active/Off-duty
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

    // 4. Set active shift to null
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

  const handleDeleteShift = async (shiftId: string) => {
    if (confirm(`Are you sure you want to delete shift record ${shiftId}? This will remove the shift and its associated pump readings.`)) {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          await supabase.from('pump_readings').delete().eq('shift_id', shiftId);
          const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
          if (error) console.warn("Supabase shift delete error:", error.message);
        } catch (err) {
          console.warn("Shift delete error:", err);
        }
      }
      const updated = shiftHistory.filter(s => s.id !== shiftId);
      setShiftHistory(updated);
      localStorage.setItem('fms_shiftHistory', JSON.stringify(updated));
    }
  };

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="app-root-layout" className="flex min-h-screen bg-[#F4F7F6] text-[#1C1C1C] font-sans antialiased tabular-nums">
      {/* Sidebar - fixed left panel */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

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
                pumps={pumps}
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
                pumps={pumps}
                setPumps={setPumps}
                activeShift={activeShift}
                setActiveShift={setActiveShift}
                shiftHistory={shiftHistory}
                onCloseShift={handleCloseShift}
                onStartShift={handleStartShift}
              />
            )}

            {activeTab === 'stock' && (
              <FuelStockTab
                tanks={tanks}
                setTanks={setTanks}
                pumps={pumps}
                setPumps={setPumps}
                deliveries={deliveries}
                setDeliveries={setDeliveries}
              />
            )}

            {activeTab === 'sales' && (
              <DailySalesTab
                shiftHistory={shiftHistory}
                setShiftHistory={setShiftHistory}
                onDeleteShift={handleDeleteShift}
                employees={employees}
                tanks={tanks}
              />
            )}

            {activeTab === 'price' && (
              <AdminControlTab
                tanks={tanks}
                setTanks={setTanks}
                pumps={pumps}
                setPumps={setPumps}
                employees={employees}
                setEmployees={setEmployees}
                priceSchedules={priceSchedules}
                setPriceSchedules={setPriceSchedules}
                onResetAllData={handleResetAllData}
              />
            )}

            {activeTab === 'admin' && (
              <AdminControlTab
                tanks={tanks}
                setTanks={setTanks}
                pumps={pumps}
                setPumps={setPumps}
                employees={employees}
                setEmployees={setEmployees}
                priceSchedules={priceSchedules}
                setPriceSchedules={setPriceSchedules}
                onResetAllData={handleResetAllData}
              />
            )}

            {activeTab === 'employees' && (
              <AdminControlTab
                tanks={tanks}
                setTanks={setTanks}
                pumps={pumps}
                setPumps={setPumps}
                employees={employees}
                setEmployees={setEmployees}
                priceSchedules={priceSchedules}
                setPriceSchedules={setPriceSchedules}
                onResetAllData={handleResetAllData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
