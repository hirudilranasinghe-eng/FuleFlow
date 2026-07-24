/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Settings, Save, RotateCcw, ShieldCheck, HelpCircle, 
  MapPin, Landmark, DollarSign, Info, CheckCircle2,
  Database, AlertTriangle, Copy, Check, ExternalLink
} from 'lucide-react';
import { FuelTank } from '../types';
import { supabase } from '../lib/supabase';
import { SUPABASE_SQL } from '../lib/sqlSchema';

interface SettingsTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  onResetAllData: () => void;
}

export default function SettingsTab({ tanks, setTanks, onResetAllData }: SettingsTabProps) {
  const [stationName, setStationName] = useState(() => localStorage.getItem('fuelflow_station_name') || 'FuelFlow Station - Colombo 07');
  const [stationLocation, setStationLocation] = useState(() => localStorage.getItem('fuelflow_station_location') || 'Albert Crescent, Colombo, Sri Lanka');
  const [stationCurrency, setStationCurrency] = useState(() => localStorage.getItem('fuelflow_station_currency') || 'LKR (Rs.)');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Supabase testing state
  const [copied, setCopied] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error' | 'missing_tables'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkSupabaseConnection = async () => {
    setCheckingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');
    try {
      const { data, error } = await supabase.from('employees').select('id').limit(1);
      if (error) {
        if (
          error.code === '42P01' || 
          error.message?.includes('relation') || 
          error.message?.includes('does not exist') ||
          String(error).includes('42P01')
        ) {
          setConnectionStatus('missing_tables');
          setConnectionMessage('Connected to Supabase, but the database tables do not exist yet. Please run the SQL script below in your Supabase SQL Editor.');
        } else {
          setConnectionStatus('error');
          setConnectionMessage(error.message || 'Error communicating with Supabase API.');
        }
      } else {
        setConnectionStatus('success');
        setConnectionMessage('Success! App is successfully connected to Supabase, and tables are fully initialized.');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message || 'Network error or invalid Supabase connection keys.');
    } finally {
      setCheckingConnection(false);
    }
  };

  // Prices local temporary state
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const p: Record<string, number> = {};
    tanks.forEach(t => {
      p[t.id] = t.pricePerLiter;
    });
    return p;
  });

  const handlePriceChange = (id: string, val: number) => {
    setPrices({
      ...prices,
      [id]: val
    });
  };

  const handleSaveSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Save prices back to tanks
    const updatedTanks = tanks.map(t => {
      if (prices[t.id] !== undefined) {
        return {
          ...t,
          pricePerLiter: prices[t.id]
        };
      }
      return t;
    });

    setTanks(updatedTanks);
    
    localStorage.setItem('fuelflow_station_name', stationName);
    localStorage.setItem('fuelflow_station_location', stationLocation);
    localStorage.setItem('fuelflow_station_currency', stationCurrency);

    setToastMessage('Station configurations saved successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTriggerReset = () => {
    if (confirm("Are you sure you want to reset all station logs, stock levels, and staff assignments back to original demo values? All custom entries will be cleared.")) {
      onResetAllData();
      // Reload page to reset states smoothly
      window.location.reload();
    }
  };

  return (
    <div id="settings-tab-root" className="space-y-4 max-w-4xl">
      {/* Page Header */}
      <div id="settings-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            Station Settings
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Configure default fuel pricing boards, local currencies, station identities, and diagnostic reset controls
          </p>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Form Settings */}
      <form onSubmit={handleSaveSettingsSubmit} className="space-y-6">
        
        {/* Station Identity Section */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-[#1C1C1C] text-base flex items-center gap-2">
            <Landmark className="w-5 h-5 text-blue-600" />
            <span>Station Identity</span>
          </h3>
          <p className="text-xs text-gray-500">Configure global metadata broadcasted in printed fuel reports and invoices</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Station Name
              </label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Primary Currency
              </label>
              <select
                value={stationCurrency}
                onChange={(e) => setStationCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
              >
                                <option value="LKR (Rs.)">LKR (Rs.) - Sri Lankan Rupee</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Physical Address Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={stationLocation}
                  onChange={(e) => setStationLocation(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Global Fuel Price Panel */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-[#1C1C1C] text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span>Global Board Fuel Prices</span>
          </h3>
          <p className="text-xs text-gray-500">Set the pricing board rate per liter used across all automated active shift sales calculations</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {tanks.map((tank) => (
              <div key={tank.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] tabular-nums font-semibold text-gray-500 uppercase tracking-wider font-bold">{tank.id}</span>
                  <span className="font-semibold text-[#1C1C1C] text-sm block mt-0.5">{tank.name}</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices[tank.id] !== undefined ? prices[tank.id] : tank.pricePerLiter}
                    onChange={(e) => handlePriceChange(tank.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-lg text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500 text-center font-bold"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-[#1C1C1C] font-bold text-sm rounded-xl hover:brightness-110 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration Details</span>
          </button>
        </div>
      </form>

      {/* Supabase Integration & Diagnostics Panel */}
      <div id="supabase-diagnostics-panel" className="glass-panel rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h3 className="font-bold text-[#1C1C1C] text-lg flex items-center gap-2">
            <Database className="w-5.5 h-5.5 text-blue-600" />
            <span>Supabase Cloud Integration Status</span>
          </h3>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Mode Active
          </span>
        </div>

        {/* Current Config State & Live Connection Checker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-700">Database Connection State</h4>
            <div className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Supabase URL:</span>
                <span className="font-mono text-gray-800 break-all">{import.meta.env.VITE_SUPABASE_URL || 'Not Set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Service Status:</span>
                <span className="font-bold text-gray-800">
                  {import.meta.env.VITE_SUPABASE_URL ? 'Loaded from Environment' : 'Missing Variables'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={checkSupabaseConnection}
              disabled={checkingConnection}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-[#1C1C1C] disabled:bg-blue-300 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              {checkingConnection ? 'Testing Connection...' : 'Test Connection / Verify Tables'}
            </button>

            {connectionStatus !== 'idle' && (
              <div className={`p-4 rounded-xl text-xs flex gap-2 border ${
                connectionStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                connectionStatus === 'missing_tables' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}>
                {connectionStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                {(connectionStatus === 'missing_tables' || connectionStatus === 'error') && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                <div>
                  <span className="font-bold block">
                    {connectionStatus === 'success' ? 'Database Ready!' : 
                     connectionStatus === 'missing_tables' ? 'Tables Missing' : 
                     'Connection Error'}
                  </span>
                  <p className="mt-1 leading-relaxed">{connectionMessage}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-700">Sri Lankan Pumper Setup Instructions (Sinhala)</h4>
            <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-xl text-xs space-y-2 leading-relaxed text-blue-900">
              <p>
                <strong>Supabase Setup කරගන්නේ කෙසේද:</strong>
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>පහත තියෙන <strong>Copy SQL Script</strong> button එක ඔබලා Code එක copy කරගන්න.</li>
                <li>ඔබගේ Supabase Dashboard (supabase.com) එකට ගොස් project එක open කරන්න.</li>
                <li>වම්පස මෙනුවේ ඇති <strong>SQL Editor</strong> එක ක්ලික් කරන්න.</li>
                <li><strong>New Query</strong> (+) ක්ලික් කර, copy කරගත් code එක paste කරන්න.</li>
                <li><strong>Run</strong> බොත්තම ඔබා Database Tables සාදාගන්න.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* SQL Script View & Copy */}
        <div className="border-t border-gray-100 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Database Tables SQL Schema (supabase_schema.sql)</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded">v1.1</span>
            </div>
            <button
              type="button"
              onClick={handleCopySQL}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy SQL Script</span>
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <pre className="p-4 bg-gray-950 text-emerald-400 font-mono text-[11px] leading-normal rounded-xl h-48 overflow-y-auto border border-gray-900 shadow-inner">
              {SUPABASE_SQL}
            </pre>
          </div>
        </div>
      </div>

      {/* Danger Zone Controls */}
      <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-red-400 text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-red-500" />
          <span>Danger Zone Diagnostic Controls</span>
        </h3>
        <p className="text-xs text-red-300/80 max-w-xl">
          Resetting the station data clears all current active shifts, custom registered employees, stock delivery logs, and restores the original sandbox sandbox demo values. This action is irreversible.
        </p>
        
        <div className="pt-2">
          <button
            type="button"
            onClick={handleTriggerReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600/90 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/10 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Database to Initial Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
