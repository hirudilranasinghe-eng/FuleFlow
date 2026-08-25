/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeftRight, Droplets, Download, 
  Layers, User, RotateCcw, Calendar
} from 'lucide-react';
import { BulkOilTransfer, OilTank, Employee } from '../types';
import { fetchBulkOilTransfers } from '../lib/lubricantsClient';
import { supabase } from '../lib/supabase';

interface OilMovementReportProps {
  oilTanks?: OilTank[];
  employees?: Employee[];
}

export default function OilMovementReport({
  oilTanks = [],
  employees = []
}: OilMovementReportProps) {
  // State
  const [transfers, setTransfers] = useState<BulkOilTransfer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Direct Date Filtering Controls
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Currency Formatter
  const formatRs = (val: number | undefined | null) => {
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fetch Transfers
  const loadTransfers = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchBulkOilTransfers();
      setTransfers(data);
    } catch (err: any) {
      console.warn("Error fetching bulk oil transfers:", err);
      setErrorMsg(err?.message || "Failed to load oil transfers");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransfers();

    // Supabase Real-time listener for bulk_oil_transfers
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!isConfigured) return;

    const channel = supabase
      .channel('bulk_oil_transfers_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bulk_oil_transfers' },
        () => {
          loadTransfers(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Transfers based on Date Pickers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      if (startDate) {
        const tDate = new Date(t.transfer_date).getTime();
        const sDate = new Date(`${startDate}T00:00:00.000`).getTime();
        if (!isNaN(tDate) && !isNaN(sDate) && tDate < sDate) return false;
      }
      if (endDate) {
        const tDate = new Date(t.transfer_date).getTime();
        const eDate = new Date(`${endDate}T23:59:59.999`).getTime();
        if (!isNaN(tDate) && !isNaN(eDate) && tDate > eDate) return false;
      }

      return true;
    });
  }, [transfers, startDate, endDate]);

  // Clear date filters
  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTransfers.length === 0) return;

    const headers = [
      'Transfer ID',
      'Date & Time',
      'From (Storage Drum)',
      'To (Forecourt Chamber)',
      'Oil Grade',
      'Transferred Volume (L)',
      'Drum Balance (L)',
      'Chamber New Level (L)',
      'Unit Rate (Rs./L)',
      'Total Value (Rs.)',
      'Recorded By',
      'Notes'
    ];

    const rows = filteredTransfers.map(t => [
      t.id,
      new Date(t.transfer_date).toLocaleString('en-LK'),
      t.source_drum_name,
      t.target_chamber_name,
      t.oil_grade,
      t.transferred_liters.toFixed(1),
      t.source_drum_remaining_liters.toFixed(1),
      t.target_chamber_new_level.toFixed(1),
      t.unit_rate.toFixed(2),
      t.total_transfer_value.toFixed(2),
      t.transferred_by,
      t.notes || ''
    ]);

    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bulk_Oil_Transfers_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="oil-movement-report-root" className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. STANDARDIZED HEADER SECTION */}
      <div id="oil-movement-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
            Oil Movement Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Audit log of bulk oil and barrel-to-chamber internal transfers
          </p>
        </div>

        {/* Right Action: Export Button */}
        <div className="flex items-center gap-2">
          <button
            id="btn-export-oil-movement-csv"
            onClick={handleExportCSV}
            disabled={filteredTransfers.length === 0}
            className="px-3.5 py-2 bg-gray-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. DIRECT DATE FILTERING CONTROLS */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* From Date */}
          <div className="flex items-center gap-2">
            <label htmlFor="oil-transfer-start-date" className="text-xs font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>From Date:</span>
            </label>
            <input
              id="oil-transfer-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-slate-800 font-semibold focus:outline-none transition-all shadow-2xs"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-2">
            <label htmlFor="oil-transfer-end-date" className="text-xs font-bold text-slate-600 whitespace-nowrap">
              <span>To Date:</span>
            </label>
            <input
              id="oil-transfer-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-slate-800 font-semibold focus:outline-none transition-all shadow-2xs"
            />
          </div>

          {/* Clear / Reset Filter Button */}
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={handleClearDates}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Reset date filter"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. DATA TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
              Oil Movement
            </h3>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredTransfers.length} {filteredTransfers.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-bold">Loading bulk oil transfer records...</p>
          </div>
        ) : filteredTransfers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-[10px] uppercase border-b border-gray-100">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Date & Time</th>
                  <th className="p-3.5 whitespace-nowrap">From (Drum)</th>
                  <th className="p-3.5 whitespace-nowrap">To (Chamber)</th>
                  <th className="p-3.5 whitespace-nowrap">Oil Grade</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Transferred (L)</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Drum Bal. (L)</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Chamber Level (L)</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Est. Value (Rs.)</th>
                  <th className="p-3.5 whitespace-nowrap">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-800">
                {filteredTransfers.map((item) => {
                  const dateObj = new Date(item.transfer_date);
                  const isValidDate = !isNaN(dateObj.getTime());
                  const formattedDate = isValidDate 
                    ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/A';
                  const formattedTime = isValidDate
                    ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : '';

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Date & Time */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formattedDate}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{formattedTime}</div>
                      </td>

                      {/* From (Drum) */}
                      <td className="p-3.5 whitespace-nowrap font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{item.source_drum_name}</span>
                        </span>
                      </td>

                      {/* To (Chamber) */}
                      <td className="p-3.5 whitespace-nowrap font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{item.target_chamber_name}</span>
                        </span>
                      </td>

                      {/* Oil Grade */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          {item.oil_grade}
                        </span>
                      </td>

                      {/* Transferred (L) */}
                      <td className="p-3.5 text-right whitespace-nowrap font-black text-amber-900 tabular-nums">
                        <span className="bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                          +{item.transferred_liters.toFixed(1)} L
                        </span>
                      </td>

                      {/* Drum Balance (L) */}
                      <td className="p-3.5 text-right whitespace-nowrap text-gray-600 tabular-nums font-semibold">
                        {item.source_drum_remaining_liters.toFixed(1)} L
                      </td>

                      {/* Chamber Level (L) */}
                      <td className="p-3.5 text-right whitespace-nowrap text-emerald-800 tabular-nums font-extrabold">
                        {item.target_chamber_new_level.toFixed(1)} L
                      </td>

                      {/* Est. Value (Rs.) */}
                      <td className="p-3.5 text-right whitespace-nowrap font-extrabold text-slate-900 tabular-nums">
                        {formatRs(item.total_transfer_value)}
                      </td>

                      {/* Recorded By */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                          <User className="w-3 h-3 text-gray-500" />
                          <span>{item.transferred_by}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mx-auto">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">No Oil Transfers Found</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 font-medium">
                {startDate || endDate
                  ? 'No transfer records match your selected date range. Try clearing the filter.'
                  : 'No bulk oil transfers have been recorded yet. When you transfer oil from Back Store Drums to Forecourt Chambers, they will appear here automatically.'}
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
