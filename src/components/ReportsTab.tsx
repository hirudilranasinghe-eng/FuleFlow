/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileText, Truck, Calendar, Search, 
  CheckCircle2, AlertTriangle, Clock, ChevronDown, 
  CreditCard, Wallet 
} from 'lucide-react';
import { Shift, StockDelivery, FuelTank, Pump, Employee, FuelType, Customer, CreditTransaction, CreditPayment } from '../types';

interface ReportsTabProps {
  shiftHistory: Shift[];
  deliveries: StockDelivery[];
  tanks: FuelTank[];
  pumps: Pump[];
  employees: Employee[];
  customers?: Customer[];
  creditTransactions?: CreditTransaction[];
  payments?: CreditPayment[];
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type SubReportTab = 'sales-prices' | 'purchases-stock' | 'card-credit' | 'deposit-customers';

export default function ReportsTab({
  shiftHistory,
  deliveries,
  tanks,
  pumps,
  employees,
  customers = [],
  creditTransactions = [],
  payments = []
}: ReportsTabProps) {
  // Navigation Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<SubReportTab>('sales-prices');
  
  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Additional Filter States
  const [selectedFuelType, setSelectedFuelType] = useState<string>('all');
  const [selectedPumper, setSelectedPumper] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Uniform Currency & Volume Formatters (Sri Lankan Rs. with tabular digit spacing)
  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)}`;
  };

  const formatLiters = (val: number) => {
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)} L`;
  };

  const getEmployeeName = (id: string | null | undefined) => {
    if (!id) return 'Unassigned';
    return employees.find(e => e.id === id)?.name || id;
  };

  // Helper for preset date changes
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (preset === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'yesterday') {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  // 1. Fallback Mock Shifts if real shift history is empty
  const allShifts = useMemo(() => {
    if (shiftHistory && shiftHistory.length > 0) {
      return shiftHistory;
    }
    const now = new Date();
    return [
      {
        id: 'SH-2026-081',
        name: 'Morning Shift (06:00 - 14:00)',
        supervisorId: 'emp-101',
        startTime: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
        isActive: false,
        totalFuelSold: 3450,
        totalNetSold: 3430,
        totalNetSales: 1217650,
        totalPhysicalCash: 1118000,
        cashVariance: -350,
        pumpReadings: [
          { pumpId: 'pump-101', pumpName: 'Pump 01', fuelType: 'Petrol 92' as FuelType, assignedPumperId: 'emp-102', startMeter: 45000, endMeter: 46120, testingQty: 5, status: 'Completed' as const, unitPrice: 355, creditSalesAmount: 45000, cardSalesAmount: 32000 },
          { pumpId: 'pump-102', pumpName: 'Pump 02', fuelType: 'Petrol 92' as FuelType, assignedPumperId: 'emp-102', startMeter: 38200, endMeter: 39150, testingQty: 5, status: 'Completed' as const, unitPrice: 355, creditSalesAmount: 18000, cardSalesAmount: 24000 },
          { pumpId: 'pump-105', pumpName: 'Pump 05', fuelType: 'Auto Diesel' as FuelType, assignedPumperId: 'emp-103', startMeter: 82000, endMeter: 83100, testingQty: 5, status: 'Completed' as const, unitPrice: 317, creditSalesAmount: 62000, cardSalesAmount: 15000 },
          { pumpId: 'pump-107', pumpName: 'Pump 07', fuelType: 'Super Diesel' as FuelType, assignedPumperId: 'emp-104', startMeter: 12400, endMeter: 12680, testingQty: 5, status: 'Completed' as const, unitPrice: 343, creditSalesAmount: 12000, cardSalesAmount: 8500 },
        ]
      },
      {
        id: 'SH-2026-080',
        name: 'Night Shift (22:00 - 06:00)',
        supervisorId: 'emp-101',
        startTime: new Date(now.getTime() - 28 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 20 * 3600 * 1000).toISOString(),
        isActive: false,
        totalFuelSold: 2890,
        totalNetSold: 2875,
        totalNetSales: 1042300,
        totalPhysicalCash: 980000,
        cashVariance: -500,
        pumpReadings: [
          { pumpId: 'pump-103', pumpName: 'Pump 03', fuelType: 'Petrol 95' as FuelType, assignedPumperId: 'emp-104', startMeter: 19500, endMeter: 20250, testingQty: 5, status: 'Completed' as const, unitPrice: 410, creditSalesAmount: 25000, cardSalesAmount: 18000 },
          { pumpId: 'pump-106', pumpName: 'Pump 06', fuelType: 'Auto Diesel' as FuelType, assignedPumperId: 'emp-103', startMeter: 61000, endMeter: 62400, testingQty: 5, status: 'Completed' as const, unitPrice: 317, creditSalesAmount: 38000, cardSalesAmount: 12000 },
          { pumpId: 'pump-101', pumpName: 'Pump 01', fuelType: 'Petrol 92' as FuelType, assignedPumperId: 'emp-102', startMeter: 44200, endMeter: 45000, testingQty: 5, status: 'Completed' as const, unitPrice: 355, creditSalesAmount: 15000, cardSalesAmount: 10000 },
        ]
      },
      {
        id: 'SH-2026-079',
        name: 'Evening Shift (14:00 - 22:00)',
        supervisorId: 'emp-101',
        startTime: new Date(now.getTime() - 52 * 3600 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 44 * 3600 * 1000).toISOString(),
        isActive: false,
        totalFuelSold: 4120,
        totalNetSold: 4100,
        totalNetSales: 1485600,
        totalPhysicalCash: 1350000,
        cashVariance: 0,
        pumpReadings: [
          { pumpId: 'pump-101', pumpName: 'Pump 01', fuelType: 'Petrol 92' as FuelType, assignedPumperId: 'emp-102', startMeter: 42800, endMeter: 44200, testingQty: 5, status: 'Completed' as const, unitPrice: 355, creditSalesAmount: 52000, cardSalesAmount: 41000 },
          { pumpId: 'pump-103', pumpName: 'Pump 03', fuelType: 'Petrol 95' as FuelType, assignedPumperId: 'emp-104', startMeter: 18400, endMeter: 19500, testingQty: 5, status: 'Completed' as const, unitPrice: 410, creditSalesAmount: 31000, cardSalesAmount: 22000 },
          { pumpId: 'pump-105', pumpName: 'Pump 05', fuelType: 'Auto Diesel' as FuelType, assignedPumperId: 'emp-103', startMeter: 79500, endMeter: 81100, testingQty: 10, status: 'Completed' as const, unitPrice: 317, creditSalesAmount: 78000, cardSalesAmount: 19000 },
        ]
      }
    ];
  }, [shiftHistory]);

  // 2. Fallback Mock Deliveries if empty
  const allDeliveries = useMemo(() => {
    if (deliveries && deliveries.length > 0) {
      return deliveries;
    }
    const now = new Date();
    return [
      {
        id: 'DEL-2026-901',
        date: new Date(now.getTime() - 2 * 86400000).toISOString(),
        fuelType: 'Petrol 92' as FuelType,
        tankId: 'tank-petrol92',
        tankName: 'Tank 01 - Petrol 92',
        quantity: 6500,
        supplier: 'Ceylon Petroleum Corporation (CPC)',
        cost: 2145000
      },
      {
        id: 'DEL-2026-902',
        date: new Date(now.getTime() - 5 * 86400000).toISOString(),
        fuelType: 'Auto Diesel' as FuelType,
        tankId: 'tank-autodiesel',
        tankName: 'Tank 03 - Auto Diesel',
        quantity: 8000,
        supplier: 'Lanka IOC PLC',
        cost: 2360000
      },
      {
        id: 'DEL-2026-903',
        date: new Date(now.getTime() - 9 * 86400000).toISOString(),
        fuelType: 'Petrol 95' as FuelType,
        tankId: 'tank-petrol95',
        tankName: 'Tank 02 - Petrol 95',
        quantity: 5000,
        supplier: 'CPC Sapugaskanda Refinery',
        cost: 1950000
      },
      {
        id: 'DEL-2026-904',
        date: new Date(now.getTime() - 14 * 86400000).toISOString(),
        fuelType: 'Super Diesel' as FuelType,
        tankId: 'tank-superdiesel',
        tankName: 'Tank 04 - Super Diesel',
        quantity: 4500,
        supplier: 'Lanka IOC PLC',
        cost: 1417500
      }
    ];
  }, [deliveries]);

  // 3. Fallback Mock Customers if empty
  const allCustomers = useMemo(() => {
    if (customers && customers.length > 0) {
      return customers;
    }
    return [
      {
        id: 'cust-101',
        name: 'Saman Logistics & Transport (Pvt) Ltd',
        phone: '0771234567',
        customerType: 'Deposit' as const,
        creditLimit: 500000,
        currentBalance: 120000,
        depositBalance: 380000,
        allowedCreditDays: 30,
        address: 'No 45, Baseline Road, Colombo 09',
        vehicleNumbers: ['WP-CAB-1234', 'WP-DAF-8890', 'WP-GE-5521'],
        status: 'Active' as const,
        createdAt: '2025-01-15'
      },
      {
        id: 'cust-102',
        name: 'United Transporters Lanka',
        phone: '0719876543',
        customerType: 'Deposit' as const,
        creditLimit: 750000,
        currentBalance: 210000,
        depositBalance: 540000,
        allowedCreditDays: 14,
        address: 'Kandy Road, Kelaniya',
        vehicleNumbers: ['WP-ND-4410', 'WP-LH-9011'],
        status: 'Active' as const,
        createdAt: '2025-02-10'
      },
      {
        id: 'cust-103',
        name: 'Perera Auto Services & Chitty Acc',
        phone: '0754433221',
        customerType: 'Credit' as const,
        creditLimit: 250000,
        currentBalance: 185000,
        depositBalance: 0,
        allowedCreditDays: 14,
        address: 'Galle Road, Dehiwala',
        vehicleNumbers: ['WP-CAD-7711'],
        status: 'Active' as const,
        createdAt: '2025-03-01'
      },
      {
        id: 'cust-104',
        name: 'Lanka Heavy Construction Deposit Acc',
        phone: '0703322110',
        customerType: 'Deposit' as const,
        creditLimit: 1000000,
        currentBalance: 350000,
        depositBalance: 650000,
        allowedCreditDays: 30,
        address: 'High Level Road, Maharagama',
        vehicleNumbers: ['WP-EX-101', 'WP-EX-102'],
        status: 'Active' as const,
        createdAt: '2025-04-12'
      }
    ];
  }, [customers]);

  // List of active Pumpers for dropdown filter
  const pumperEmployees = useMemo(() => {
    return employees.filter(e => e.role === 'Pumper' || e.role === 'Supervisor');
  }, [employees]);

  // --- FILTERED DATASETS ---

  // Sub-Tab 1: Filtered Shift Sales (Sales Report with Fuel Prices)
  const filteredShiftSalesRows = useMemo(() => {
    const rows: Array<{
      shiftId: string;
      shiftName: string;
      shiftDate: string;
      supervisorName: string;
      pumpName: string;
      fuelType: FuelType;
      pumperId: string | null;
      pumperName: string;
      startMeter: number;
      endMeter: number;
      testingQty: number;
      netSoldLiters: number;
      unitPrice: number;
      grossRevenue: number;
      creditSales: number;
      cardSales: number;
      netCash: number;
    }> = [];

    allShifts.forEach(s => {
      if (!s.startTime) return;
      const shiftDate = s.startTime.split('T')[0];
      if (shiftDate < startDate || shiftDate > endDate) return;

      const supervisor = getEmployeeName(s.supervisorId);
      const readings = s.pumpReadings || [];

      readings.forEach(r => {
        // Fuel Type Filter
        if (selectedFuelType !== 'all' && r.fuelType !== selectedFuelType) return;
        
        // Pumper Filter
        if (selectedPumper !== 'all' && r.assignedPumperId !== selectedPumper) return;

        const pumperName = getEmployeeName(r.assignedPumperId);
        const qGross = Math.max(0, r.endMeter - r.startMeter);
        const testing = r.testingQty || 0;
        const netSold = Math.max(0, qGross - testing);
        const price = r.unitPrice || tanks.find(t => t.fuelType === r.fuelType)?.pricePerLiter || 355;
        const grossRev = netSold * price;
        const credit = r.creditSalesAmount || 0;
        const card = r.cardSalesAmount || 0;
        const netCash = Math.max(0, grossRev - credit - card);

        // Text Search
        const q = searchQuery.toLowerCase().trim();
        if (q) {
          const matchShift = s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
          const matchPumper = pumperName.toLowerCase().includes(q);
          const matchFuel = r.fuelType.toLowerCase().includes(q);
          const matchPump = r.pumpName.toLowerCase().includes(q);
          const matchSup = supervisor.toLowerCase().includes(q);
          if (!matchShift && !matchPumper && !matchFuel && !matchPump && !matchSup) return;
        }

        rows.push({
          shiftId: s.id,
          shiftName: s.name,
          shiftDate,
          supervisorName: supervisor,
          pumpName: r.pumpName,
          fuelType: r.fuelType,
          pumperId: r.assignedPumperId,
          pumperName,
          startMeter: r.startMeter,
          endMeter: r.endMeter,
          testingQty: testing,
          netSoldLiters: netSold,
          unitPrice: price,
          grossRevenue: grossRev,
          creditSales: credit,
          cardSales: card,
          netCash
        });
      });
    });

    return rows;
  }, [allShifts, startDate, endDate, selectedFuelType, selectedPumper, searchQuery, tanks, employees]);

  // Sub-Tab 2: Filtered Stock Deliveries & Purchases
  const filteredPurchasesRows = useMemo(() => {
    return allDeliveries.filter(d => {
      if (!d.date) return false;
      const delDate = d.date.split('T')[0];
      if (delDate < startDate || delDate > endDate) return false;

      if (selectedFuelType !== 'all' && d.fuelType !== selectedFuelType) return false;

      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchId = d.id.toLowerCase().includes(q);
        const matchSupplier = d.supplier.toLowerCase().includes(q);
        const matchFuel = d.fuelType.toLowerCase().includes(q);
        const matchTank = (d.tankName || '').toLowerCase().includes(q);
        if (!matchId && !matchSupplier && !matchFuel && !matchTank) return false;
      }
      return true;
    });
  }, [allDeliveries, startDate, endDate, selectedFuelType, searchQuery]);

  // Sub-Tab 3: Filtered Card & Credit Sales Rows
  const filteredCardCreditRows = useMemo(() => {
    const rows: Array<{
      id: string;
      date: string;
      shiftId: string;
      pumperName: string;
      customerOrTerminal: string;
      referenceNo: string;
      saleType: 'Credit' | 'Card';
      amount: number;
    }> = [];

    allShifts.forEach(s => {
      if (!s.startTime) return;
      const shiftDate = s.startTime.split('T')[0];
      if (shiftDate < startDate || shiftDate > endDate) return;

      const readings = s.pumpReadings || [];
      readings.forEach((r, idx) => {
        if (selectedPumper !== 'all' && r.assignedPumperId !== selectedPumper) return;
        if (selectedFuelType !== 'all' && r.fuelType !== selectedFuelType) return;

        const pName = getEmployeeName(r.assignedPumperId);

        // Add Credit Entry if present
        if (r.creditSalesAmount && r.creditSalesAmount > 0) {
          const custName = 'Registered Credit Customer';
          const refNo = `CH-${s.id.slice(-4)}-P${r.pumpName.replace(/\D/g, '') || idx}`;
          
          const q = searchQuery.toLowerCase().trim();
          let matched = true;
          if (q) {
            matched = s.id.toLowerCase().includes(q) || pName.toLowerCase().includes(q) || custName.toLowerCase().includes(q) || refNo.toLowerCase().includes(q);
          }

          if (matched) {
            rows.push({
              id: `cred-${s.id}-${r.pumpId}-${idx}`,
              date: shiftDate,
              shiftId: s.id,
              pumperName: pName,
              customerOrTerminal: custName,
              referenceNo: refNo,
              saleType: 'Credit',
              amount: r.creditSalesAmount
            });
          }
        }

        // Add Card Entry if present
        if (r.cardSalesAmount && r.cardSalesAmount > 0) {
          const terminal = 'Commercial Bank POS Terminal 01';
          const refNo = `POS-${s.id.slice(-4)}-P${r.pumpName.replace(/\D/g, '') || idx}`;

          const q = searchQuery.toLowerCase().trim();
          let matched = true;
          if (q) {
            matched = s.id.toLowerCase().includes(q) || pName.toLowerCase().includes(q) || terminal.toLowerCase().includes(q) || refNo.toLowerCase().includes(q);
          }

          if (matched) {
            rows.push({
              id: `card-${s.id}-${r.pumpId}-${idx}`,
              date: shiftDate,
              shiftId: s.id,
              pumperName: pName,
              customerOrTerminal: terminal,
              referenceNo: refNo,
              saleType: 'Card',
              amount: r.cardSalesAmount
            });
          }
        }
      });
    });

    // Also blend in explicit creditTransactions if available and matched
    creditTransactions.forEach(ct => {
      const ctDate = ct.date ? ct.date.split('T')[0] : '';
      if (ctDate && ctDate >= startDate && ctDate <= endDate) {
        const q = searchQuery.toLowerCase().trim();
        let matched = true;
        if (q) {
          matched = ct.customerName.toLowerCase().includes(q) || ct.invoiceNumber.toLowerCase().includes(q) || ct.fuelType.toLowerCase().includes(q);
        }
        if (matched) {
          rows.push({
            id: ct.id,
            date: ctDate,
            shiftId: 'Direct Chitty',
            pumperName: 'Office Desk',
            customerOrTerminal: ct.customerName,
            referenceNo: ct.invoiceNumber || ct.vehicleNumber || 'INV-DIRECT',
            saleType: 'Credit',
            amount: ct.totalAmount
          });
        }
      }
    });

    return rows;
  }, [allShifts, creditTransactions, startDate, endDate, selectedPumper, selectedFuelType, searchQuery, employees]);

  // Sub-Tab 4: Deposit Customers Summary Rows
  const filteredDepositCustomersRows = useMemo(() => {
    return allCustomers.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchType = c.customerType.toLowerCase().includes(q);
        const matchVehicles = (c.vehicleNumbers || []).some(v => v.toLowerCase().includes(q));
        if (!matchName && !matchPhone && !matchType && !matchVehicles) return false;
      }
      return true;
    });
  }, [allCustomers, searchQuery]);

  // --- SUB-REPORT AGGREGATED STATS ---

  // Sub-Tab 1 Aggregates
  const salesPricesTotals = useMemo(() => {
    let liters = 0;
    let gross = 0;
    let nonCash = 0;
    let netCash = 0;

    filteredShiftSalesRows.forEach(r => {
      liters += r.netSoldLiters;
      gross += r.grossRevenue;
      nonCash += (r.creditSales + r.cardSales);
      netCash += r.netCash;
    });

    return { liters, gross, nonCash, netCash };
  }, [filteredShiftSalesRows]);

  // Sub-Tab 2 Aggregates
  const purchasesTotals = useMemo(() => {
    let liters = 0;
    let cost = 0;

    filteredPurchasesRows.forEach(r => {
      liters += (r.quantity || 0);
      cost += (r.cost || 0);
    });

    return { liters, cost, count: filteredPurchasesRows.length };
  }, [filteredPurchasesRows]);

  // Sub-Tab 3 Aggregates
  const cardCreditTotals = useMemo(() => {
    let totalCredit = 0;
    let totalCard = 0;

    filteredCardCreditRows.forEach(r => {
      if (r.saleType === 'Credit') {
        totalCredit += r.amount;
      } else {
        totalCard += r.amount;
      }
    });

    return {
      totalCredit,
      totalCard,
      totalNonCash: totalCredit + totalCard
    };
  }, [filteredCardCreditRows]);

  // Sub-Tab 4 Aggregates
  const depositCustomersTotals = useMemo(() => {
    let totalLimitOrAdvance = 0;
    let totalUtilized = 0;
    let totalAvailableDeposit = 0;

    filteredDepositCustomersRows.forEach(c => {
      const adv = c.depositBalance + c.currentBalance;
      totalLimitOrAdvance += adv;
      totalUtilized += c.currentBalance;
      totalAvailableDeposit += c.depositBalance;
    });

    return {
      totalLimitOrAdvance,
      totalUtilized,
      totalAvailableDeposit,
      count: filteredDepositCustomersRows.length
    };
  }, [filteredDepositCustomersRows]);

  return (
    <div id="reports-tab-root" className="space-y-3 pb-8">
      {/* 1. COMPACT PAGE HEADER */}
      <div id="reports-top-header" className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-2.5">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Financial & Fuel Operations Reports</span>
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Shift fuel sales with daily prices, stock deliveries, card/credit sales, and deposit customer balances.
          </p>
        </div>
      </div>

      {/* 2. SUB-REPORT TABS NAVIGATION BAR */}
      <div id="reports-subtabs-nav" className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex flex-wrap gap-1.5 no-print">
        <button
          id="tab-btn-sales-prices"
          onClick={() => setActiveSubTab('sales-prices')}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'sales-prices'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>1. Sales Report (With Fuel Prices)</span>
        </button>

        <button
          id="tab-btn-purchases-stock"
          onClick={() => setActiveSubTab('purchases-stock')}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'purchases-stock'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>2. Purchases & Stock Deliveries</span>
        </button>

        <button
          id="tab-btn-card-credit"
          onClick={() => setActiveSubTab('card-credit')}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'card-credit'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>3. Card & Credit Sales</span>
        </button>

        <button
          id="tab-btn-deposit-customers"
          onClick={() => setActiveSubTab('deposit-customers')}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'deposit-customers'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>4. Deposit Customers Summary</span>
        </button>
      </div>

      {/* 3. UNIFIED DATE RANGE FILTER TOOLBAR */}
      <div id="reports-filter-toolbar" className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-3 no-print">
        {/* Top Row: Date Presets & Custom Date Range Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-2.5">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Period:</span>
            </span>
            {(['today', 'yesterday', 'week', 'month', 'custom'] as DatePreset[]).map((p) => (
              <button
                key={p}
                id={`preset-btn-${p}`}
                onClick={() => handlePresetChange(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${
                  datePreset === p
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums">
            <span className="text-gray-400 font-sans font-medium text-[11px]">From</span>
            <input
              type="date"
              id="report-start-date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
            />
            <span className="text-gray-400 font-sans font-medium text-[11px]">To</span>
            <input
              type="date"
              id="report-end-date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Bottom Row: Fuel Type, Pumper, and Customer Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Fuel Type Dropdown */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fuel Type</label>
            <div className="relative">
              <select
                id="filter-fuel-type"
                value={selectedFuelType}
                onChange={(e) => setSelectedFuelType(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold py-1.5 pl-2.5 pr-7 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
              >
                <option value="all">All Fuel Types</option>
                <option value="Petrol 92">Petrol 92</option>
                <option value="Petrol 95">Petrol 95</option>
                <option value="Auto Diesel">Auto Diesel</option>
                <option value="Super Diesel">Super Diesel</option>
                <option value="Oil & Lubricants">Oil & Lubricants</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Pumper Dropdown */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pumper / Staff</label>
            <div className="relative">
              <select
                id="filter-pumper"
                value={selectedPumper}
                onChange={(e) => setSelectedPumper(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold py-1.5 pl-2.5 pr-7 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
              >
                <option value="all">All Staff & Pumpers</option>
                {pumperEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
              <input
                type="text"
                id="filter-search-query"
                placeholder="Search customer, pumper, invoice, shift..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-medium pl-7 pr-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- SUB-TAB 1: SALES REPORT (WITH FUEL PRICES) --- */}
      {activeSubTab === 'sales-prices' && (
        <div id="subtab-view-sales-prices" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden printable-area">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Shift Fuel Sales Audit Report (With Date Fuel Prices)</span>
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Full nozzle meter readings, fuel prices on date, testing deductions, and net cash sales breakdown.
              </p>
            </div>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-md font-mono tabular-nums">
              {filteredShiftSalesRows.length} Line Items Filtered
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Shift & Date</th>
                  <th className="py-2.5 px-3">Pump / Nozzle</th>
                  <th className="py-2.5 px-3">Fuel Product</th>
                  <th className="py-2.5 px-3">Assigned Pumper</th>
                  <th className="py-2.5 px-3 text-right">Liters Dispensed</th>
                  <th className="py-2.5 px-3 text-right">Unit Price (Rs/L)</th>
                  <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                  <th className="py-2.5 px-3 text-right">Non-Cash (Card+Credit)</th>
                  <th className="py-2.5 px-3 text-right">Net Physical Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShiftSalesRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400 font-medium">
                      No shift sales data found matching your selected date range and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredShiftSalesRows.map((r, idx) => (
                    <tr key={`${r.shiftId}-${r.pumpName}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        <div className="text-blue-600 font-mono text-[11px]">{r.shiftId}</div>
                        <div className="text-[10px] text-gray-500 font-normal font-mono tabular-nums">{r.shiftDate} ({r.shiftName})</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-gray-800">{r.pumpName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                          {r.fuelType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-700">{r.pumperName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono tabular-nums">
                        {r.netSoldLiters.toLocaleString()} L
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700 font-mono tabular-nums">
                        Rs. {r.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono tabular-nums">
                        {formatCurrency(r.grossRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-700 font-mono tabular-nums">
                        {formatCurrency(r.creditSales + r.cardSales)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700 font-mono tabular-nums">
                        {formatCurrency(r.netCash)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredShiftSalesRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-[10px]">
                      Filtered Total Shift Sales Summary:
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-xs">
                      {formatLiters(salesPricesTotals.liters)}
                    </td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-xs">
                      {formatCurrency(salesPricesTotals.gross)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-300 text-xs">
                      {formatCurrency(salesPricesTotals.nonCash)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-xs">
                      {formatCurrency(salesPricesTotals.netCash)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 2: PURCHASES & STOCK DELIVERIES --- */}
      {activeSubTab === 'purchases-stock' && (
        <div id="subtab-view-purchases-stock" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden printable-area">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span>Purchases & Stock Deliveries Audit Log</span>
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Bulk fuel tanker deliveries, petroleum distributor invoices, delivered volume, and cost calculations.
              </p>
            </div>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-md font-mono tabular-nums">
              {filteredPurchasesRows.length} Deliveries Received
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Delivery Date & Time</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Invoice / Ref No</th>
                  <th className="py-2.5 px-3">Fuel / Product</th>
                  <th className="py-2.5 px-3">Target Tank</th>
                  <th className="py-2.5 px-3 text-right">Delivered Volume (L)</th>
                  <th className="py-2.5 px-3 text-right">Base Rate (Rs/L)</th>
                  <th className="py-2.5 px-3 text-right">Total Purchase Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPurchasesRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400 font-medium">
                      No stock deliveries found matching your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPurchasesRows.map((d) => {
                    const rate = d.quantity ? (d.cost / d.quantity) : 0;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-gray-800 font-mono tabular-nums text-[11px]">
                          {new Date(d.date).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{d.supplier}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 text-[11px]">
                          {`INV-${d.id.slice(-6)}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700">
                            {d.fuelType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium">{d.tankName || d.tankId || 'Main Storage Tank'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono tabular-nums">
                          {d.quantity.toLocaleString()} L
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-700 font-mono tabular-nums">
                          Rs. {rate.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-gray-900 font-mono tabular-nums">
                          {formatCurrency(d.cost)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredPurchasesRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-[10px]">
                      Total Delivered Volume & Stock Expenditure:
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-purple-300 text-xs">
                      {formatLiters(purchasesTotals.liters)}
                    </td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-purple-300 text-xs">
                      {formatCurrency(purchasesTotals.cost)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: CARD & CREDIT SALES --- */}
      {activeSubTab === 'card-credit' && (
        <div id="subtab-view-card-credit" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden printable-area">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Card & Credit Sales Breakdown</span>
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Detailed non-cash transaction ledger listing pumper, customer, POS terminal, and reference chitty details.
              </p>
            </div>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-md font-mono tabular-nums">
              {filteredCardCreditRows.length} Non-Cash Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Shift ID</th>
                  <th className="py-2.5 px-3">Pumper Name</th>
                  <th className="py-2.5 px-3">Customer / POS Terminal</th>
                  <th className="py-2.5 px-3">Reference No</th>
                  <th className="py-2.5 px-3">Sale Type</th>
                  <th className="py-2.5 px-3 text-right">Amount (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCardCreditRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 font-medium">
                      No non-cash card or credit sales found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredCardCreditRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-gray-800 font-mono tabular-nums text-[11px]">{r.date}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-600 font-bold text-[11px]">{r.shiftId}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-700">{r.pumperName}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{r.customerOrTerminal}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">{r.referenceNo}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.saleType === 'Credit' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {r.saleType} Sale
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-gray-900 font-mono tabular-nums">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredCardCreditRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider text-[10px]">
                      Total Non-Cash (Credit + Card) Amount:
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-xs">
                      {formatCurrency(cardCreditTotals.totalNonCash)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 4: DEPOSIT CUSTOMERS SUMMARY --- */}
      {activeSubTab === 'deposit-customers' && (
        <div id="subtab-view-deposit-customers" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden printable-area">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Deposit & Advance-Paying Customers Summary</span>
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Prepaid advance deposits, current fuel utilization, and available credit/deposit balances per customer account.
              </p>
            </div>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-md font-mono tabular-nums">
              {filteredDepositCustomersRows.length} Accounts Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Customer Name & Code</th>
                  <th className="py-2.5 px-3">Contact / Vehicles</th>
                  <th className="py-2.5 px-3">Account Type</th>
                  <th className="py-2.5 px-3 text-right">Total Advance / Limit</th>
                  <th className="py-2.5 px-3 text-right">Total Utilized Sales</th>
                  <th className="py-2.5 px-3 text-right">Available Deposit Balance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDepositCustomersRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 font-medium">
                      No customer accounts matched your search keyword.
                    </td>
                  </tr>
                ) : (
                  filteredDepositCustomersRows.map((c) => {
                    const totalAdv = c.depositBalance + c.currentBalance;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          <div>{c.name}</div>
                          <div className="text-[10px] font-mono text-blue-600 font-normal">{c.id}</div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          <div className="font-mono text-[11px] font-medium">{c.phone}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {(c.vehicleNumbers || []).join(', ') || 'No vehicles registered'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.customerType === 'Deposit'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {c.customerType} Customer
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-800 font-mono tabular-nums">
                          {formatCurrency(totalAdv)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-700 font-mono tabular-nums">
                          {formatCurrency(c.currentBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 font-mono tabular-nums">
                          {formatCurrency(c.depositBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.status === 'Overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {c.status === 'Active' && <CheckCircle2 className="w-3 h-3" />}
                            {c.status === 'Overdue' && <AlertTriangle className="w-3 h-3" />}
                            <span>{c.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredDepositCustomersRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider text-[10px]">
                      Total Customers Account Summary:
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-300 text-xs">
                      {formatCurrency(depositCustomersTotals.totalLimitOrAdvance)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-300 text-xs">
                      {formatCurrency(depositCustomersTotals.totalUtilized)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-xs">
                      {formatCurrency(depositCustomersTotals.totalAvailableDeposit)}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
