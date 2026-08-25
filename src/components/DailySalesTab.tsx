/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Download, Search, RefreshCw, Eye, X, Fuel, Droplet, 
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight,
  Clock, User, Layers, Receipt, ArrowUpDown, Filter, BarChart3,
  CreditCard, ShieldAlert, Sparkles, FileText, ChevronDown, Check,
  ArrowLeft
} from 'lucide-react';
import { Shift, Employee, FuelTank, OilTank, PumpReading, ChamberReading } from '../types';
import { supabase } from '../lib/supabase';

interface DailySalesTabProps {
  shiftHistory?: Shift[];
  setShiftHistory?: React.Dispatch<React.SetStateAction<Shift[]>>;
  onDeleteShift?: (shiftId: string) => void;
  employees?: Employee[];
  tanks?: FuelTank[];
  oilTanks?: OilTank[];
}

export interface DailyFuelProductSummary {
  fuelType: string;
  litersSold: number;
  ratePerLiter: number;
  revenue: number;
  volumePercentage: number;
}

export interface DailyChamberSummary {
  chamberNumber: number;
  chamberId?: string;
  grade: string;
  openingLevel: number;
  closingLevel: number;
  soldLiters: number;
  ratePerLiter: number;
  totalAmount: number;
}

export interface ShiftSummaryInDay {
  shiftId: string;
  shiftName: string;
  supervisorId: string;
  supervisorName: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  fuelVolumeSold: number;
  grossFuelSales: number;
  oilSales: number;
  grossRevenue: number;
  creditSales: number;
  cardSales: number;
  totalNonCash: number;
  expectedCash: number;
  actualCashHandedOver: number;
  variance: number;
  varianceStatus: 'Balanced' | 'Shortage' | 'Excess';
  pumperCount: number;
  handoverNotes?: string;
  pumpReadings: PumpReading[];
}

export interface DailySalesDayRecord {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Mon, Aug 17, 2026"
  shifts: Shift[];
  shiftSummaries: ShiftSummaryInDay[];
  shiftCount: number;
  shiftNames: string[];
  supervisors: string[];
  totalFuelVolume: number;
  totalForecourtOilSales: number;
  grossFuelRevenue: number;
  grossRevenue: number;
  creditSales: number;
  cardSales: number;
  totalNonCash: number;
  expectedCash: number;
  handedOverCash: number;
  variance: number;
  varianceStatus: 'Balanced' | 'Shortage' | 'Excess';
  fuelBreakdown: Record<string, DailyFuelProductSummary>;
  chamberBreakdown: DailyChamberSummary[];
  hasActiveShift: boolean;
}

export default function DailySalesTab({
  shiftHistory = [],
  employees = [],
  tanks = [],
  oilTanks = [],
}: DailySalesTabProps) {
  // Live Supabase shifts state
  const [supabaseShifts, setSupabaseShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Slide-over modal state
  const [selectedDayRecord, setSelectedDayRecord] = useState<DailySalesDayRecord | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<'all' | 'fuel' | 'oil' | 'shifts' | 'financials'>('all');

  // Helper for Sri Lankan Rupee currency formatting
  const formatRs = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0.00';
    const isNegative = amount < -0.001;
    const absVal = Math.abs(amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${isNegative ? '-' : ''}Rs. ${absVal}`;
  };

  const formatLiters = (liters: number | undefined | null): string => {
    if (liters === undefined || liters === null || isNaN(liters)) return '0.00 L';
    return `${liters.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
  };

  // Name resolution helpers
  const getSupervisorName = (id?: string) => {
    if (!id) return 'Station Supervisor';
    const found = employees.find(
      (e) => e.id === id || e.name.toLowerCase() === id.toLowerCase() || (e as any).phone === id
    );
    return found ? found.name : id;
  };

  const getPumperName = (id?: string | null) => {
    if (!id) return 'Unassigned';
    const found = employees.find((e) => e.id === id || e.name.toLowerCase() === id.toLowerCase());
    return found ? found.name : id;
  };

  // Tank price lookup map
  const tankPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    tanks.forEach((t) => {
      if (t.fuelType && t.pricePerLiter) {
        map.set(t.fuelType, t.pricePerLiter);
      }
    });
    return map;
  }, [tanks]);

  // Fetch shifts directly from Supabase for real-time audit accuracy
  const fetchShifts = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!isConfigured) {
        setSupabaseShifts(shiftHistory || []);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { data: shiftsData, error } = await supabase
        .from('shifts')
        .select(`
          *,
          pumpReadings:pump_readings(*)
        `)
        .order('starttime', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error in DailySalesTab:', error.message);
        setErrorMessage(error.message);
        setSupabaseShifts(shiftHistory || []);
      } else if (shiftsData) {
        const mapped: Shift[] = shiftsData.map((s: any) => ({
          id: s.id,
          name: s.name || `Shift ${s.id}`,
          supervisorId: s.supervisorid || s.supervisor_id || s.supervisorId || 'Supervisor',
          startTime: s.starttime || s.start_time || s.startTime || new Date().toISOString(),
          endTime: s.endtime || s.end_time || s.endTime,
          isActive: s.isactive ?? s.is_active ?? false,
          totalFuelSold: Number(s.totalfuelsold || s.total_fuel_sold) || 0,
          totalNetSold: Number(s.totalnetsold || s.total_net_sold) || 0,
          totalNetSales: Number(s.totalnetsales || s.total_net_sales) || 0,
          initialPumperCash: Number(s.initialpumpercash || s.initial_pumper_cash) || 0,
          replacementPumperCash: Number(s.replacementpumpercash || s.replacement_pumper_cash) || 0,
          totalPhysicalCash: Number(s.totalphysicalcash || s.total_physical_cash) || 0,
          cashVariance: Number(s.cashvariance || s.cash_variance) || 0,
          handoverNotes: s.handovernotes || s.handover_notes || '',
          replacementPumperId: s.replacementpumperid || s.replacement_pumper_id || '',
          pumpReadings: (s.pumpReadings || s.pump_readings || []).map((r: any) => ({
            pumpId: r.pump_id || r.pumpid || r.pumpId,
            pumpName: r.pump_name || r.pumpname || r.pumpName || 'Pump',
            fuelType: r.fuel_type || r.fueltype || r.fuelType || 'Fuel',
            tankId: r.tank_id || r.tankid || r.tankId,
            assignedPumperId: r.assigned_pumper_id || r.assignedpumperid || r.assignedPumperId || null,
            replacementPumperId: r.replacement_pumper_id || r.replacementpumperid || r.replacementPumperId || null,
            initialPumperCash: Number(r.initial_pumper_cash || r.initialpumpercash) || 0,
            replacementPumperCash: Number(r.replacement_pumper_cash || r.replacementpumpercash) || 0,
            handoverMeter: Number(r.handover_meter ?? r.handovermeter) || 0,
            handoverNotes: r.handover_notes || r.handovernotes || '',
            startMeter: Number(r.start_meter ?? r.startmeter) || 0,
            endMeter: Number(r.end_meter ?? r.endmeter) || 0,
            testingQty: Number(r.testing_qty ?? r.testingqty) || 0,
            status: r.status || 'Active',
            isLocked: r.is_locked ?? r.islocked ?? false,
            unitPrice: Number(r.unit_price ?? r.unitprice) || 0,
            actualCash: Number(r.actual_cash ?? r.actualcash) || 0,
            cashVariance: Number(r.cash_variance ?? r.cashvariance) || 0,
            creditSalesAmount: Number(r.credit_sales_amount ?? r.creditsalesamount) || 0,
            cardSalesAmount: Number(r.card_sales_amount ?? r.cardsalesamount) || 0,
            oilSalesAmount: Number(r.oil_sales_amount ?? r.oilsalesamount) || 0,
            chamberReadings: r.chamber_readings || r.chamberReadings || undefined,
          })),
        }));
        setSupabaseShifts(mapped);
      }
    } catch (err: any) {
      console.error('Error fetching shifts in DailySalesTab:', err);
      setErrorMessage(err?.message || 'Database query error');
      setSupabaseShifts(shiftHistory || []);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  // Update if prop shiftHistory updates and supabase state is empty
  useEffect(() => {
    if (shiftHistory && shiftHistory.length > 0 && supabaseShifts.length === 0) {
      setSupabaseShifts(shiftHistory);
    }
  }, [shiftHistory]);

  const activeSourceShifts = useMemo(() => {
    return supabaseShifts.length > 0 ? supabaseShifts : shiftHistory;
  }, [supabaseShifts, shiftHistory]);

  // Aggregate shifts into Day-by-Day Master Records
  const allDailyRecords = useMemo(() => {
    const dayMap = new Map<string, Shift[]>();

    // 1. Group shifts by date (YYYY-MM-DD)
    activeSourceShifts.forEach((shift) => {
      let dateKey = '';
      if (shift.startTime) {
        try {
          const d = new Date(shift.startTime);
          dateKey = d.toISOString().slice(0, 10);
        } catch (_) {
          dateKey = shift.startTime.slice(0, 10);
        }
      } else {
        dateKey = new Date().toISOString().slice(0, 10);
      }

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(shift);
    });

    // 2. Build detailed aggregation for each date
    const dailyRecords: DailySalesDayRecord[] = [];

    dayMap.forEach((shiftsInDay, dateKey) => {
      let totalFuelVolume = 0;
      let totalForecourtOilSales = 0;
      let grossFuelRevenue = 0;
      let creditSales = 0;
      let cardSales = 0;
      let handedOverCash = 0;
      let hasActiveShift = false;

      const shiftNames: string[] = [];
      const supervisorsSet = new Set<string>();
      const shiftSummaries: ShiftSummaryInDay[] = [];

      // Fuel breakdown accumulator
      const fuelBreakdownAcc: Record<string, { liters: number; rateSum: number; count: number; revenue: number }> = {
        'Petrol 92': { liters: 0, rateSum: 0, count: 0, revenue: 0 },
        'Petrol 95': { liters: 0, rateSum: 0, count: 0, revenue: 0 },
        'Auto Diesel': { liters: 0, rateSum: 0, count: 0, revenue: 0 },
        'Super Diesel': { liters: 0, rateSum: 0, count: 0, revenue: 0 },
      };

      // 4-Chamber accumulator
      const chamberMap = new Map<number, DailyChamberSummary>();

      shiftsInDay.forEach((shift) => {
        if (shift.isActive) hasActiveShift = true;
        if (shift.name && !shiftNames.includes(shift.name)) {
          shiftNames.push(shift.name);
        }

        const supervisorName = getSupervisorName(shift.supervisorId);
        supervisorsSet.add(supervisorName);

        let shiftFuelVol = 0;
        let shiftFuelRev = 0;
        let shiftOilRev = 0;
        let shiftCredit = 0;
        let shiftCard = 0;
        let shiftActualCashSum = 0;
        const pumperIdsSet = new Set<string>();

        const readings = shift.pumpReadings || [];
        readings.forEach((r) => {
          if (r.assignedPumperId) pumperIdsSet.add(r.assignedPumperId);
          if (r.replacementPumperId) pumperIdsSet.add(r.replacementPumperId);

          const isOilBay =
            r.pumpId === 'pump-oil-bay' ||
            r.fuelType === 'Oil & Lubricants' ||
            (r.pumpName && r.pumpName.toLowerCase().includes('oil'));

          if (isOilBay) {
            const oilAmount = r.oilSalesAmount || 0;
            shiftOilRev += oilAmount;
            totalForecourtOilSales += oilAmount;

            // Chamber readings
            if (r.chamberReadings && Array.isArray(r.chamberReadings)) {
              r.chamberReadings.forEach((ch) => {
                const chNum = ch.chamberNumber || 1;
                const sold = ch.soldLiters || Math.max(0, (ch.openingLevel || 0) - (ch.closingLevel || 0));
                const amt = ch.totalAmount || sold * (ch.ratePerLiter || 0);

                if (!chamberMap.has(chNum)) {
                  chamberMap.set(chNum, {
                    chamberNumber: chNum,
                    chamberId: ch.chamberId,
                    grade: ch.grade || `Chamber ${chNum}`,
                    openingLevel: ch.openingLevel || 0,
                    closingLevel: ch.closingLevel || 0,
                    soldLiters: 0,
                    ratePerLiter: ch.ratePerLiter || 0,
                    totalAmount: 0,
                  });
                }
                const exist = chamberMap.get(chNum)!;
                exist.soldLiters += sold;
                exist.totalAmount += amt;
                if (ch.ratePerLiter > 0) exist.ratePerLiter = ch.ratePerLiter;
                exist.closingLevel = ch.closingLevel || exist.closingLevel;
              });
            }
          } else {
            const soldLiters = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0) - (r.testingQty || 0));
            const unitPrice = (r.unitPrice && r.unitPrice > 0) ? r.unitPrice : (tankPriceMap.get(r.fuelType) || 0);
            const fuelRev = soldLiters * unitPrice;

            shiftFuelVol += soldLiters;
            shiftFuelRev += fuelRev;
            totalFuelVolume += soldLiters;
            grossFuelRevenue += fuelRev;

            if (!fuelBreakdownAcc[r.fuelType]) {
              fuelBreakdownAcc[r.fuelType] = { liters: 0, rateSum: 0, count: 0, revenue: 0 };
            }
            fuelBreakdownAcc[r.fuelType].liters += soldLiters;
            fuelBreakdownAcc[r.fuelType].revenue += fuelRev;
            if (unitPrice > 0) {
              fuelBreakdownAcc[r.fuelType].rateSum += unitPrice;
              fuelBreakdownAcc[r.fuelType].count += 1;
            }
          }

          shiftCredit += r.creditSalesAmount || 0;
          shiftCard += r.cardSalesAmount || 0;
          shiftActualCashSum += r.actualCash || 0;
        });

        // Shift calculations
        let shiftGross = shiftFuelRev + shiftOilRev;
        if (shiftGross === 0 && (shift.totalNetSales || 0) > 0) {
          shiftGross = shift.totalNetSales;
        }

        const shiftNonCash = shiftCredit + shiftCard;
        const shiftExpectedCash = Math.max(0, shiftGross - shiftNonCash);

        let shiftHandedCash = shiftActualCashSum;
        if (shiftHandedCash === 0 && shift.totalPhysicalCash !== undefined && shift.totalPhysicalCash > 0) {
          shiftHandedCash = shift.totalPhysicalCash;
        } else if (
          shiftHandedCash === 0 &&
          (shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0) > 0
        ) {
          shiftHandedCash = (shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0);
        }

        const shiftVariance = shift.cashVariance !== undefined && shift.cashVariance !== 0
          ? shift.cashVariance
          : (shiftHandedCash - shiftExpectedCash);

        let shiftVarianceStatus: 'Balanced' | 'Shortage' | 'Excess' = 'Balanced';
        if (shiftVariance < -0.01) shiftVarianceStatus = 'Shortage';
        else if (shiftVariance > 0.01) shiftVarianceStatus = 'Excess';

        creditSales += shiftCredit;
        cardSales += shiftCard;
        handedOverCash += shiftHandedCash;

        shiftSummaries.push({
          shiftId: shift.id,
          shiftName: shift.name || `Shift ${shift.id}`,
          supervisorId: shift.supervisorId,
          supervisorName,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isActive: shift.isActive,
          fuelVolumeSold: shiftFuelVol,
          grossFuelSales: shiftFuelRev,
          oilSales: shiftOilRev,
          grossRevenue: shiftGross,
          creditSales: shiftCredit,
          cardSales: shiftCard,
          totalNonCash: shiftNonCash,
          expectedCash: shiftExpectedCash,
          actualCashHandedOver: shiftHandedCash,
          variance: shiftVariance,
          varianceStatus: shiftVarianceStatus,
          pumperCount: Math.max(1, pumperIdsSet.size),
          handoverNotes: shift.handoverNotes,
          pumpReadings: shift.pumpReadings || [],
        });
      });

      // Total gross for the day
      let grossRevenue = grossFuelRevenue + totalForecourtOilSales;
      const totalNonCash = creditSales + cardSales;
      const expectedCash = Math.max(0, grossRevenue - totalNonCash);
      const variance = handedOverCash - expectedCash;

      let varianceStatus: 'Balanced' | 'Shortage' | 'Excess' = 'Balanced';
      if (variance < -0.01) varianceStatus = 'Shortage';
      else if (variance > 0.01) varianceStatus = 'Excess';

      // Format localized date
      let formattedDate = dateKey;
      try {
        const [year, month, day] = dateKey.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        formattedDate = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch (_) {}

      // Finalize Fuel Breakdown
      const finalFuelBreakdown: Record<string, DailyFuelProductSummary> = {};
      Object.entries(fuelBreakdownAcc).forEach(([fuelType, data]) => {
        const avgRate = data.count > 0 ? data.rateSum / data.count : (tankPriceMap.get(fuelType) || 0);
        const volumePct = totalFuelVolume > 0 ? (data.liters / totalFuelVolume) * 100 : 0;

        finalFuelBreakdown[fuelType] = {
          fuelType,
          litersSold: data.liters,
          ratePerLiter: avgRate,
          revenue: data.revenue,
          volumePercentage: volumePct,
        };
      });

      dailyRecords.push({
        date: dateKey,
        formattedDate,
        shifts: shiftsInDay,
        shiftSummaries,
        shiftCount: shiftsInDay.length,
        shiftNames,
        supervisors: Array.from(supervisorsSet),
        totalFuelVolume,
        totalForecourtOilSales,
        grossFuelRevenue,
        grossRevenue,
        creditSales,
        cardSales,
        totalNonCash,
        expectedCash,
        handedOverCash,
        variance,
        varianceStatus,
        fuelBreakdown: finalFuelBreakdown,
        chamberBreakdown: Array.from(chamberMap.values()).sort((a, b) => a.chamberNumber - b.chamberNumber),
        hasActiveShift,
      });
    });

    // Sort by date descending
    return dailyRecords.sort((a, b) => b.date.localeCompare(a.date));
  }, [activeSourceShifts, tankPriceMap, employees]);

  // Handle Quick Filter & Date Bounds
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // Filtered daily records based on user search & date selectors
  const filteredDailyRecords = useMemo(() => {
    return allDailyRecords.filter((record) => {
      // 1. Date Range Filtering
      if (startDate && record.date < startDate) return false;
      if (endDate && record.date > endDate) return false;

      // 2. Search Query Filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDate = record.date.includes(q) || record.formattedDate.toLowerCase().includes(q);
        const matchesShift = record.shiftNames.some((n) => n.toLowerCase().includes(q));
        const matchesSup = record.supervisors.some((s) => s.toLowerCase().includes(q));
        const matchesFuel = Object.keys(record.fuelBreakdown).some(
          (f) => f.toLowerCase().includes(q) && record.fuelBreakdown[f].litersSold > 0
        );

        if (!matchesDate && !matchesShift && !matchesSup && !matchesFuel) {
          return false;
        }
      }

      return true;
    });
  }, [allDailyRecords, startDate, endDate, searchQuery]);

  // High-level KPI aggregations for current filtered window
  const kpiTotals = useMemo(() => {
    let totalDays = filteredDailyRecords.length;
    let totalShifts = 0;
    let totalFuelVolume = 0;
    let totalGrossRevenue = 0;
    let totalHandedOverCash = 0;
    let totalExpectedCash = 0;
    let totalCreditSales = 0;
    let totalCardSales = 0;
    let totalOilSales = 0;

    filteredDailyRecords.forEach((r) => {
      totalShifts += r.shiftCount;
      totalFuelVolume += r.totalFuelVolume;
      totalGrossRevenue += r.grossRevenue;
      totalHandedOverCash += r.handedOverCash;
      totalExpectedCash += r.expectedCash;
      totalCreditSales += r.creditSales;
      totalCardSales += r.cardSales;
      totalOilSales += r.totalForecourtOilSales;
    });

    const netVariance = totalHandedOverCash - totalExpectedCash;
    let varianceStatus: 'Balanced' | 'Shortage' | 'Excess' = 'Balanced';
    if (netVariance < -0.01) varianceStatus = 'Shortage';
    else if (netVariance > 0.01) varianceStatus = 'Excess';

    return {
      totalDays,
      totalShifts,
      totalFuelVolume,
      totalGrossRevenue,
      totalHandedOverCash,
      totalExpectedCash,
      totalCreditSales,
      totalCardSales,
      totalOilSales,
      netVariance,
      varianceStatus,
    };
  }, [filteredDailyRecords]);

  // CSV Export Utility
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export all filtered daily summary rows to CSV
  const exportMasterDailyCSV = () => {
    if (filteredDailyRecords.length === 0) return;

    const headers = [
      'Date',
      'Day of Week',
      'Shifts Included',
      'Supervisors',
      'Petrol 92 (L)',
      'Petrol 95 (L)',
      'Auto Diesel (L)',
      'Super Diesel (L)',
      'Total Fuel Volume (L)',
      'Forecourt Oil Sales (Rs.)',
      'Gross Revenue (Rs.)',
      'Credit Sales (Rs.)',
      'Card POS Sales (Rs.)',
      'Expected Physical Cash (Rs.)',
      'Handed Over Cash (Rs.)',
      'Cash Variance (Rs.)',
      'Variance Status',
    ];

    const rows = filteredDailyRecords.map((r) => {
      const p92 = r.fuelBreakdown['Petrol 92']?.litersSold || 0;
      const p95 = r.fuelBreakdown['Petrol 95']?.litersSold || 0;
      const ad = r.fuelBreakdown['Auto Diesel']?.litersSold || 0;
      const sd = r.fuelBreakdown['Super Diesel']?.litersSold || 0;

      return [
        r.date,
        r.formattedDate.split(',')[0] || '',
        `${r.shiftCount} Shift(s) (${r.shiftNames.join(', ')})`,
        r.supervisors.join(', '),
        p92.toFixed(2),
        p95.toFixed(2),
        ad.toFixed(2),
        sd.toFixed(2),
        r.totalFuelVolume.toFixed(2),
        r.totalForecourtOilSales.toFixed(2),
        r.grossRevenue.toFixed(2),
        r.creditSales.toFixed(2),
        r.cardSales.toFixed(2),
        r.expectedCash.toFixed(2),
        r.handedOverCash.toFixed(2),
        r.variance.toFixed(2),
        r.varianceStatus,
      ];
    });

    const fileDate = startDate && endDate ? `${startDate}_to_${endDate}` : todayStr;
    downloadCSV(`FuelFlow_Daily_Sales_Master_${fileDate}.csv`, headers, rows);
  };

  // Export specific single day detailed report
  const exportDayDetailCSV = (day: DailySalesDayRecord) => {
    const headers = [
      'Section',
      'Item / Shift / Product',
      'Details / Metric',
      'Volume (Liters)',
      'Rate (Rs.)',
      'Amount (Rs.)',
      'Notes / Status',
    ];

    const rows: (string | number)[][] = [
      ['METADATA', 'Date', day.formattedDate, '', '', '', ''],
      ['METADATA', 'Total Shifts', day.shiftCount, '', '', '', day.shiftNames.join(' | ')],
      ['METADATA', 'Supervisors', day.supervisors.join(', '), '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['FUEL SALES', 'Petrol 92', 'Liters Sold & Revenue', day.fuelBreakdown['Petrol 92']?.litersSold.toFixed(2) || '0', day.fuelBreakdown['Petrol 92']?.ratePerLiter.toFixed(2) || '0', day.fuelBreakdown['Petrol 92']?.revenue.toFixed(2) || '0', `${day.fuelBreakdown['Petrol 92']?.volumePercentage.toFixed(1)}% share`],
      ['FUEL SALES', 'Petrol 95', 'Liters Sold & Revenue', day.fuelBreakdown['Petrol 95']?.litersSold.toFixed(2) || '0', day.fuelBreakdown['Petrol 95']?.ratePerLiter.toFixed(2) || '0', day.fuelBreakdown['Petrol 95']?.revenue.toFixed(2) || '0', `${day.fuelBreakdown['Petrol 95']?.volumePercentage.toFixed(1)}% share`],
      ['FUEL SALES', 'Auto Diesel', 'Liters Sold & Revenue', day.fuelBreakdown['Auto Diesel']?.litersSold.toFixed(2) || '0', day.fuelBreakdown['Auto Diesel']?.ratePerLiter.toFixed(2) || '0', day.fuelBreakdown['Auto Diesel']?.revenue.toFixed(2) || '0', `${day.fuelBreakdown['Auto Diesel']?.volumePercentage.toFixed(1)}% share`],
      ['FUEL SALES', 'Super Diesel', 'Liters Sold & Revenue', day.fuelBreakdown['Super Diesel']?.litersSold.toFixed(2) || '0', day.fuelBreakdown['Super Diesel']?.ratePerLiter.toFixed(2) || '0', day.fuelBreakdown['Super Diesel']?.revenue.toFixed(2) || '0', `${day.fuelBreakdown['Super Diesel']?.volumePercentage.toFixed(1)}% share`],
      ['FUEL SALES TOTAL', 'All Fuels Total', 'Combined Fuel Volume & Revenue', day.totalFuelVolume.toFixed(2), '', day.grossFuelRevenue.toFixed(2), ''],
      ['', '', '', '', '', '', ''],
      ['LUBRICANTS', 'Forecourt Bulk Oil', '4-Chamber Dispenser & Bay Sales', '', '', day.totalForecourtOilSales.toFixed(2), ''],
      ['', '', '', '', '', '', ''],
      ...day.shiftSummaries.map((s) => [
        'SHIFT LEDGER',
        s.shiftName,
        `Supervisor: ${s.supervisorName} | ${s.pumperCount} Pumper(s)`,
        s.fuelVolumeSold.toFixed(2),
        '',
        s.grossRevenue.toFixed(2),
        `Exp: Rs. ${s.expectedCash.toFixed(2)} | Actual: Rs. ${s.actualCashHandedOver.toFixed(2)} | Var: ${s.variance >= 0 ? '+' : ''}${s.variance.toFixed(2)} (${s.varianceStatus})`,
      ]),
      ['', '', '', '', '', '', ''],
      ['FINANCIAL SETTLEMENT', 'Gross Total Revenue', 'Fuel + Lubricants', '', '', day.grossRevenue.toFixed(2), ''],
      ['FINANCIAL SETTLEMENT', 'Credit Sales (Chitty)', 'Corporate Account Receivables', '', '', day.creditSales.toFixed(2), 'Non-Cash'],
      ['FINANCIAL SETTLEMENT', 'Card Sales (POS)', 'Debit/Credit POS Swipes', '', '', day.cardSales.toFixed(2), 'Non-Cash'],
      ['FINANCIAL SETTLEMENT', 'Net Expected Cash', 'Gross - Non-Cash', '', '', day.expectedCash.toFixed(2), 'Expected Handover'],
      ['FINANCIAL SETTLEMENT', 'Physical Cash Handed Over', 'Actual Cash from Pumpers/Supervisor', '', '', day.handedOverCash.toFixed(2), 'Actual Handover'],
      ['FINANCIAL SETTLEMENT', 'Cash Variance', 'Actual - Expected', '', '', day.variance.toFixed(2), day.varianceStatus],
    ];

    downloadCSV(`Daily_Audit_${day.date}_Detailed.csv`, headers, rows);
  };

  // Color helper for fuel types
  const getFuelColorTag = (fuelType: string) => {
    switch (fuelType) {
      case 'Petrol 92':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          bar: 'bg-emerald-500',
        };
      case 'Petrol 95':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          bar: 'bg-rose-500',
        };
      case 'Auto Diesel':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200',
          dot: 'bg-amber-500',
          bar: 'bg-amber-500',
        };
      case 'Super Diesel':
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-200',
          dot: 'bg-blue-600',
          bar: 'bg-blue-600',
        };
      default:
        return {
          bg: 'bg-gray-100 text-gray-800 border-gray-200',
          dot: 'bg-gray-500',
          bar: 'bg-gray-500',
        };
    }
  };

  return (
    <div id="daily-sales-tab-root" className="space-y-5 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & FILTER BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4">
        {/* Title and Top Right Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
              <span>Daily Sales History & Settlement Ledger</span>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 font-sans">
              Consolidated day-by-day fuel volumes, lubricant sales, card/credit deductions, and cash reconciliations
            </p>
          </div>

          {/* Action buttons (aligned neatly at top right) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchShifts(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-60"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            <button
              id="btn-export-daily-sales-csv"
              onClick={exportMasterDailyCSV}
              disabled={filteredDailyRecords.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Search Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-gray-200/80 shadow-2xs">
          {/* Dual Date Picker: Start Date to End Date */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-gray-700 text-xs font-medium outline-none cursor-pointer"
                title="Start Date"
              />
              <span className="text-gray-400 font-bold text-[10px] px-0.5">TO</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-gray-700 text-xs font-medium outline-none cursor-pointer"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors ml-0.5"
                  title="Clear Dates"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {(startDate || endDate) && (
              <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 hidden md:inline">
                {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : `Until ${endDate}`}
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search date, shift, supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.5 bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MASTER DAILY SALES TABLE (Directly below Filter Bar) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Daily Consolidated Records ({filteredDailyRecords.length})
            </h2>
            {(startDate || endDate) && (
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                Filtered Date Range
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
            Click any row to open the detailed product &amp; shift settlement breakdown
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center space-y-2.5">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading shift and sales records from database...</p>
          </div>
        ) : filteredDailyRecords.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Calendar className="w-7 h-7 text-gray-300 mx-auto" />
            <p className="text-xs text-gray-600 font-bold">No daily sales records found</p>
            <p className="text-[11px] text-gray-400">
              Try adjusting your date range or search query, or open a shift in the Shift Management tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-[10px] uppercase tracking-wider border-b border-gray-100 select-none">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Shifts Included</th>
                  <th className="py-2.5 px-4 text-right">Total Fuel (L)</th>
                  <th className="py-2.5 px-4 text-right">Forecourt Oil (Rs.)</th>
                  <th className="py-2.5 px-4 text-right">Gross Revenue (Rs.)</th>
                  <th className="py-2.5 px-4 text-right">Handed Over Cash</th>
                  <th className="py-2.5 px-4 text-center">Cash Variance</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredDailyRecords.map((day) => {
                  const isToday = day.date === todayStr;
                  const isYesterday = day.date === yesterdayStr;

                  return (
                    <tr
                      key={day.date}
                      onClick={() => setSelectedDayRecord(day)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Date & relative badge */}
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-gray-100 group-hover:bg-blue-100 group-hover:text-blue-700 rounded-lg text-gray-600 transition-colors">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                              <span>{day.formattedDate}</span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-extrabold uppercase leading-tight">
                                  Today
                                </span>
                              )}
                              {isYesterday && (
                                <span className="px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded text-[9px] font-extrabold uppercase leading-tight">
                                  Yesterday
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium leading-none block mt-0.5">
                              {day.supervisors.join(', ')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Shifts Included */}
                      <td className="py-2 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded font-bold text-[10px]">
                            {day.shiftCount} {day.shiftCount === 1 ? 'Shift' : 'Shifts'}
                          </span>
                          {day.hasActiveShift && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold animate-pulse">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[180px] mt-0.5">
                          {day.shiftNames.join(', ')}
                        </div>
                      </td>

                      {/* Total Fuel Volume */}
                      <td className="py-2 px-4 text-right font-bold text-blue-600 tabular-nums text-xs">
                        {formatLiters(day.totalFuelVolume)}
                      </td>

                      {/* Forecourt Oil Sales */}
                      <td className="py-2 px-4 text-right font-medium text-gray-700 tabular-nums text-xs">
                        {formatRs(day.totalForecourtOilSales)}
                      </td>

                      {/* Gross Revenue */}
                      <td className="py-2 px-4 text-right font-bold text-slate-900 tabular-nums text-xs">
                        {formatRs(day.grossRevenue)}
                      </td>

                      {/* Handed Over Physical Cash */}
                      <td className="py-2 px-4 text-right font-semibold text-gray-900 tabular-nums text-xs">
                        {formatRs(day.handedOverCash)}
                      </td>

                      {/* Cash Variance Status Badge */}
                      <td className="py-2 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${
                            day.varianceStatus === 'Shortage'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : day.varianceStatus === 'Excess'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {day.variance >= 0 && day.variance > 0.01 ? '+' : ''}
                          {formatRs(day.variance)}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayRecord(day);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white group-hover:bg-blue-600 group-hover:text-white text-gray-700 border border-gray-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Breakdown</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. FULL-SCREEN DAILY SALES BREAKDOWN VIEW */}
      {/* ========================================================================= */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 flex flex-col animate-in fade-in duration-200">
          {/* Top Navigation & Action Bar */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-200/90 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Return to Daily Sales List"
              >
                <ArrowLeft className="w-4 h-4 text-gray-700" />
                <span>Back to Daily Sales List</span>
              </button>

              <div className="h-5 w-px bg-gray-200 hidden sm:block" />

              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                    {selectedDayRecord.formattedDate}
                  </h2>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/70 rounded-md text-[10px] font-bold">
                    {selectedDayRecord.shiftCount} {selectedDayRecord.shiftCount === 1 ? 'Shift' : 'Shifts'}
                  </span>
                </div>
                {selectedDayRecord.supervisors.length > 0 && (
                  <span className="text-xs text-slate-500 hidden md:inline">
                    • In charge: <strong className="text-slate-700 font-semibold">{selectedDayRecord.supervisors.join(', ')}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportDayDetailCSV(selectedDayRecord)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Export full day audit to CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export</span>
              </button>

              <button
                onClick={() => setSelectedDayRecord(null)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all cursor-pointer"
                title="Close full-screen breakdown"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Main Full-Screen Content Area */}
          <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* SECTION A: FUEL PRODUCT BREAKDOWN TABLE */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-blue-600" />
                      <span>Fuel Product Sales Breakdown</span>
                    </h3>
                    <span className="text-xs font-bold text-gray-500 tabular-nums">
                      Total: {formatLiters(selectedDayRecord.totalFuelVolume)}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-gray-50 font-bold text-gray-500 text-[10px] uppercase border-b border-gray-100">
                        <tr>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3 text-right">Liters Sold (L)</th>
                          <th className="py-2.5 px-3 text-right">Unit Rate (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Gross Revenue (Rs.)</th>
                          <th className="py-2.5 px-3 text-center">Volume Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(Object.values(selectedDayRecord.fuelBreakdown) as DailyFuelProductSummary[]).map((f) => {
                          const tag = getFuelColorTag(f.fuelType);
                          return (
                            <tr key={f.fuelType} className="hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${tag.dot}`} />
                                  <span className="font-bold text-slate-900">{f.fuelType}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-blue-600 tabular-nums">
                                {formatLiters(f.litersSold)}
                              </td>
                              <td className="py-3 px-3 text-right text-gray-600 tabular-nums">
                                {formatRs(f.ratePerLiter)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                                {formatRs(f.revenue)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-2 min-w-[100px]">
                                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${tag.bar}`}
                                      style={{ width: `${Math.min(100, f.volumePercentage)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                                    {f.volumePercentage.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50/80 font-bold border-t border-gray-200">
                        <tr>
                          <td className="py-2.5 px-3 text-slate-900">Total Fuel Volume</td>
                          <td className="py-2.5 px-3 text-right text-blue-600 tabular-nums">
                            {formatLiters(selectedDayRecord.totalFuelVolume)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-400">-</td>
                          <td className="py-2.5 px-3 text-right text-slate-900 tabular-nums">
                            {formatRs(selectedDayRecord.grossFuelRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-500">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* SECTION B: LUBRICANTS & FORECOURT BULK OIL SUMMARY */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-amber-600" />
                      <span>Lubricants &amp; Forecourt Bulk Oil Summary</span>
                    </h3>
                    <span className="text-xs font-bold text-amber-700">
                      Total Forecourt Oil: {formatRs(selectedDayRecord.totalForecourtOilSales)}
                    </span>
                  </div>

                  {selectedDayRecord.chamberBreakdown.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-gray-50 font-bold text-gray-500 text-[10px] uppercase border-b border-gray-100">
                          <tr>
                            <th className="py-2 px-3">Chamber #</th>
                            <th className="py-2 px-3">Oil Grade</th>
                            <th className="py-2 px-3 text-right">Opening Level</th>
                            <th className="py-2 px-3 text-right">Closing Level</th>
                            <th className="py-2 px-3 text-right">Sold Liters</th>
                            <th className="py-2 px-3 text-right">Rate (Rs./L)</th>
                            <th className="py-2 px-3 text-right">Revenue (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedDayRecord.chamberBreakdown.map((ch) => (
                            <tr key={ch.chamberNumber} className="hover:bg-gray-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                Chamber {ch.chamberNumber}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-700">{ch.grade}</td>
                              <td className="py-2.5 px-3 text-right text-gray-500 tabular-nums">
                                {ch.openingLevel.toFixed(2)} L
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-800 tabular-nums">
                                {ch.closingLevel.toFixed(2)} L
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-600 tabular-nums">
                                {ch.soldLiters.toFixed(2)} L
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">
                                {formatRs(ch.ratePerLiter)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                                {formatRs(ch.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-900 font-medium">
                          Forecourt Lubricant &amp; Engine Oil Sales:
                        </span>
                      </div>
                      <span className="font-bold text-amber-900 tabular-nums">
                        {formatRs(selectedDayRecord.totalForecourtOilSales)}
                      </span>
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* SECTION C: SHIFT LEDGER BREAKDOWN */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      <span>Individual Shift Ledgers ({selectedDayRecord.shiftSummaries.length})</span>
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">
                      Day vs. Night Shift Performance
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedDayRecord.shiftSummaries.map((s, idx) => (
                      <div
                        key={s.shiftId || idx}
                        className="p-4 rounded-xl border border-gray-200/80 bg-gray-50/50 space-y-3 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 text-xs">{s.shiftName}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    s.isActive
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  {s.isActive ? 'Active' : 'Completed'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500">
                                Supervisor: <strong className="text-gray-700">{s.supervisorName}</strong> • {s.pumperCount} Pumper(s)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border tabular-nums ${
                                s.varianceStatus === 'Shortage'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : s.varianceStatus === 'Excess'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              Variance: {s.variance >= 0 && s.variance > 0.01 ? '+' : ''}
                              {formatRs(s.variance)}
                            </span>
                          </div>
                        </div>

                        {/* Shift Grid Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 bg-white rounded-lg border border-gray-200/60 shadow-2xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Fuel Sold</span>
                            <span className="font-bold text-blue-600 tabular-nums">
                              {formatLiters(s.fuelVolumeSold)}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-lg border border-gray-200/60 shadow-2xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Gross Sales</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {formatRs(s.grossRevenue)}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-lg border border-gray-200/60 shadow-2xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Non-Cash (POS/Credit)</span>
                            <span className="font-semibold text-amber-700 tabular-nums">
                              {formatRs(s.totalNonCash)}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-lg border border-gray-200/60 shadow-2xs">
                            <span className="text-[10px] text-gray-400 font-bold uppercase block">Cash Handed Over</span>
                            <span className="font-bold text-emerald-700 tabular-nums">
                              {formatRs(s.actualCashHandedOver)}
                            </span>
                          </div>
                        </div>

                        {s.handoverNotes && (
                          <div className="text-[11px] text-gray-500 bg-white p-2.5 rounded-lg border border-gray-200/60">
                            <strong>Handover Notes:</strong> {s.handoverNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* SECTION D: FINANCIAL SETTLEMENT SUMMARY */}
                {/* ------------------------------------------------------------- */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Daily Financial Settlement &amp; Reconciliation</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Revenue & Non-Cash Deductions */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Gross Fuel Revenue:</span>
                        <span className="font-bold text-gray-900 tabular-nums">
                          {formatRs(selectedDayRecord.grossFuelRevenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Forecourt Oil &amp; Lubricant Sales:</span>
                        <span className="font-bold text-gray-900 tabular-nums">
                          {formatRs(selectedDayRecord.totalForecourtOilSales)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-bold">
                        <span className="text-slate-900">Total Gross Daily Sales:</span>
                        <span className="text-slate-900 text-sm tabular-nums">
                          {formatRs(selectedDayRecord.grossRevenue)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
                        <div className="flex items-center justify-between text-amber-800">
                          <span>(-) Corporate Credit Sales (Chitty):</span>
                          <span className="font-bold tabular-nums">
                            {formatRs(selectedDayRecord.creditSales)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-blue-800">
                          <span>(-) Card POS / Digital Swipes:</span>
                          <span className="font-bold tabular-nums">
                            {formatRs(selectedDayRecord.cardSales)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cash Reconciliation */}
                    <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Net Expected Physical Cash:</span>
                        <span className="font-bold text-gray-900 text-sm tabular-nums">
                          {formatRs(selectedDayRecord.expectedCash)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Physical Cash Handed Over:</span>
                        <span className="font-bold text-emerald-800 text-sm tabular-nums">
                          {formatRs(selectedDayRecord.handedOverCash)}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">Final Cash Variance:</span>
                          <div className="text-right">
                            <span
                              className={`text-base font-bold tabular-nums block ${
                                selectedDayRecord.varianceStatus === 'Shortage'
                                  ? 'text-rose-600'
                                  : selectedDayRecord.varianceStatus === 'Excess'
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {selectedDayRecord.variance >= 0 && selectedDayRecord.variance > 0.01 ? '+' : ''}
                              {formatRs(selectedDayRecord.variance)}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">
                              ({selectedDayRecord.varianceStatus})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

          {/* Bottom Navigation / Action Footer */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between shadow-2xs mt-auto">
            <span className="text-xs text-slate-500 font-medium">
              Consolidated Day Audit: <strong className="text-slate-800 font-bold">{selectedDayRecord.formattedDate}</strong> ({selectedDayRecord.shiftCount} {selectedDayRecord.shiftCount === 1 ? 'Shift' : 'Shifts'})
            </span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => exportDayDetailCSV(selectedDayRecord)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-gray-600" />
                <span>Export</span>
              </button>
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Daily Sales List</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
