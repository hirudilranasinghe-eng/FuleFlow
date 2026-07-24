/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, Eye, Calendar, FileSpreadsheet, Download, 
  ArrowUpRight, Clock, User, CheckCircle2, ChevronRight, ChevronDown, X, Trash2
} from 'lucide-react';
import { Shift, Employee, FuelTank } from '../types';

interface DailySalesTabProps {
  shiftHistory: Shift[];
  setShiftHistory?: React.Dispatch<React.SetStateAction<Shift[]>>;
  onDeleteShift?: (shiftId: string) => void;
  employees: Employee[];
  tanks?: FuelTank[];
}

export default function DailySalesTab({ shiftHistory, setShiftHistory, onDeleteShift, employees, tanks }: DailySalesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(val) + ' L';
  };

  const getEmployeeName = (id: string | null) => {
    if (!id) return 'Unassigned';
    return employees.find(e => e.id === id)?.name || id;
  };

  // Toggle shift expansion
  const toggleExpandShift = (shiftId: string) => {
    setExpandedShiftIds(prev => ({
      ...prev,
      [shiftId]: !prev[shiftId]
    }));
  };

  // Helper to resolve unit price for a pump reading
  const getReadingUnitPrice = (r: any) => {
    if (r.unitPrice !== undefined && r.unitPrice !== null) {
      return r.unitPrice;
    }
    // Fallback price lookup by fuel type from active tanks list
    if (tanks) {
      const tank = tanks.find(t => t.fuelType === r.fuelType);
      if (tank) return tank.pricePerLiter;
    }
    return 1.50; // default fallback if nothing is configured
  };

  // Filter history based on search query
  const filteredHistory = useMemo(() => {
    return shiftHistory.filter(s => {
      const supervisorName = getEmployeeName(s.supervisorId);
      const query = searchQuery.toLowerCase();
      return (
        s.id.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        supervisorName.toLowerCase().includes(query)
      );
    });
  }, [shiftHistory, searchQuery, employees]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalRevenue = 0;
    let totalVolume = 0;
    shiftHistory.forEach(s => {
      totalRevenue += s.totalNetSales;
      totalVolume += s.totalNetSold;
    });
    return {
      totalRevenue,
      totalVolume,
      completedShifts: shiftHistory.length
    };
  }, [shiftHistory]);

  // Export specific shift summary report to CSV
  const handleExportShiftCsv = (shift: Shift) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `FuelFlow Shift Detailed Report - ${shift.id}\n`;
    csvContent += `Shift Name,${shift.name}\n`;
    csvContent += `Supervisor,${getEmployeeName(shift.supervisorId)}\n`;
    csvContent += `Start Date,${new Date(shift.startTime).toLocaleString()}\n`;
    csvContent += `End Date,${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'N/A'}\n\n`;
    csvContent += "Pump Name,Fuel Type,Assigned Pumper,Start Meter (L),End Meter (L),Fuel Sold (L),Testing Deducted (L),Net Sold (L),Fuel Unit Price,Expected Revenue\n";

    shift.pumpReadings.forEach(r => {
      const pName = getEmployeeName(r.assignedPumperId);
      const sold = Math.max(0, r.endMeter - r.startMeter);
      const net = Math.max(0, r.endMeter - r.startMeter - r.testingQty);
      const price = getReadingUnitPrice(r);
      const revenue = net * price;
      csvContent += `"${r.pumpName}","${r.fuelType}","${pName}",${r.startMeter},${r.endMeter},${sold},${r.testingQty},${net},${price},${revenue}\n`;
    });

    csvContent += `\nShift Total Fuel Sold,,, , ,${shift.totalFuelSold.toFixed(2)}, ,${shift.totalNetSold.toFixed(2)}\n`;
    csvContent += `Shift Total Revenue,,, , , , ,${shift.totalNetSales.toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FuelFlow_Detailed_Report_${shift.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Master CSV Export: Compile all logs in shiftHistory to a single CSV file
  const handleExportAllLogsCsv = () => {
    if (shiftHistory.length === 0) return;

    const headers = [
      "Shift ID",
      "Shift Template",
      "Supervisor Name",
      "Ended Date/Time",
      "Pump Name",
      "Assigned Pumper",
      "Start Meter",
      "End Meter",
      "Testing Qty",
      "Gross Liters Sold",
      "Net Liters Sold",
      "Fuel Unit Price",
      "Expected Cash Revenue"
    ];

    const rows: string[][] = [headers];

    shiftHistory.forEach(s => {
      s.pumpReadings.forEach(r => {
        const gross = Math.max(0, r.endMeter - r.startMeter);
        const net = Math.max(0, gross - r.testingQty);
        const price = getReadingUnitPrice(r);
        const rev = net * price;
        const endedTime = s.endTime ? new Date(s.endTime).toLocaleString() : 'N/A';
        
        rows.push([
          s.id,
          s.name,
          getEmployeeName(s.supervisorId),
          endedTime,
          r.pumpName,
          getEmployeeName(r.assignedPumperId),
          r.startMeter.toFixed(2),
          r.endMeter.toFixed(2),
          r.testingQty.toFixed(1),
          gross.toFixed(2),
          net.toFixed(2),
          price.toFixed(2),
          rev.toFixed(2)
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `FuelFlow_Shift_Logs_${yyyy}${mm}${dd}.csv`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="daily-sales-root" className="space-y-4">
      {/* Page Header */}
      <div id="sales-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            Shift & Daily Sales History
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Browse complete shift records, digital meter handovers, and exportable CSV reports
          </p>
        </div>
      </div>

      {/* Aggregate Stats Bar */}
      <div id="sales-stats-bar" className="grid grid-cols-1 sm:grid-cols-3 gap-4 glass-panel p-4 rounded-2xl shadow-sm">
        <div className="space-y-0.5 pl-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Cumulative Net Sales</span>
          <span className="text-xl sm:text-2xl font-extrabold text-[#1C1C1C] block tabular-nums">{formatCurrency(aggregateStats.totalRevenue)}</span>
          <span className="text-[10px] text-gray-500 block font-sans">All historic completed shifts</span>
        </div>
        <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-gray-100 sm:pl-5 pt-2 sm:pt-0">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Cumulative Liters Dispensed</span>
          <span className="text-xl sm:text-2xl font-extrabold text-blue-600 block tabular-nums">{formatLiters(aggregateStats.totalVolume)}</span>
          <span className="text-[10px] text-gray-500 block font-sans">Volume net of testing deductions</span>
        </div>
        <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-gray-100 sm:pl-5 pt-2 sm:pt-0">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Completed Shifts Closed</span>
          <span className="text-xl sm:text-2xl font-extrabold text-blue-600 block tabular-nums">{aggregateStats.completedShifts} Shifts</span>
          <span className="text-[10px] text-gray-500 block font-sans">100% data fidelity preserved</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div id="sales-table-card" className="glass-panel rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm">
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-gray-50/80">
          <span className="text-xs font-bold text-[#1C1C1C] uppercase tracking-wider">Historical Shift Logs</span>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Shift ID, name or supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <button
              onClick={handleExportAllLogsCsv}
              disabled={shiftHistory.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto"
              title="Export all shift logs to a single master CSV file"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export All Logs to CSV</span>
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-auto max-h-[650px]">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
              <tr className="border-b border-gray-200/80 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center"></th>
                <th className="py-2.5 px-4">Shift ID</th>
                <th className="py-2.5 px-4">Shift Template</th>
                <th className="py-2.5 px-4">Supervisor</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Liters Sold</th>
                <th className="py-2.5 px-4 text-right">Net Revenue</th>
                <th className="py-2.5 px-4">Ended At</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => toggleExpandShift(s.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-[#1C1C1C] cursor-pointer"
                          title={expandedShiftIds[s.id] ? "Collapse details" : "Expand details"}
                        >
                          {expandedShiftIds[s.id] ? (
                            <ChevronDown className="w-4 h-4 text-blue-600 stroke-[3]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 stroke-[3]" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 tabular-nums font-bold text-[#1C1C1C] group-hover:text-blue-600 transition-colors">
                        {s.id}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600 font-medium">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-4 text-gray-700 font-semibold">
                        {getEmployeeName(s.supervisorId)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {s.endTime ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 animate-pulse">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-700">
                        {formatLiters(s.totalNetSold)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-extrabold text-emerald-600">
                        {formatCurrency(s.totalNetSales)}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
                        {s.endTime ? new Date(s.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Ongoing'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedShift(s)}
                            className="p-1 bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-all cursor-pointer"
                            title="View detailed pump meters"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExportShiftCsv(s)}
                            className="p-1 bg-white text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 rounded-lg transition-all cursor-pointer"
                            title="Export detailed CSV report"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteShift && (
                            <button
                              onClick={() => onDeleteShift(s.id)}
                              className="p-1 bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-all cursor-pointer"
                              title="Delete shift record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Collapsible Nested Table for Pump Readings */}
                    {expandedShiftIds[s.id] && (
                      <tr className="bg-black/30">
                        <td colSpan={8} className="py-4 px-8 border-b border-gray-100">
                          <div className="bg-gray-50/90 rounded-xl border border-gray-200 shadow-inner overflow-hidden p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#00BFFF]" />
                                <span>Pump Shift Meter Ledgers & locked Fuel Unit Prices</span>
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium uppercase tabular-nums font-semibold">
                                {s.pumpReadings.length} Active Pumps recorded
                              </span>
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-[#0f1524] text-gray-500 font-bold uppercase border-b border-gray-100">
                                    <th className="py-2.5 px-3">Pump</th>
                                    <th className="py-2.5 px-3">Assigned Pumper</th>
                                    <th className="py-2.5 px-3 text-right">Start Meter</th>
                                    <th className="py-2.5 px-3 text-right">End Meter</th>
                                    <th className="py-2.5 px-3 text-right">Testing Qty</th>
                                    <th className="py-2.5 px-3 text-right">Net Liters Sold</th>
                                    <th className="py-2.5 px-3 text-right">Fuel Unit Price</th>
                                    <th className="py-2.5 px-3 text-right font-bold text-emerald-400">Expected Revenue</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04] font-medium text-gray-600">
                                  {s.pumpReadings.map((r, idx) => {
                                    const sold = Math.max(0, r.endMeter - r.startMeter);
                                    const net = Math.max(0, sold - r.testingQty);
                                    const unitPrice = getReadingUnitPrice(r);
                                    const expectedCash = net * unitPrice;
                                    return (
                                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-[#1C1C1C]">
                                          {r.pumpName} <span className="font-normal text-[10px] text-gray-500">({r.fuelType})</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-gray-600">
                                          {getEmployeeName(r.assignedPumperId)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-500">
                                          {r.startMeter.toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-500">
                                          {r.endMeter.toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-red-400">
                                          {r.testingQty > 0 ? `-${r.testingQty.toFixed(1)} L` : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#1C1C1C]">
                                          {net.toFixed(2)} L
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-blue-600 font-bold">
                                          {formatCurrency(unitPrice)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-400 font-bold">
                                          {formatCurrency(expectedCash)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 text-sm italic bg-gray-50">
                    No completed shift history found matching search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- DETAILED SHIFT AUDIT MODAL --- */}
      {selectedShift && (
        <div id="sales-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="sales-modal-card" className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-gray-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-lg">Shift Meter Ledger Audit</h3>
                <span className="text-xs font-semibold text-blue-600 block tabular-nums font-semibold mt-0.5">Shift ID: {selectedShift.id}</span>
              </div>
              <button onClick={() => setSelectedShift(null)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Meta details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/50 border border-gray-100 p-4 rounded-xl text-xs text-gray-600">
                <div>
                  <span className="text-gray-500 block font-medium">Supervisor</span>
                  <span className="font-semibold text-[#1C1C1C] text-sm mt-0.5 block">{getEmployeeName(selectedShift.supervisorId)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Shift Name / Duration</span>
                  <span className="font-semibold text-[#1C1C1C] text-sm mt-0.5 block">{selectedShift.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Started At</span>
                  <span className="font-semibold text-[#1C1C1C] text-sm mt-0.5 block">{new Date(selectedShift.startTime).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Ended At</span>
                  <span className="font-semibold text-[#1C1C1C] text-sm mt-0.5 block">
                    {selectedShift.endTime ? new Date(selectedShift.endTime).toLocaleString() : 'Active'}
                  </span>
                </div>
              </div>

              {/* Pump Readings Details Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Individual Pump Readings</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto bg-gray-50/30">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase">
                        <th className="py-2.5 px-4">Pump</th>
                        <th className="py-2.5 px-4">Pumper</th>
                        <th className="py-2.5 px-4 text-right">Start Meter</th>
                        <th className="py-2.5 px-4 text-right">End Meter</th>
                        <th className="py-2.5 px-4 text-right">Deductions</th>
                        <th className="py-2.5 px-4 text-right">Net Sold</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right font-bold text-emerald-400">Expected Cash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] font-medium text-gray-600">
                      {selectedShift.pumpReadings.map((r, i) => {
                        const sold = Math.max(0, r.endMeter - r.startMeter);
                        const net = Math.max(0, sold - r.testingQty);
                        const unitPrice = getReadingUnitPrice(r);
                        const expectedCash = net * unitPrice;
                        return (
                          <tr key={i} className="hover:bg-white/[0.01]">
                            <td className="py-2.5 px-4 font-bold text-[#1C1C1C]">{r.pumpName} <span className="font-normal text-[10px] text-gray-500">({r.fuelType})</span></td>
                            <td className="py-2.5 px-4 text-gray-600">{getEmployeeName(r.assignedPumperId)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-500">{r.startMeter.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-500">{r.endMeter.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-red-400">{r.testingQty > 0 ? `-${r.testingQty.toFixed(1)} L` : '-'}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-600">{net.toFixed(2)} L</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-blue-600 font-bold">{formatCurrency(unitPrice)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-400 font-bold">{formatCurrency(expectedCash)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aggregated Totals preview */}
              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-xs text-gray-500 font-medium block">Total Net Volume Sold</span>
                  <span className="text-lg font-extrabold text-[#1C1C1C] tabular-nums font-semibold">{formatLiters(selectedShift.totalNetSold)}</span>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-xs text-gray-500 font-medium block">Total Revenue Recouped</span>
                  <span className="text-lg font-extrabold text-emerald-400 tabular-nums font-semibold">{formatCurrency(selectedShift.totalNetSales)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => handleExportShiftCsv(selectedShift)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit CSV</span>
              </button>
              <button
                onClick={() => setSelectedShift(null)}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-[#1C1C1C] font-bold text-xs rounded-lg hover:brightness-110 cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
