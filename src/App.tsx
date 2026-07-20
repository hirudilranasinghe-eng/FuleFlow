/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import DashboardTab from './components/DashboardTab';
import ShiftManagementTab from './components/ShiftManagementTab';
import FuelStockTab from './components/FuelStockTab';
import DailySalesTab from './components/DailySalesTab';
import EmployeesTab from './components/EmployeesTab';
import SettingsTab from './components/SettingsTab';
import PriceManagementTab from './components/PriceManagementTab';
import { Employee, FuelTank, Shift, StockDelivery, PriceSchedule } from './types';
import { supabase } from './lib/supabase';



export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // CORE PERSISTED STATES
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [priceSchedules, setPriceSchedules] = useState<PriceSchedule[]>([]);

  // Initialize data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch employees
        const { data: employeesData } = await supabase.from('employees').select('*');
        if (employeesData) {
          const mappedEmps = employeesData.map(e => ({
            id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarColor: e.avatarcolor
          }));
          setEmployees(mappedEmps as Employee[]);
        }

        // Fetch fuel tanks
        const { data: tanksData } = await supabase.from('fuel_tanks').select('*');
        if (tanksData) {
          const mappedTanks = tanksData.map(t => ({
            id: t.id, fuelType: t.fueltype, name: t.name, capacity: t.capacity, currentLevel: t.currentlevel, pricePerLiter: t.priceperliter
          }));
          setTanks(mappedTanks as FuelTank[]);
        }

        // Fetch shifts with pump readings
        const { data: shiftsData } = await supabase.from('shifts').select(`
          *,
          pumpReadings:pump_readings(*)
        `).order('startTime', { ascending: false });

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
        const { data: deliveriesData } = await supabase.from('stock_deliveries').select('*').order('date', { ascending: false });
        if (deliveriesData) {
          const mappedDeliveries = deliveriesData.map(d => ({
            id: d.id, date: d.date, fuelType: d.fueltype, quantity: d.quantity, supplier: d.supplier, cost: d.cost
          }));
          setDeliveries(mappedDeliveries as StockDelivery[]);
        }

        // Fetch price schedules
        const { data: schedulesData } = await supabase.from('price_schedules').select('*').order('effectiveDate', { ascending: false });
        if (schedulesData) {
          const mappedSchedules = schedulesData.map(s => ({
            id: s.id, fuelType: s.fueltype, newPrice: s.newprice, effectiveDate: s.effectivedate, status: s.status
          }));
          setPriceSchedules(mappedSchedules as PriceSchedule[]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchAllData();
  }, []);


  // Sync changes to Supabase upon state updates
  useEffect(() => {
    if (employees.length > 0) {
      const dbPayload = employees.map(e => ({
        id: e.id, name: e.name, role: e.role, phone: e.phone, status: e.status, avatarcolor: e.avatarColor
      }));
      supabase.from('employees').upsert(dbPayload).then();
    }
  }, [employees]);

  useEffect(() => {
    if (tanks.length > 0) {
      const dbPayload = tanks.map(t => ({
        id: t.id, fueltype: t.fuelType, name: t.name, capacity: t.capacity, currentlevel: t.currentLevel, priceperliter: t.pricePerLiter
      }));
      supabase.from('fuel_tanks').upsert(dbPayload).then();
    }
  }, [tanks]);

  useEffect(() => {
    const syncActiveShift = async () => {
      if (activeShift) {
        const { pumpReadings, ...shiftData } = activeShift;
        await supabase.from('shifts').upsert({
          id: shiftData.id, name: shiftData.name, supervisorid: shiftData.supervisorId, starttime: shiftData.startTime, endtime: shiftData.endTime, isactive: shiftData.isActive, totalfuelsold: shiftData.totalFuelSold, totalnetsold: shiftData.totalNetSold, totalnetsales: shiftData.totalNetSales
        });
        if (pumpReadings && pumpReadings.length > 0) {
          const readingsToUpsert = pumpReadings.map(r => ({
            id: (r as any).id, shift_id: activeShift.id, pumpid: r.pumpId, pumpname: r.pumpName, fueltype: r.fuelType, assignedpumperid: r.assignedPumperId, startmeter: r.startMeter, endmeter: r.endMeter, testingqty: r.testingQty, status: r.status, islocked: r.isLocked, unitprice: r.unitPrice
          }));
          await supabase.from('pump_readings').upsert(readingsToUpsert);
        }
      }
    };
    syncActiveShift();
  }, [activeShift]);

  useEffect(() => {
    const syncHistory = async () => {
      if (shiftHistory.length > 0) {
        for (const shift of shiftHistory) {
          const { pumpReadings, ...shiftData } = shift;
          await supabase.from('shifts').upsert({
            id: shiftData.id, name: shiftData.name, supervisorid: shiftData.supervisorId, starttime: shiftData.startTime, endtime: shiftData.endTime, isactive: shiftData.isActive, totalfuelsold: shiftData.totalFuelSold, totalnetsold: shiftData.totalNetSold, totalnetsales: shiftData.totalNetSales
          });
          if (pumpReadings && pumpReadings.length > 0) {
            const readingsToUpsert = pumpReadings.map(r => ({
              id: (r as any).id, shift_id: shift.id, pumpid: r.pumpId, pumpname: r.pumpName, fueltype: r.fuelType, assignedpumperid: r.assignedPumperId, startmeter: r.startMeter, endmeter: r.endMeter, testingqty: r.testingQty, status: r.status, islocked: r.isLocked, unitprice: r.unitPrice
            }));
            await supabase.from('pump_readings').upsert(readingsToUpsert);
          }
        }
      }
    };
    syncHistory();
  }, [shiftHistory]);

  useEffect(() => {
    if (deliveries.length > 0) {
      const dbPayload = deliveries.map(d => ({
        id: d.id, date: d.date, fueltype: d.fuelType, quantity: d.quantity, supplier: d.supplier, cost: d.cost
      }));
      supabase.from('stock_deliveries').upsert(dbPayload).then();
    }
  }, [deliveries]);

  useEffect(() => {
    if (priceSchedules.length > 0) {
      const dbPayload = priceSchedules.map(p => ({
        id: p.id, fueltype: p.fuelType, newprice: p.newPrice, effectivedate: p.effectiveDate, status: p.status
      }));
      supabase.from('price_schedules').upsert(dbPayload).then();
    }
  }, [priceSchedules]);

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
    console.log('Reset disabled as data is now persisted in Supabase.');
  };

  return (
    <div id="app-root-layout" className="flex min-h-screen bg-[#F4F7F6] text-[#1C1C1C] font-sans antialiased tabular-nums">
      {/* Sidebar - fixed left panel */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content Area */}
      <div id="main-content-panel" className="flex-1 ml-64 p-8 min-h-screen overflow-x-hidden">
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
