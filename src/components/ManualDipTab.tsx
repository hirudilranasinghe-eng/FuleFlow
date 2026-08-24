/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplet, Plus, RefreshCw, Download, Search, AlertTriangle, 
  TrendingUp, TrendingDown, X, CheckCircle2, Eye, Calendar,
  Clock, User, FileText, Check, ArrowUpDown, ChevronRight
} from 'lucide-react';
import { FuelTank, DailyDipSession, TankDipEntry } from '../types';
import { supabase } from '../lib/supabase';

interface ManualDipTabProps {
  tanks?: FuelTank[];
  setTanks?: React.Dispatch<React.SetStateAction<FuelTank[]>>;
}

const STORAGE_KEY_SESSIONS = 'fms_daily_dip_sessions';

export default function ManualDipTab({ tanks = [] }: ManualDipTabProps) {
  const [sessions, setSessions] = useState<DailyDipSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [selectedDetailSession, setSelectedDetailSession] = useState<DailyDipSession | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Available Tanks (Naturally sorted in ascending order: Tank 01, Tank 02, etc.)
  const availableTanks = useMemo(() => {
    const rawList = tanks || [];
    return [...rawList].sort((a, b) => 
      (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [tanks]);

  // Form State for Multi-Tank Entry Modal
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    shift: 'Morning (06:00 - 14:00)',
    supervisor: 'Supervisor',
    remarks: '',
  });

  // Physical dip inputs mapped by tankId: string
  const [dipInputs, setDipInputs] = useState<{ [tankId: string]: string }>({});

  // Initialize dip inputs with current system volume when modal opens
  const handleOpenNewDipModal = () => {
    const initialInputs: { [tankId: string]: string } = {};
    availableTanks.forEach(tank => {
      // Default to empty or currentLevel for easy editing
      initialInputs[tank.id] = '';
    });
    setDipInputs(initialInputs);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      shift: 'Morning (06:00 - 14:00)',
      supervisor: 'Supervisor',
      remarks: '',
    });
    setIsEntryModalOpen(true);
  };

  // Toast Notification Trigger
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Dip Sessions directly from Supabase
  const fetchDipSessions = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    // 1. Try local storage first for cached rendering if valid
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
        }
      }
    } catch (_) {}

    // 2. Fetch from Supabase
    try {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (!isConfigured) {
        setIsLoading(false);
        return;
      }

      let dipData: any[] | null = null;
      const { data, error } = await supabase
        .from('daily_dip_sessions')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        dipData = data;
      } else {
        // Fallback check on daily_dip_records if daily_dip_sessions table is named differently
        const { data: recData } = await supabase
          .from('daily_dip_records')
          .select('*')
          .order('date', { ascending: false });
        if (recData) {
          dipData = recData;
        }
      }

      if (dipData) {
        if (dipData.length > 0) {
          const mappedSessions: DailyDipSession[] = dipData.map((d: any) => ({
            id: d.id,
            date: d.date || new Date().toISOString().slice(0, 10),
            time: d.time || '08:00',
            shift: d.shift || 'Morning (06:00 - 14:00)',
            supervisor: d.supervisor || d.recorded_by || 'Supervisor',
            remarks: d.remarks || d.notes || '',
            entries: Array.isArray(d.entries) ? d.entries : (typeof d.entries === 'string' ? JSON.parse(d.entries) : []),
            totalSystemVolume: Number(d.total_system_volume ?? d.totalSystemVolume) || 0,
            totalPhysicalDip: Number(d.total_physical_dip ?? d.totalPhysicalDip) || 0,
            totalVarianceLiters: Number(d.total_variance_liters ?? d.totalVarianceLiters) || 0,
            tanksCount: Number(d.tanks_count ?? d.tanksCount) || 0,
            createdAt: d.created_at || d.createdAt
          }));
          setSessions(mappedSessions);
          try {
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(mappedSessions));
          } catch (_) {}
        } else {
          // Zero rows in Supabase: keep state strictly empty, do NOT inject mock data
          setSessions([]);
          try {
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify([]));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn("Error fetching daily dip sessions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDipSessions();

    // Subscribe to real-time changes on daily_dip_sessions
    let realtimeChannel: any = null;
    try {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        realtimeChannel = supabase
          .channel('public:daily_dip_sessions_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'daily_dip_sessions' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const d = payload.new;
                const newSession: DailyDipSession = {
                  id: d.id,
                  date: d.date || new Date().toISOString().slice(0, 10),
                  time: d.time || '08:00',
                  shift: d.shift || 'Morning (06:00 - 14:00)',
                  supervisor: d.supervisor || d.recorded_by || 'Supervisor',
                  remarks: d.remarks || d.notes || '',
                  entries: Array.isArray(d.entries) ? d.entries : (typeof d.entries === 'string' ? JSON.parse(d.entries) : []),
                  totalSystemVolume: Number(d.total_system_volume ?? d.totalSystemVolume) || 0,
                  totalPhysicalDip: Number(d.total_physical_dip ?? d.totalPhysicalDip) || 0,
                  totalVarianceLiters: Number(d.total_variance_liters ?? d.totalVarianceLiters) || 0,
                  tanksCount: Number(d.tanks_count ?? d.tanksCount) || 0,
                  createdAt: d.created_at || d.createdAt
                };
                setSessions(prev => {
                  if (prev.some(s => s.id === newSession.id)) {
                    return prev.map(s => s.id === newSession.id ? newSession : s);
                  }
                  return [newSession, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                const d = payload.new;
                const updatedSession: DailyDipSession = {
                  id: d.id,
                  date: d.date,
                  time: d.time || '08:00',
                  shift: d.shift || 'Morning (06:00 - 14:00)',
                  supervisor: d.supervisor || d.recorded_by || 'Supervisor',
                  remarks: d.remarks || d.notes || '',
                  entries: Array.isArray(d.entries) ? d.entries : (typeof d.entries === 'string' ? JSON.parse(d.entries) : []),
                  totalSystemVolume: Number(d.total_system_volume ?? d.totalSystemVolume) || 0,
                  totalPhysicalDip: Number(d.total_physical_dip ?? d.totalPhysicalDip) || 0,
                  totalVarianceLiters: Number(d.total_variance_liters ?? d.totalVarianceLiters) || 0,
                  tanksCount: Number(d.tanks_count ?? d.tanksCount) || 0,
                  createdAt: d.created_at || d.createdAt
                };
                setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
              } else if (payload.eventType === 'DELETE') {
                if (payload.old?.id) {
                  setSessions(prev => prev.filter(s => s.id !== payload.old.id));
                }
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn("Realtime subscription setup notice:", err);
    }

    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);

  // Compute live multi-tank calculations for entry modal
  const modalCalculations = useMemo(() => {
    let totalSys = 0;
    let totalPhys = 0;
    let totalVar = 0;
    let hasAnyInput = false;

    const tankRows = availableTanks.map(tank => {
      const sysVol = Number(tank.currentLevel) || 0;
      const rawInput = dipInputs[tank.id];
      const physVol = rawInput !== undefined && rawInput.trim() !== '' ? Number(rawInput) : sysVol;
      
      if (rawInput !== undefined && rawInput.trim() !== '') {
        hasAnyInput = true;
      }

      const varianceL = physVol - sysVol;
      const varPct = sysVol > 0 ? (varianceL / sysVol) * 100 : 0;
      
      let status: 'Normal' | 'Gain' | 'Loss' | 'Warning' = 'Normal';
      if (Math.abs(varPct) > 1.5) {
        status = 'Warning';
      } else if (varianceL > 0) {
        status = 'Gain';
      } else if (varianceL < 0) {
        status = 'Loss';
      }

      totalSys += sysVol;
      totalPhys += physVol;
      totalVar += varianceL;

      return {
        tankId: tank.id,
        tankName: tank.name,
        fuelType: tank.fuelType,
        systemVolume: sysVol,
        physicalDip: physVol,
        rawInput: rawInput || '',
        varianceLiters: varianceL,
        variancePercentage: varPct,
        status
      };
    });

    return {
      tankRows,
      totalSys,
      totalPhys,
      totalVar,
      hasAnyInput
    };
  }, [availableTanks, dipInputs]);

  // Handle Save All-Tanks Daily Dip Record
  const handleSaveDailyDip = async (e: React.FormEvent) => {
    e.preventDefault();

    const tankEntries: TankDipEntry[] = modalCalculations.tankRows.map(row => ({
      tankId: row.tankId,
      tankName: row.tankName,
      fuelType: row.fuelType,
      systemVolume: row.systemVolume,
      physicalDip: row.physicalDip,
      varianceLiters: row.varianceLiters,
      variancePercentage: row.variancePercentage,
      status: row.status
    }));

    const newSession: DailyDipSession = {
      id: `dip_session_${Date.now()}`,
      date: formData.date || new Date().toISOString().slice(0, 10),
      time: formData.time || '08:00',
      shift: formData.shift,
      supervisor: formData.supervisor || 'Supervisor',
      remarks: formData.remarks,
      entries: tankEntries,
      totalSystemVolume: modalCalculations.totalSys,
      totalPhysicalDip: modalCalculations.totalPhys,
      totalVarianceLiters: modalCalculations.totalVar,
      tanksCount: tankEntries.length,
      createdAt: new Date().toISOString()
    };

    // Optimistic UI state update
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
    } catch (_) {}

    setIsEntryModalOpen(false);
    showToast(`Daily Dip Record (${tankEntries.length} tanks) saved successfully!`);

    // Sync to Supabase
    try {
      const payload = {
        id: newSession.id,
        date: newSession.date,
        time: newSession.time,
        shift: newSession.shift,
        supervisor: newSession.supervisor,
        remarks: newSession.remarks,
        entries: newSession.entries,
        total_system_volume: newSession.totalSystemVolume,
        total_physical_dip: newSession.totalPhysicalDip,
        total_variance_liters: newSession.totalVarianceLiters,
        tanks_count: newSession.tanksCount,
        created_at: newSession.createdAt
      };

      const { error } = await supabase.from('daily_dip_sessions').insert([payload]);

      if (error) {
        // Fallback to daily_dip_records table if daily_dip_sessions is named differently
        const { error: err2 } = await supabase.from('daily_dip_records').insert([payload]);
        if (err2) {
          console.warn("Supabase insert notice for dip records:", err2.message);
        }
      }
    } catch (err) {
      console.warn("Supabase dip insert error:", err);
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const matchesSearch = 
        session.date.includes(searchQuery) ||
        session.supervisor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (session.remarks || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.shift.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesShift = selectedShiftFilter === 'all' || session.shift === selectedShiftFilter;

      return matchesSearch && matchesShift;
    });
  }, [sessions, searchQuery, selectedShiftFilter]);

  // Master Export CSV Functionality
  const exportMasterCSV = () => {
    if (sessions.length === 0) {
      showToast("No dip records available to export.");
      return;
    }

    const headers = [
      'Audit Date', 'Audit Time', 'Shift/Session', 'Supervisor', 
      'Total Tanks', 'Total System Volume (L)', 'Total Physical Dip (L)', 
      'Net Variance (L)', 'Net Variance (%)', 'Remarks'
    ];

    const rows = sessions.map(s => {
      const varPct = s.totalSystemVolume > 0 ? (s.totalVarianceLiters / s.totalSystemVolume) * 100 : 0;
      return [
        s.date,
        s.time,
        `"${s.shift}"`,
        `"${s.supervisor}"`,
        s.tanksCount,
        s.totalSystemVolume.toFixed(2),
        s.totalPhysicalDip.toFixed(2),
        s.totalVarianceLiters.toFixed(2),
        `${varPct.toFixed(2)}%`,
        `"${(s.remarks || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daily_Dip_Audit_Master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Master Dip Records exported to CSV successfully.");
  };

  // Single Session Tank-by-Tank CSV Export
  const exportSingleSessionCSV = (session: DailyDipSession) => {
    const headers = [
      'Audit Date', 'Shift', 'Tank Name', 'Fuel Grade', 
      'System Volume (L)', 'Physical Dip (L)', 'Variance (L)', 'Variance (%)', 'Status', 'Supervisor'
    ];

    const rows = session.entries.map(e => [
      session.date,
      `"${session.shift}"`,
      `"${e.tankName}"`,
      `"${e.fuelType}"`,
      e.systemVolume.toFixed(2),
      e.physicalDip.toFixed(2),
      e.varianceLiters.toFixed(2),
      `${e.variancePercentage.toFixed(2)}%`,
      e.status,
      `"${session.supervisor}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dip_Breakdown_${session.date}_${session.shift.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Droplet className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">Manual Dip Record &amp; Stock Audit</h1>
          </div>
          <p className="text-xs text-gray-500 font-medium pl-0.5">
            Simultaneously record physical dip readings across all underground storage tanks, calculate live variances, and review audit history.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchDipSessions}
            className="p-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Refresh from Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={exportMasterCSV}
            disabled={sessions.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>Export CSV</span>
          </button>

          {/* Prominent Add New Dip Button */}
          <button
            id="btn-add-daily-dip"
            onClick={handleOpenNewDipModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dip</span>
          </button>
        </div>
      </div>

      {/* Master Daily Dip History List Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by date, supervisor, shift..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-gray-500">Filter Shift:</span>
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Shifts &amp; Audits</option>
              <option value="Morning (06:00 - 14:00)">Morning (06:00 - 14:00)</option>
              <option value="Evening (14:00 - 22:00)">Evening (14:00 - 22:00)</option>
              <option value="Night (22:00 - 06:00)">Night (22:00 - 06:00)</option>
              <option value="Daily Audit / Dip Reconciliation">Daily Audit / Dip Reconciliation</option>
            </select>
          </div>
        </div>

        {/* Database Notice if error */}
        {errorMsg && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchDipSessions} className="underline font-bold text-amber-950 cursor-pointer">Retry</button>
          </div>
        )}

        {/* Master History Table */}
        {isLoading && sessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 font-semibold animate-pulse">
            Loading daily dip audit sessions...
          </div>
        ) : filteredSessions.length > 0 ? (
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 font-bold text-gray-500 text-[10px] uppercase border-b border-gray-100">
                <tr>
                  <th className="p-3.5">Audit Date &amp; Time</th>
                  <th className="p-3.5">Shift / Session</th>
                  <th className="p-3.5">Recorded By</th>
                  <th className="p-3.5 text-center">Tanks</th>
                  <th className="p-3.5 text-right">System Book Volume</th>
                  <th className="p-3.5 text-right">Physical Measured Dip</th>
                  <th className="p-3.5 text-right">Net Total Variance</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {filteredSessions.map((session) => {
                  const isLoss = session.totalVarianceLiters < 0;
                  const isGain = session.totalVarianceLiters > 0;
                  const varPct = session.totalSystemVolume > 0 
                    ? (session.totalVarianceLiters / session.totalSystemVolume) * 100 
                    : 0;

                  return (
                    <tr 
                      key={session.id} 
                      className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedDetailSession(session)}
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-bold text-slate-900">{session.date}</span>
                          <span className="text-[11px] text-gray-400 font-medium">{session.time}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-semibold text-gray-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-semibold">
                          {session.shift}
                        </span>
                      </td>

                      <td className="p-3.5 text-gray-700 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>{session.supervisor}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px]">
                          {session.tanksCount || (session.entries?.length ?? 0)} Tanks
                        </span>
                      </td>

                      <td className="p-3.5 text-right text-gray-600 font-semibold tabular-nums whitespace-nowrap">
                        {session.totalSystemVolume.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {session.totalPhysicalDip.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        {isLoss ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            <TrendingDown className="w-3 h-3 shrink-0" />
                            <span>{session.totalVarianceLiters.toFixed(1)} L ({varPct.toFixed(2)}%)</span>
                          </span>
                        ) : isGain ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            <TrendingUp className="w-3 h-3 shrink-0" />
                            <span>+{session.totalVarianceLiters.toFixed(1)} L (+{varPct.toFixed(2)}%)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                            <span>0.0 L (0.00%)</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedDetailSession(session)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="View Tank Breakdown"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Breakdown</span>
                          </button>

                          <button
                            onClick={() => exportSingleSessionCSV(session)}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Export Session CSV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : sessions.length === 0 ? (
          <div id="no-dip-records-empty-card" className="bg-gray-50/70 rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
              <Droplet className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 font-sans">No Dip Records Found</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto font-medium leading-relaxed font-sans">
              No dip records found. Click &apos;+ Add New Dip&apos; to record your first physical tank measurement.
            </p>
            <div className="pt-2">
              <button
                onClick={handleOpenNewDipModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add New Dip</span>
              </button>
            </div>
          </div>
        ) : (
          <div id="no-filtered-dips-card" className="bg-gray-50/70 rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-2xl flex items-center justify-center mx-auto text-gray-500">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 font-sans">No Matching Dip Records</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto font-medium font-sans">
              No daily dip records match your current search or shift filter.
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedShiftFilter('all');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ALL-TANKS DAILY DIP ENTRY MODAL (SCREEN)                                   */}
      {/* ========================================================================= */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl border border-gray-200 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight font-sans">
                    Record All-Tanks Daily Dip Audit
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Enter physical measured dip volumes for all registered storage tanks simultaneously.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSaveDailyDip} className="space-y-5 overflow-y-auto pt-4 flex-1 pr-1">
              {/* Global Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Audit Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData(p => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Shift / Session</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData(p => ({ ...p, shift: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  >
                    <option value="Morning (06:00 - 14:00)">Morning (06:00 - 14:00)</option>
                    <option value="Evening (14:00 - 22:00)">Evening (14:00 - 22:00)</option>
                    <option value="Night (22:00 - 06:00)">Night (22:00 - 06:00)</option>
                    <option value="Daily Audit / Dip Reconciliation">Daily Audit / Dip Reconciliation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Supervisor"
                    value={formData.supervisor}
                    onChange={(e) => setFormData(p => ({ ...p, supervisor: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              {/* Tank-by-Tank Multi-Entry Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Underground Storage Tanks Dip Measurements ({availableTanks.length} Tanks)
                  </h4>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Auto-calculates variance = (Physical Dip - System Book Volume)
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Tank Identifier &amp; Grade</th>
                        <th className="p-3 text-right">System Book Volume (L)</th>
                        <th className="p-3 text-right w-44">Physical Dip Input (L)</th>
                        <th className="p-3 text-right">Live Variance (L)</th>
                        <th className="p-3 text-center">Variance % &amp; Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-slate-800">
                      {modalCalculations.tankRows.map((row, idx) => {
                        const isLoss = row.varianceLiters < 0;
                        const isGain = row.varianceLiters > 0;
                        return (
                          <tr key={row.tankId} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{row.tankName}</div>
                              <div className="text-[11px] text-gray-500">{row.fuelType}</div>
                            </td>

                            <td className="p-3 text-right text-slate-600 font-semibold tabular-nums">
                              {row.systemVolume.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                            </td>

                            <td className="p-3 text-right">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder={row.systemVolume.toString()}
                                  value={dipInputs[row.tankId] ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDipInputs(prev => ({ ...prev, [row.tankId]: val }));
                                  }}
                                  className="w-full px-3 py-1.5 text-right font-bold text-slate-900 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums text-xs"
                                />
                              </div>
                            </td>

                            <td className="p-3 text-right whitespace-nowrap tabular-nums">
                              {isLoss ? (
                                <span className="font-bold text-rose-600">
                                  {row.varianceLiters.toFixed(1)} L
                                </span>
                              ) : isGain ? (
                                <span className="font-bold text-emerald-600">
                                  +{row.varianceLiters.toFixed(1)} L
                                </span>
                              ) : (
                                <span className="font-semibold text-gray-500">0.0 L</span>
                              )}
                            </td>

                            <td className="p-3 text-center whitespace-nowrap">
                              {row.status === 'Warning' ? (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[10px]">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{row.variancePercentage.toFixed(2)}% (High Deviation)</span>
                                </span>
                              ) : isLoss ? (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[10px]">
                                  <TrendingDown className="w-3 h-3" />
                                  <span>{row.variancePercentage.toFixed(2)}% Loss</span>
                                </span>
                              ) : isGain ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+{row.variancePercentage.toFixed(2)}% Gain</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md text-[10px]">
                                  <span>0.00% Balanced</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Multi-Tank Totals Summary Footer */}
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs">
                      <tr>
                        <td colSpan={2} className="p-3 text-slate-800 uppercase tracking-wider font-extrabold">
                          Total All Tanks:
                        </td>
                        <td className="p-3 text-right text-slate-700 tabular-nums">
                          {modalCalculations.totalSys.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                        </td>
                        <td className="p-3 text-right text-slate-900 font-extrabold tabular-nums">
                          {modalCalculations.totalPhys.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          <span className={modalCalculations.totalVar >= 0 ? 'text-emerald-700 font-extrabold' : 'text-rose-600 font-extrabold'}>
                            {modalCalculations.totalVar >= 0 ? `+${modalCalculations.totalVar.toFixed(1)} L` : `${modalCalculations.totalVar.toFixed(1)} L`}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[11px] font-extrabold ${modalCalculations.totalVar >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {modalCalculations.totalSys > 0 ? ((modalCalculations.totalVar / modalCalculations.totalSys) * 100).toFixed(2) : '0.00'}% Net
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* General Remarks Input */}
              <div className="text-xs">
                <label className="block font-semibold text-gray-700 mb-1">Audit Remarks &amp; Observations (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Dip measurements recorded after shift changeover. Calibration dip rod verified clean with water-finding paste..."
                  value={formData.remarks}
                  onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Daily Dip Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED SINGLE RECORD BREAKDOWN VIEW MODAL                                */}
      {/* ========================================================================= */}
      {selectedDetailSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-gray-200 my-auto max-h-[92vh] flex flex-col space-y-5">
            {/* Breakdown Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight font-sans">
                    Daily Dip Audit Breakdown
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <span>{selectedDetailSession.date}</span>
                    <span>•</span>
                    <span>{selectedDetailSession.time}</span>
                    <span>•</span>
                    <span className="font-semibold text-blue-700">{selectedDetailSession.shift}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportSingleSessionCSV(selectedDetailSession)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setSelectedDetailSession(null)}
                  className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Supervisor</span>
                <span className="font-bold text-slate-800">{selectedDetailSession.supervisor}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Total System (L)</span>
                <span className="font-bold text-slate-800 tabular-nums">
                  {selectedDetailSession.totalSystemVolume.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Physical Dip (L)</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {selectedDetailSession.totalPhysicalDip.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Net Variance</span>
                <span className={`font-extrabold tabular-nums ${selectedDetailSession.totalVarianceLiters >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {selectedDetailSession.totalVarianceLiters >= 0 ? `+${selectedDetailSession.totalVarianceLiters.toFixed(1)} L` : `${selectedDetailSession.totalVarianceLiters.toFixed(1)} L`}
                </span>
              </div>
            </div>

            {/* Tank-by-Tank Detailed Breakdown Table */}
            <div className="overflow-y-auto flex-1 border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 font-bold uppercase text-[10px] text-slate-600 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Tank &amp; Fuel Grade</th>
                    <th className="p-3 text-right">System Book (L)</th>
                    <th className="p-3 text-right">Physical Dip (L)</th>
                    <th className="p-3 text-right">Variance (L)</th>
                    <th className="p-3 text-right">Variance (%)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-slate-800">
                  {selectedDetailSession.entries.map((entry, idx) => {
                    const isLoss = entry.varianceLiters < 0;
                    const isGain = entry.varianceLiters > 0;
                    return (
                      <tr key={entry.tankId || idx} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          <div>{entry.tankName}</div>
                          <div className="text-[10px] text-gray-500 font-normal">{entry.fuelType}</div>
                        </td>
                        <td className="p-3 text-right text-gray-600 tabular-nums">
                          {entry.systemVolume.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                          {entry.physicalDip.toLocaleString('en-LK', { maximumFractionDigits: 1 })} L
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums whitespace-nowrap">
                          <span className={isLoss ? 'text-rose-600' : isGain ? 'text-emerald-700' : 'text-gray-500'}>
                            {isGain ? '+' : ''}{entry.varianceLiters.toFixed(1)} L
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums whitespace-nowrap">
                          <span className={isLoss ? 'text-rose-600' : isGain ? 'text-emerald-700' : 'text-gray-500'}>
                            {entry.variancePercentage >= 0 ? '+' : ''}{entry.variancePercentage.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {entry.status === 'Warning' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px]">
                              High Deviation
                            </span>
                          ) : isLoss ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold text-[10px]">
                              Loss
                            </span>
                          ) : isGain ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px]">
                              Gain
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-md font-semibold text-[10px]">
                              Balanced
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Remarks Section */}
            {selectedDetailSession.remarks && (
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs">
                <span className="font-bold text-blue-950 block mb-0.5">Audit Remarks:</span>
                <p className="text-slate-700 leading-relaxed font-medium">{selectedDetailSession.remarks}</p>
              </div>
            )}

            {/* Close Button */}
            <div className="flex items-center justify-end pt-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setSelectedDetailSession(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
