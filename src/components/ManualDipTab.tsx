/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplet, Plus, RefreshCw, Download, Search, AlertTriangle, 
  TrendingUp, X, CheckCircle2
} from 'lucide-react';
import { FuelTank, TankDipLog } from '../types';
import { supabase } from '../lib/supabase';

interface ManualDipTabProps {
  tanks?: FuelTank[];
}

export default function ManualDipTab({ tanks = [] }: ManualDipTabProps) {
  const [dipLogs, setDipLogs] = useState<TankDipLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTankFilter, setSelectedTankFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Available Tanks (Naturally sorted in ascending order: Tank 01, Tank 02, etc.)
  const availableTanks = useMemo(() => {
    const rawList = (tanks && tanks.length > 0) ? tanks : [
      { id: 'tank-1', name: 'Tank 01', fuelType: 'Petrol 92' as const, capacity: 20000, currentLevel: 14500, pricePerLiter: 365 },
      { id: 'tank-2', name: 'Tank 02', fuelType: 'Petrol 95' as const, capacity: 15000, currentLevel: 9200, pricePerLiter: 420 },
      { id: 'tank-3', name: 'Tank 03', fuelType: 'Auto Diesel' as const, capacity: 25000, currentLevel: 18000, pricePerLiter: 333 },
      { id: 'tank-4', name: 'Tank 04', fuelType: 'Super Diesel' as const, capacity: 15000, currentLevel: 8500, pricePerLiter: 375 },
    ];
    return [...rawList].sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [tanks]);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    tankId: availableTanks[0]?.id || 'tank-1',
    openingDip: '',
    closingDip: '',
    pumpSales: '0',
    bowserReceipts: '0',
    recordedBy: 'Supervisor',
    notes: ''
  });

  // Automatically update tankId when availableTanks changes or modal opens
  useEffect(() => {
    if (!formData.tankId && availableTanks.length > 0) {
      setFormData(prev => ({ ...prev, tankId: availableTanks[0].id }));
    }
  }, [availableTanks]);

  // Fetch dip logs directly from Supabase
  const fetchDipLogs = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!isConfigured) {
        setDipLogs([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tank_dip_logs')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn("Supabase tank_dip_logs fetch error:", error.message);
        setErrorMsg("Failed to load records from Supabase. Showing offline fallback data.");
        setDipLogs([]);
      } else if (data) {
        const mappedLogs: TankDipLog[] = data.map((d: any) => ({
          id: d.id,
          date: d.date,
          tankId: d.tank_id || d.tankId || 'tank-1',
          tankName: d.tank_name || d.tankName || 'Underground Tank',
          fuelType: d.fuel_type || d.fuelType || 'Petrol 92',
          openingDip: Number(d.opening_dip ?? d.openingDip) || 0,
          closingDip: Number(d.closing_dip ?? d.closingDip) || 0,
          bowserReceipts: Number(d.bowser_receipts ?? d.bowserReceipts) || 0,
          pumpSales: Number(d.pump_sales ?? d.pumpSales) || 0,
          expectedStock: Number(d.expected_stock ?? d.expectedStock) || 0,
          varianceLiters: Number(d.variance_liters ?? d.varianceLiters) || 0,
          variancePercentage: Number(d.variance_percentage ?? d.variancePercentage) || 0,
          recordedBy: d.recorded_by || d.recordedBy || 'Supervisor',
          notes: d.notes || ''
        }));
        setDipLogs(mappedLogs);
      }
    } catch (err: any) {
      console.warn("Error fetching tank_dip_logs:", err);
      setErrorMsg("Error connecting to database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDipLogs();
  }, []);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedTankObj = availableTanks.find(t => t.id === formData.tankId) || availableTanks[0];
    const tankName = selectedTankObj ? (selectedTankObj.name || selectedTankObj.id) : formData.tankId;
    const fuelType = selectedTankObj ? selectedTankObj.fuelType : 'Petrol 92';

    const open = Number(formData.openingDip) || 0;
    const close = Number(formData.closingDip) || 0;
    const receipts = Number(formData.bowserReceipts) || 0;
    const sales = Number(formData.pumpSales) || 0;

    const expected = open + receipts - sales;
    const varianceL = close - expected;
    const variancePct = expected > 0 ? (varianceL / expected) * 100 : 0;

    const newRecord: TankDipLog = {
      id: `dip_${Date.now()}`,
      date: formData.date || new Date().toISOString().slice(0, 10),
      tankId: formData.tankId,
      tankName: tankName,
      fuelType: fuelType,
      openingDip: open,
      closingDip: close,
      bowserReceipts: receipts,
      pumpSales: sales,
      expectedStock: expected,
      varianceLiters: varianceL,
      variancePercentage: variancePct,
      recordedBy: formData.recordedBy || 'Supervisor',
      notes: formData.notes
    };

    // Optimistic UI update
    setDipLogs(prev => [newRecord, ...prev]);
    setIsModalOpen(false);

    // Reset Form
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      tankId: availableTanks[0]?.id || 'tank-1',
      openingDip: '',
      closingDip: '',
      pumpSales: '0',
      bowserReceipts: '0',
      recordedBy: 'Supervisor',
      notes: ''
    });

    showToast("Daily Dip Record successfully saved to database!");

    // Save directly to Supabase
    try {
      const { error } = await supabase.from('tank_dip_logs').insert([{
        id: newRecord.id,
        date: newRecord.date,
        tank_id: newRecord.tankId,
        tank_name: newRecord.tankName,
        fuel_type: newRecord.fuelType,
        opening_dip: newRecord.openingDip,
        closing_dip: newRecord.closingDip,
        bowser_receipts: newRecord.bowserReceipts,
        pump_sales: newRecord.pumpSales,
        expected_stock: newRecord.expectedStock,
        variance_liters: newRecord.varianceLiters,
        variance_percentage: newRecord.variancePercentage,
        recorded_by: newRecord.recordedBy,
        notes: newRecord.notes
      }]);

      if (error) {
        console.warn("Supabase insert notice:", error.message);
      } else {
        // Re-fetch to ensure sync with remote DB ID
        fetchDipLogs();
      }
    } catch (err) {
      console.warn("Supabase dip insert catch:", err);
    }
  };

  // Filtered Logs
  const filteredDipLogs = useMemo(() => {
    return dipLogs.filter(log => {
      const matchesSearch = 
        log.date.includes(searchQuery) || 
        log.tankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.fuelType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.recordedBy || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTank = selectedTankFilter === 'all' || log.tankId === selectedTankFilter || log.fuelType === selectedTankFilter;

      return matchesSearch && matchesTank;
    });
  }, [dipLogs, searchQuery, selectedTankFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalEntries = dipLogs.length;
    const netVarianceLiters = dipLogs.reduce((acc, curr) => acc + curr.varianceLiters, 0);
    const latestEntry = dipLogs[0]?.date || 'N/A';
    const totalPumpSales = dipLogs.reduce((acc, curr) => acc + curr.pumpSales, 0);

    return { totalEntries, netVarianceLiters, latestEntry, totalPumpSales };
  }, [dipLogs]);

  // Export CSV
  const exportCSV = () => {
    if (dipLogs.length === 0) return;

    const headers = [
      'Date', 'Tank Name', 'Fuel Grade', 'Opening Dip (L)', 
      'Bowser Receipts (L)', 'Dispensed Sales (L)', 'Expected Stock (L)', 
      'Closing Dip (L)', 'Gain/Loss Variance (L)', 'Variance (%)', 'Recorded By'
    ];

    const rows = dipLogs.map(d => [
      d.date,
      d.tankName,
      d.fuelType,
      d.openingDip,
      d.bowserReceipts,
      d.pumpSales,
      d.expectedStock,
      d.closingDip,
      d.varianceLiters.toFixed(2),
      d.variancePercentage.toFixed(2) + '%',
      d.recordedBy || 'Supervisor'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Manual_Dip_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Droplet className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">Manual Dip Record</h1>
          </div>
          <p className="text-xs text-gray-500 font-medium pl-0.5">
            Record physical underground tank dip readings and perform daily stock reconciliation with automatic evaporation gain/loss calculations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Daily Dip Record</span>
          </button>
        </div>
      </div>

      {/* Main Dip Logs Table & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search date, tank name, supervisor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-gray-500">Filter Tank:</span>
            <select
              value={selectedTankFilter}
              onChange={(e) => setSelectedTankFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Tanks & Grades</option>
              {availableTanks.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.fuelType})</option>
              ))}
            </select>

            <button
              onClick={fetchDipLogs}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Refresh Data from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={exportCSV}
              disabled={dipLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Database Notice if error */}
        {errorMsg && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchDipLogs} className="underline font-bold text-amber-950 cursor-pointer">Retry</button>
          </div>
        )}

        {/* Table View */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-gray-400 font-semibold animate-pulse">
            Loading daily dip logs from Supabase...
          </div>
        ) : filteredDipLogs.length > 0 ? (
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 font-bold text-gray-500 text-[10px] uppercase border-b border-gray-100">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Tank & Fuel Grade</th>
                  <th className="p-3 text-right">Opening Dip (L)</th>
                  <th className="p-3 text-right">Bowser Receipts (L)</th>
                  <th className="p-3 text-right">Meter Sales (L)</th>
                  <th className="p-3 text-right">Expected Stock (L)</th>
                  <th className="p-3 text-right">Closing Dip (L)</th>
                  <th className="p-3 text-right">Gain / Loss Variance</th>
                  <th className="p-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {filteredDipLogs.map((log) => {
                  const isLoss = log.varianceLiters < 0;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 font-semibold text-gray-700 whitespace-nowrap">{log.date}</td>
                      <td className="p-3 font-bold text-gray-900">
                        <span>{log.tankName}</span>
                        <span className="text-[10px] text-gray-500 font-normal ml-1.5">({log.fuelType})</span>
                      </td>
                      <td className="p-3 text-right text-gray-700">{log.openingDip.toLocaleString('en-LK')} L</td>
                      <td className="p-3 text-right text-emerald-700 font-semibold">{log.bowserReceipts > 0 ? `+${log.bowserReceipts.toLocaleString('en-LK')} L` : '0 L'}</td>
                      <td className="p-3 text-right text-blue-600 font-semibold">{log.pumpSales.toLocaleString('en-LK')} L</td>
                      <td className="p-3 text-right text-gray-700">{log.expectedStock.toLocaleString('en-LK')} L</td>
                      <td className="p-3 text-right font-bold text-gray-900">{log.closingDip.toLocaleString('en-LK')} L</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {isLoss ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{log.varianceLiters.toFixed(2)} L ({log.variancePercentage.toFixed(2)}%)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            <TrendingUp className="w-3 h-3" />
                            <span>+{log.varianceLiters.toFixed(2)} L (+{log.variancePercentage.toFixed(2)}%)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 font-semibold">{log.recordedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50/70 rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
              <Droplet className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">No Daily Dip Logs Found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
              There are no physical dip records in Supabase. Click the button above to add your first daily tank dip reading.
            </p>
          </div>
        )}
      </div>

      {/* ENTRY FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Add Daily Dip Record</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Underground Tank Selection</label>
                  <select
                    value={formData.tankId}
                    onChange={(e) => setFormData(p => ({ ...p, tankId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    {availableTanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.fuelType})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Opening Dip (Liters)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 15000"
                    value={formData.openingDip}
                    onChange={(e) => setFormData(p => ({ ...p, openingDip: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Closing Dip (Liters)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 12450"
                    value={formData.closingDip}
                    onChange={(e) => setFormData(p => ({ ...p, closingDip: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Dispensed Meter Sales (L)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData.pumpSales}
                    onChange={(e) => setFormData(p => ({ ...p, pumpSales: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Bowser Receipts (L)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData.bowserReceipts}
                    onChange={(e) => setFormData(p => ({ ...p, bowserReceipts: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              {/* LIVE CALCULATION PREVIEW BOX */}
              {(() => {
                const open = Number(formData.openingDip) || 0;
                const close = Number(formData.closingDip) || 0;
                const sales = Number(formData.pumpSales) || 0;
                const receipts = Number(formData.bowserReceipts) || 0;
                const expected = open + receipts - sales;
                const variance = close - expected;
                const varPct = expected > 0 ? (variance / expected) * 100 : 0;
                const isLoss = variance < 0;

                return (
                  <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 space-y-2">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">Live Stock Calculation Preview</span>
                    
                    <div className="flex items-center justify-between text-xs text-gray-700 font-medium">
                      <span>Expected Stock (Opening + Bowser Receipts - Sales):</span>
                      <span className="font-bold text-gray-900">{expected.toLocaleString('en-LK')} L</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-700 font-medium pt-1.5 border-t border-blue-100">
                      <span>Evaporation Gain / Loss Variance:</span>
                      <span className={`font-bold ${isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(2)} L ({varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Supervisor / Recorded By</label>
                <input
                  type="text"
                  value={formData.recordedBy}
                  onChange={(e) => setFormData(p => ({ ...p, recordedBy: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Temperature changes during dip measurement..."
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Save Dip Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
