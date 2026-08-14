/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, MessageSquare, Sliders, Database, Save, 
  CheckCircle2, AlertTriangle, ShieldCheck, Phone, Mail, 
  MapPin, Landmark, Send, RefreshCw, Download, FileJson, 
  FileSpreadsheet, Lock, Unlock, Eye, EyeOff, Copy, 
  Check, Info, Sparkles, Bell, Radio, AlertCircle, 
  RotateCcw, HelpCircle, HardDrive, Smartphone, Key,
  Palette, Printer, Image, Upload, Trash2, Type, Hash, 
  FileText, Layers, SlidersHorizontal, Truck
} from 'lucide-react';
import { 
  FuelTank, OilTank, Employee, Shift, StockDelivery, 
  Customer, CreditTransaction, CreditPayment,
  ReceiptDesignerConfig, DEFAULT_RECEIPT_CONFIG 
} from '../types';
import { supabase } from '../lib/supabase';
import { SUPABASE_SQL } from '../lib/sqlSchema';
import { formatSriLankanPhoneNumber, dispatchTextLKSMS, SMSDispatchResult } from '../lib/smsService';

interface SettingsTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  oilTanks?: OilTank[];
  employees?: Employee[];
  shiftHistory?: Shift[];
  deliveries?: StockDelivery[];
  customers?: Customer[];
  creditTransactions?: CreditTransaction[];
  payments?: CreditPayment[];
  onResetAllData?: () => void;
}

export default function SettingsTab({
  tanks,
  setTanks,
  oilTanks = [],
  employees = [],
  shiftHistory = [],
  deliveries = [],
  customers = [],
  creditTransactions = [],
  payments = [],
  onResetAllData
}: SettingsTabProps) {
  // Sub-navigation: 'profile' | 'designer' | 'sms' | 'rules' | 'data'
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'designer' | 'sms' | 'rules' | 'data'>('profile');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // =========================================================================
  // 0. RECEIPT & INVOICE DESIGNER STATE
  // =========================================================================
  const [receiptConfig, setReceiptConfig] = useState<ReceiptDesignerConfig>(() => {
    try {
      const stored = localStorage.getItem('fms_receipt_designer_config');
      if (stored) return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(stored) };
    } catch (_) {}
    return DEFAULT_RECEIPT_CONFIG;
  });

  const previewPrintRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primaryPresets = [
    { label: 'Ceypetco Blue', hex: '#123d82' },
    { label: 'Ceylon Navy', hex: '#0b2545' },
    { label: 'Emerald Station', hex: '#047857' },
    { label: 'Crimson Red', hex: '#991b1b' },
    { label: 'Slate Graphite', hex: '#1e293b' },
    { label: 'Deep Teal', hex: '#0f766e' },
    { label: 'Royal Purple', hex: '#581c87' }
  ];

  const accentPresets = [
    { label: 'Bold Red', hex: '#d62828' },
    { label: 'Amber Orange', hex: '#ea580c' },
    { label: 'Goldenrod', hex: '#d97706' },
    { label: 'Royal Indigo', hex: '#4338ca' },
    { label: 'Emerald Green', hex: '#059669' },
    { label: 'Rose Pink', hex: '#e11d48' }
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setReceiptConfig(prev => ({ ...prev, logoUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setReceiptConfig(prev => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveReceiptConfig = () => {
    localStorage.setItem('fms_receipt_designer_config', JSON.stringify(receiptConfig));
    // Dispatch custom event for real-time reactivity in PurchasesTab and other components
    window.dispatchEvent(new CustomEvent('receipt_config_updated', { detail: receiptConfig }));
    showToast('Receipt & Invoice template design saved successfully!');
  };

  const handleResetReceiptConfig = () => {
    if (confirm('Reset receipt template design to standard default styling & colors?')) {
      setReceiptConfig(DEFAULT_RECEIPT_CONFIG);
      localStorage.setItem('fms_receipt_designer_config', JSON.stringify(DEFAULT_RECEIPT_CONFIG));
      window.dispatchEvent(new CustomEvent('receipt_config_updated', { detail: DEFAULT_RECEIPT_CONFIG }));
      showToast('Receipt template design reset to default layout.');
    }
  };

  const handlePrintSampleReceipt = () => {
    window.print();
  };

  // =========================================================================
  // 1. STATION PROFILE STATE
  // =========================================================================
  const [stationProfile, setStationProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('fms_station_profile');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      stationName: 'Samse Auto Mart (Pvt) Ltd',
      dealerCode: 'CPC-DEL-0941',
      regNo: 'PV-94821/2018',
      dealerNetwork: 'Ceylon Petroleum Corporation (Ceypetco)',
      contactPhone: '+94 11 289 4500',
      emergencyHotline: '+94 77 123 4567',
      email: 'contact@samseautomart.lk',
      address: 'No. 142, Kandy Road, Colombo 07, Sri Lanka',
      taxNumber: 'VAT-229481920-7000',
      currency: 'LKR (Rs.)',
      volumeUnit: 'Liters (L)'
    };
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fms_station_profile', JSON.stringify(stationProfile));
    localStorage.setItem('fuelflow_station_name', stationProfile.stationName);
    localStorage.setItem('fuelflow_station_location', stationProfile.address);
    showToast('Station profile details saved successfully.');
  };

  // =========================================================================
  // 2. SMS NOTIFICATION GATEWAY STATE
  // =========================================================================
  const [smsConfig, setSmsConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('fms_sms_gateway_config');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      provider: 'Text.lk (Sri Lanka Direct Gateway)',
      apiKey: 'tlk_live_948271038a8f4c2e81',
      senderMask: 'SAMSE_AUTO',
      fallbackSenderMask: 'TextLK',
      endpoint: 'https://app.text.lk/api/v3/sms/send',
      ownerPhones: '+94771234567, +94719876543',
      triggers: {
        creditFueling: true,      // Credit Fueling Notification
        paymentSettlement: true,  // Payment Settlement SMS
        shiftSummary: true,       // Day-End / Shift Closure Owner Summary SMS
        lowStockAlert: true       // Low Tank Stock Emergency SMS
      }
    };
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [testRecipient, setTestRecipient] = useState('0768657349');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<SMSDispatchResult | null>(null);

  const formattedTestRecipientPreview = useMemo(() => {
    return formatSriLankanPhoneNumber(testRecipient);
  }, [testRecipient]);

  const handleProviderChange = (newProvider: string) => {
    let newEndpoint = smsConfig.endpoint;
    if (newProvider === 'Text.lk (Sri Lanka Direct Gateway)') {
      newEndpoint = 'https://app.text.lk/api/v3/sms/send';
    } else if (newProvider === 'Notify.lk (Sri Lanka Direct Gateway)') {
      newEndpoint = 'https://api.notify.lk/v1/send';
    } else if (newProvider === 'Textware (Dialog Axiata Business)') {
      newEndpoint = 'https://textware.lk/api/v2/sms/send';
    } else if (newProvider === 'Dialog Enterprise SMS Gateway') {
      newEndpoint = 'https://ideabiz.lk/apicall/sms/v4/send';
    } else if (newProvider === 'Twilio Global API') {
      newEndpoint = 'https://api.twilio.com/2010-04-01/Accounts';
    }

    setSmsConfig({
      ...smsConfig,
      provider: newProvider,
      endpoint: newEndpoint
    });
  };

  const handleSaveSMSConfig = () => {
    localStorage.setItem('fms_sms_gateway_config', JSON.stringify(smsConfig));
    showToast('SMS Gateway settings and automated triggers updated.');
  };

  const handleSendTestSMS = async () => {
    if (!testRecipient.trim()) {
      alert('Please enter a valid mobile number for the test SMS.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    const messageText = `Samse Auto Mart: Test SMS alert from ${stationProfile.stationName}. Gateway is ACTIVE & operational.`;

    try {
      const result = await dispatchTextLKSMS(testRecipient, messageText, {
        provider: smsConfig.provider,
        apiKey: smsConfig.apiKey,
        senderMask: smsConfig.senderMask,
        fallbackSenderMask: smsConfig.fallbackSenderMask || 'TextLK',
        endpoint: smsConfig.endpoint
      });

      setTestResult(result);

      if (result.success) {
        showToast(`Test SMS sent successfully! ID: ${result.messageId}`);
      } else {
        showToast(`SMS Dispatch Failed: ${result.message}`);
      }
    } catch (err: any) {
      const formatted = formatSriLankanPhoneNumber(testRecipient);
      setTestResult({
        success: false,
        httpStatus: 500,
        messageId: 'ERR-EXCEPTION',
        message: `Transmission exception: ${err.message || 'Unknown network failure'}`,
        recipientFormatted: formatted,
        senderUsed: smsConfig.senderMask || 'TextLK',
        errorDetail: err.stack || err.message
      });
      showToast(`Failed to send test SMS.`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // =========================================================================
  // 3. OPERATIONAL & SHIFT RULES STATE
  // =========================================================================
  const [operationalRules, setOperationalRules] = useState(() => {
    try {
      const stored = localStorage.getItem('fms_operational_rules');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      lockStartMeter: true,         // Start Meter Edit Lock
      tankLowStockThreshold: 40,    // Default 40%
      varianceToleranceLiters: 10,  // Shift closure loss/variance warning tolerance
      cashDiscrepancyToleranceRs: 500,
      strictLubricantReconciliation: true,
      allowManualDipOverride: true
    };
  });

  const handleSaveRules = () => {
    localStorage.setItem('fms_operational_rules', JSON.stringify(operationalRules));
    showToast('Operational safety rules and thresholds saved.');
  };

  // =========================================================================
  // 4. DATA MANAGEMENT & SYSTEM HEALTH STATE
  // =========================================================================
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error' | 'missing_tables'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [tableStatusMap, setTableStatusMap] = useState<Record<string, boolean>>({});

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const checkSupabaseHealth = async () => {
    setCheckingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');
    const tables = ['employees', 'shifts', 'fuel_tanks', 'oil_tanks', 'pump_machines', 'pumps', 'customers', 'credit_transactions', 'credit_payments'];
    const map: Record<string, boolean> = {};

    try {
      let anyError = false;
      for (const t of tables) {
        try {
          const { error } = await supabase.from(t).select('id').limit(1);
          if (error) {
            map[t] = false;
            anyError = true;
          } else {
            map[t] = true;
          }
        } catch (_) {
          map[t] = false;
          anyError = true;
        }
      }
      setTableStatusMap(map);

      if (anyError) {
        const missing = Object.keys(map).filter(k => !map[k]);
        setConnectionStatus('missing_tables');
        setConnectionMessage(`Connected to Supabase endpoint, but ${missing.length} table(s) need initialization (${missing.join(', ')}).`);
      } else {
        setConnectionStatus('success');
        setConnectionMessage('All database tables verified! Cloud synchronization is active & operational.');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err.message || 'Unable to connect to Supabase Cloud API.');
    } finally {
      setCheckingConnection(false);
    }
  };

  // Export Full JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      version: '2.5',
      exportDate: new Date().toISOString(),
      stationProfile,
      smsConfig,
      operationalRules,
      tanks,
      oilTanks,
      employees,
      shiftHistory,
      deliveries,
      customers,
      creditTransactions,
      payments
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `fuelflow_backup_${stationProfile.stationName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('System data JSON backup downloaded successfully.');
  };

  // Export Shift Sales CSV
  const handleExportShiftsCSV = () => {
    if (shiftHistory.length === 0) {
      alert('No shift history records available to export.');
      return;
    }

    const empMap = new Map(employees.map(e => [e.id, e.name]));
    const headers = ['Shift ID', 'Shift Name', 'Supervisor', 'Start Time', 'End Time', 'Status', 'Total Fuel Sold (L)', 'Net Sales (Rs.)'];
    const rows = shiftHistory.map(s => [
      `"${s.id}"`,
      `"${s.name}"`,
      `"${empMap.get(s.supervisorId) || s.supervisorId || 'N/A'}"`,
      `"${s.startTime}"`,
      `"${s.endTime || 'Ongoing'}"`,
      `"${s.isActive ? 'Active' : 'Closed'}"`,
      s.totalFuelSold || 0,
      s.totalNetSales || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `shifts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Shift sales CSV exported.');
  };

  // Export Customers CSV
  const handleExportCustomersCSV = () => {
    if (customers.length === 0) {
      alert('No customer records available to export.');
      return;
    }

    const headers = ['Customer ID', 'Name', 'Phone', 'Type', 'Credit Limit (Rs.)', 'Current Balance (Rs.)', 'Vehicles'];
    const rows = customers.map(c => [
      `"${c.id}"`,
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.customerType || 'Credit'}"`,
      c.creditLimit || 0,
      c.currentBalance || 0,
      `"${(c.vehicleNumbers || []).join('; ')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customers_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Customer accounts CSV exported.');
  };

  const handleTriggerReset = () => {
    if (confirm("⚠️ DANGER: Are you sure you want to reset all station logs, stock levels, shifts, and customer ledgers back to demo values? This cannot be undone.")) {
      if (onResetAllData) {
        onResetAllData();
      }
      window.location.reload();
    }
  };

  return (
    <div id="settings-container" className="space-y-5 animate-fade-in max-w-5xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1C1C1C] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-scale-up border border-gray-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">System & Station Settings</h1>
            <p className="text-xs text-gray-500">
              Configure station profile, SMS gateway integration, automated notification triggers, operational shift rules, and system backups
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Live & Ready
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TABS NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'profile'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Building2 className="w-4 h-4 text-blue-500" />
          <span>Station Profile</span>
        </button>

        <button
          onClick={() => setActiveSubTab('designer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'designer'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Palette className="w-4 h-4 text-rose-500" />
          <span>Receipt &amp; Invoice Designer</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'sms'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span>SMS Notification Gateway</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'rules'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-500" />
          <span>Operational & Shift Rules</span>
        </button>

        <button
          onClick={() => setActiveSubTab('data')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'data'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Database className="w-4 h-4 text-purple-500" />
          <span>Data Management & System Health</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: STATION PROFILE */}
      {/* ========================================================================= */}
      {activeSubTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <span>Station Business Identity</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Metadata printed on receipts, credit invoices, and official shift handover sheets</p>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">Official Registered Station</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-gray-700 block mb-1.5">
                  Station Commercial Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={stationProfile.stationName}
                  onChange={(e) => setStationProfile({ ...stationProfile, stationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Dealer / Station Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={stationProfile.dealerCode}
                  onChange={(e) => setStationProfile({ ...stationProfile, dealerCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Business Registration No (BRN)
                </label>
                <input
                  type="text"
                  value={stationProfile.regNo}
                  onChange={(e) => setStationProfile({ ...stationProfile, regNo: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Petroleum Distribution Network
                </label>
                <select
                  value={stationProfile.dealerNetwork}
                  onChange={(e) => setStationProfile({ ...stationProfile, dealerNetwork: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="Ceylon Petroleum Corporation (Ceypetco)">Ceylon Petroleum Corporation (Ceypetco / CPC)</option>
                  <option value="Lanka IOC (LIOC)">Lanka IOC (LIOC)</option>
                  <option value="Sinopec Energy Lanka">Sinopec Energy Lanka</option>
                  <option value="RM Parks / Shell Lanka">RM Parks / Shell Lanka</option>
                  <option value="United Petroleum">United Petroleum Lanka</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  VAT / Tax Registration Number
                </label>
                <input
                  type="text"
                  value={stationProfile.taxNumber}
                  onChange={(e) => setStationProfile({ ...stationProfile, taxNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Station Contact Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stationProfile.contactPhone}
                    onChange={(e) => setStationProfile({ ...stationProfile, contactPhone: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Emergency Manager Hotline
                </label>
                <div className="relative">
                  <Smartphone className="w-3.5 h-3.5 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stationProfile.emergencyHotline}
                    onChange={(e) => setStationProfile({ ...stationProfile, emergencyHotline: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Official Station Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={stationProfile.email}
                    onChange={(e) => setStationProfile({ ...stationProfile, email: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  System Display Currency & Unit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stationProfile.currency}
                    disabled
                    className="w-1/2 px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-bold cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={stationProfile.volumeUnit}
                    disabled
                    className="w-1/2 px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-gray-700 block mb-1.5">
                  Station Physical Street Address
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stationProfile.address}
                    onChange={(e) => setStationProfile({ ...stationProfile, address: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Station Profile</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* VIEW: RECEIPT & INVOICE DESIGNER */}
      {/* ========================================================================= */}
      {activeSubTab === 'designer' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10">
                <Palette className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Receipt &amp; Invoice Visual Designer</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                    Live Customizer
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Customize the brand colors, station headers, logos, signatures, and layout printed for bowser deliveries and oil purchases.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetReceiptConfig}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveReceiptConfig}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Design</span>
              </button>
            </div>
          </div>

          {/* Designer Main Grid: Left Controls (5 cols) & Right Live Preview (7 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* ------------------------------------------------------------- */}
            {/* LEFT PANEL: CUSTOMIZATION CONTROLS */}
            {/* ------------------------------------------------------------- */}
            <div className="xl:col-span-5 space-y-4">
              {/* Section 1: Theme & Colors */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span>Theme &amp; Brand Colors</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Color System</span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Primary Brand Color */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-gray-700">
                        Primary Brand Color <span className="text-gray-400 font-normal">(Headers, Table &amp; Grand Total)</span>
                      </label>
                      <span className="font-bold text-slate-700 uppercase">{receiptConfig.primaryBrandColor}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-10 h-10 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex-shrink-0 cursor-pointer"
                        style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                      >
                        <input
                          type="color"
                          value={receiptConfig.primaryBrandColor}
                          onChange={(e) => setReceiptConfig({ ...receiptConfig, primaryBrandColor: e.target.value })}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={receiptConfig.primaryBrandColor}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, primaryBrandColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold uppercase focus:outline-none focus:border-blue-500"
                        placeholder="#123d82"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="text-[10px] font-medium text-gray-400 mr-1">Presets:</span>
                      {primaryPresets.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setReceiptConfig({ ...receiptConfig, primaryBrandColor: preset.hex })}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            receiptConfig.primaryBrandColor.toLowerCase() === preset.hex.toLowerCase()
                              ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: preset.hex }}></span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent / Receipt No Color */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-gray-700">
                        Accent Color <span className="text-gray-400 font-normal">(Receipt Number &amp; Badges)</span>
                      </label>
                      <span className="font-bold text-slate-700 uppercase">{receiptConfig.accentColor}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-10 h-10 rounded-xl border border-gray-200 shadow-xs relative overflow-hidden flex-shrink-0 cursor-pointer"
                        style={{ backgroundColor: receiptConfig.accentColor }}
                      >
                        <input
                          type="color"
                          value={receiptConfig.accentColor}
                          onChange={(e) => setReceiptConfig({ ...receiptConfig, accentColor: e.target.value })}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={receiptConfig.accentColor}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, accentColor: e.target.value })}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold uppercase focus:outline-none focus:border-rose-500"
                        placeholder="#d62828"
                      />
                    </div>

                    {/* Accent Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="text-[10px] font-medium text-gray-400 mr-1">Presets:</span>
                      {accentPresets.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setReceiptConfig({ ...receiptConfig, accentColor: preset.hex })}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            receiptConfig.accentColor.toLowerCase() === preset.hex.toLowerCase()
                              ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-2xs'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: preset.hex }}></span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Header & Company Branding */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Header &amp; Station Identity</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Header Block</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Company / Station Name</label>
                    <input
                      type="text"
                      value={receiptConfig.companyName}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Tagline / Slogan</label>
                    <input
                      type="text"
                      value={receiptConfig.tagline}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, tagline: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 italic"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Station Address</label>
                    <input
                      type="text"
                      value={receiptConfig.address}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, address: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Contact Telephone</label>
                      <input
                        type="text"
                        value={receiptConfig.contactPhone}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, contactPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Contact Email</label>
                      <input
                        type="text"
                        value={receiptConfig.email}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, email: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">CPC / Dealer Code</label>
                      <input
                        type="text"
                        value={receiptConfig.dealerCode}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, dealerCode: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Business Reg No</label>
                      <input
                        type="text"
                        value={receiptConfig.regNo}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, regNo: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Logo Image */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="font-bold text-gray-700 block mb-1">Station Logo Image</label>
                    <div className="flex items-center gap-3">
                      {receiptConfig.logoUrl ? (
                        <div className="relative w-12 h-12 rounded-xl border border-gray-200 p-1 bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <img 
                            src={receiptConfig.logoUrl} 
                            alt="Logo" 
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-2xs"
                          style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                        >
                          SA
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="receipt-logo-file-input"
                          />
                          <label
                            htmlFor="receipt-logo-file-input"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Logo</span>
                          </label>

                          {receiptConfig.logoUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Remove custom logo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">PNG, JPG, or SVG up to 2MB (Monogram used if no logo uploaded)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Document Title & Numbering */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span>Document Title &amp; Numbering</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Identifiers</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Document Title Heading</label>
                    <input
                      type="text"
                      value={receiptConfig.documentTitle}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, documentTitle: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold uppercase focus:outline-none focus:border-purple-500"
                      placeholder="PURCHASE RECEIPT"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Receipt Number Prefix</label>
                    <input
                      type="text"
                      value={receiptConfig.receiptNoPrefix}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, receiptNoPrefix: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-purple-500"
                      placeholder="PR-2026-"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Default Remarks */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span>Default Verification Remarks</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Notes Box</span>
                </div>

                <div className="text-xs">
                  <label className="font-bold text-gray-700 block mb-1">Default Audit &amp; Calibration Statement</label>
                  <textarea
                    rows={3}
                    value={receiptConfig.defaultRemarks}
                    onChange={(e) => setReceiptConfig({ ...receiptConfig, defaultRemarks: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-800 leading-relaxed focus:outline-none focus:border-blue-500 text-[11px]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Printed in the remarks verification box below itemized fuel deliveries.</p>
                </div>
              </div>

              {/* Section 5: Signatures & Authorization */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>3-Tier Authorization Signatures</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Sign-Offs</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Signature 1 */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] block">Signature #1</span>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Title</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine1Title}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine1Title: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Sub-Label</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine1Sub}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine1Sub: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Signature 2 */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] block">Signature #2</span>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Title</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine2Title}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine2Title: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Sub-Label</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine2Sub}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine2Sub: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Signature 3 */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <span className="font-bold text-slate-700 text-[11px] block">Signature #3</span>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Title</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine3Title}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine3Title: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 block">Sub-Label</label>
                      <input
                        type="text"
                        value={receiptConfig.signatureLine3Sub}
                        onChange={(e) => setReceiptConfig({ ...receiptConfig, signatureLine3Sub: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 6: Footer & Disclaimers */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h4 className="font-bold text-[#1C1C1C] text-xs uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Footer Notes &amp; Disclaimers</span>
                  </h4>
                  <span className="text-[11px] text-gray-400">Footer</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Footer Main Note</label>
                    <input
                      type="text"
                      value={receiptConfig.footerNote}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, footerNote: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">System Audit Disclaimer</label>
                    <input
                      type="text"
                      value={receiptConfig.footerDisclaimer}
                      onChange={(e) => setReceiptConfig({ ...receiptConfig, footerDisclaimer: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 text-[11px] focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveReceiptConfig}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#123d82] hover:bg-[#0e2f65] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Template Design</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetReceiptConfig}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Reset to default layout"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT PANEL: LIVE TEMPLATE PREVIEW (1:1 Output Scale) */}
            {/* ------------------------------------------------------------- */}
            <div className="xl:col-span-7 space-y-3 sticky top-4 print:static print:p-0">
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm print:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                    Live Template Preview (Real-Time 1:1 Scale)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-slate-800 text-blue-300 px-2.5 py-1 rounded-lg">
                    900px Print Canvas
                  </span>
                  <button
                    type="button"
                    onClick={handlePrintSampleReceipt}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sample</span>
                  </button>
                </div>
              </div>

              {/* Printable Scale Preview Container */}
              <div className="bg-slate-200/70 p-3 sm:p-4 rounded-2xl border border-slate-300/80 overflow-x-auto shadow-inner print:p-0 print:bg-transparent print:border-none print:shadow-none">
                <div 
                  id="printable-sample-receipt"
                  ref={previewPrintRef}
                  className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 sm:p-8 space-y-5 font-sans mx-auto transition-all print:shadow-none print:border-none print:p-0 print:m-0"
                  style={{ minWidth: '600px', maxWidth: '900px' }}
                >
                  {/* 1. Exact Header & Branding Styling */}
                  <div className="pb-4" style={{ borderBottom: `3px solid ${receiptConfig.primaryBrandColor}` }}>
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      {/* Left: Company Branding */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          {receiptConfig.logoUrl ? (
                            <img 
                              src={receiptConfig.logoUrl} 
                              alt="Logo" 
                              className="w-10 h-10 object-contain rounded-lg shadow-2xs"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-base shadow-2xs"
                              style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                            >
                              {receiptConfig.companyName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h1 
                              className="text-xl font-black tracking-tight uppercase" 
                              style={{ color: receiptConfig.primaryBrandColor }}
                            >
                              {receiptConfig.companyName}
                            </h1>
                            <p className="text-xs font-medium italic text-slate-600">
                              {receiptConfig.tagline}
                            </p>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-600 pt-1 space-y-0.5">
                          <p>{receiptConfig.address}</p>
                          <p className="text-slate-500">
                            Tel: {receiptConfig.contactPhone} | Email: {receiptConfig.email}
                          </p>
                          <p className="text-[10px] text-slate-400 ">
                            CPC Dealer Code: {receiptConfig.dealerCode} • Business Reg: {receiptConfig.regNo}
                          </p>
                        </div>
                      </div>

                      {/* Right: Title & Receipt Meta */}
                      <div className="sm:text-right space-y-1">
                        <h2 
                          className="text-xl sm:text-2xl font-black tracking-wider uppercase font-sans" 
                          style={{ color: receiptConfig.primaryBrandColor }}
                        >
                          {receiptConfig.documentTitle}
                        </h2>
                        <div className="text-xs font-bold">
                          <span className="text-slate-500 font-normal">Receipt No: </span>
                          <span style={{ color: receiptConfig.accentColor }} className="font-extrabold text-sm">
                            {receiptConfig.receiptNoPrefix}00482
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <span className="text-slate-500 font-normal">Date &amp; Time: </span>
                          <span className="font-bold text-slate-800">2026-08-14 • 10:30 AM</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <span className="text-slate-400">Payment Terms: </span>
                          <span className="font-semibold text-slate-700">Bank Transfer / Advance</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Dual Info Boxes Grid (info-grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Box 1: SUPPLIER DETAILS */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div 
                        className="px-3.5 py-1.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between"
                        style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                      >
                        <span>SUPPLIER DETAILS</span>
                        <Building2 className="w-3.5 h-3.5 opacity-80" />
                      </div>
                      <div className="p-3 bg-slate-50/70 text-xs space-y-1 text-slate-700">
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Supplier Name:</span>
                          <span className="font-bold text-slate-900 text-right">Ceylon Petroleum Corporation</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Terminal / Address:</span>
                          <span className="font-medium text-slate-800 text-right">Kolonnawa Terminal, CPSTL Installation</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Contact No:</span>
                          <span className="text-slate-800 text-right">+94 11 257 2000 / 2001</span>
                        </div>
                      </div>
                    </div>

                    {/* Box 2: PURCHASE DETAILS */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div 
                        className="px-3.5 py-1.5 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between"
                        style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                      >
                        <span>PURCHASE DETAILS</span>
                        <Truck className="w-3.5 h-3.5 opacity-80" />
                      </div>
                      <div className="p-3 bg-slate-50/70 text-xs space-y-1 text-slate-700">
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Purchase Type:</span>
                          <span className="font-bold text-slate-900 text-right">Fuel Tanker (Bowser)</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Reference / Invoice:</span>
                          <span className="font-bold text-slate-900 text-right">CPSTL-INV-9921</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Delivery Note No:</span>
                          <span className="text-slate-800 text-right">DN-884920</span>
                        </div>
                        <div className="flex items-start justify-between">
                          <span className="text-slate-500 font-medium">Vehicle / Truck No:</span>
                          <span className="font-bold text-slate-900 text-right">WP-LI-8492 (Bowser Tanker)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Items Table (purchase-table) */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead 
                        className="text-white font-bold uppercase text-[10px] tracking-wider"
                        style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                      >
                        <tr>
                          <th className="py-2 px-3 text-center w-8">#</th>
                          <th className="py-2 px-3">Item Description</th>
                          <th className="py-2 px-3 text-center">Unit</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-right">Unit Price (LKR)</th>
                          <th className="py-2 px-3 text-right">Total (LKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                        <tr>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-bold">1</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">Auto Diesel (Super Clean)</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Destination: <span className="font-semibold text-slate-700">Tank 01 (Diesel Underground 10,000L)</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-600">L</td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">
                            6,600
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                            Rs. 317.00
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold tabular-nums text-slate-900">
                            Rs. 2,092,200.00
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Bottom Section & Calculations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
                    {/* Left: REMARKS box */}
                    <div 
                      className="rounded-xl p-3 bg-slate-50/70 text-xs space-y-1"
                      style={{ border: '1px solid #d8dee8' }}
                    >
                      <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>REMARKS &amp; VERIFICATION NOTES</span>
                      </div>
                      <p className="text-slate-600 text-[10px] leading-relaxed">
                        {receiptConfig.defaultRemarks}
                      </p>
                      <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                        <span>Decanting Bay: Pump Island #1</span>
                        <span>Density: 0.832 @ 15°C</span>
                      </div>
                    </div>

                    {/* Right: Totals Card */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs text-xs">
                      <div className="p-2.5 bg-slate-50 space-y-1 ">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Sub Total:</span>
                          <span className="font-bold tabular-nums text-slate-900">Rs. 2,092,200.00</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[10px]">
                          <span>Discount (0.0%):</span>
                          <span className="tabular-nums">Rs. 0.00</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[10px]">
                          <span>VAT / Taxes (Included):</span>
                          <span className="tabular-nums">Rs. 0.00</span>
                        </div>
                      </div>

                      {/* Solid Grand Total banner */}
                      <div 
                        className="p-3 text-white flex items-center justify-between"
                        style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                      >
                        <span className="font-extrabold uppercase tracking-wider text-xs">
                          GRAND TOTAL (LKR):
                        </span>
                        <span className="font-black text-base tabular-nums">
                          Rs. 2,092,200.00
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Signatures Section */}
                  <div className="pt-4 border-t border-dashed border-slate-300">
                    <div className="grid grid-cols-3 gap-4 text-center text-xs">
                      {/* Prepared By */}
                      <div className="space-y-4">
                        <div className="h-8 border-b border-slate-400 flex items-end justify-center pb-1">
                          <span className="text-[10px] text-slate-400 italic ">Station Staff</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine1Title}</p>
                          <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine1Sub}</p>
                        </div>
                      </div>

                      {/* Received By */}
                      <div className="space-y-4">
                        <div className="h-8 border-b border-slate-400 flex items-end justify-center pb-1">
                          <span className="text-[10px] text-slate-400 italic ">CPC Bowser Driver</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine2Title}</p>
                          <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine2Sub}</p>
                        </div>
                      </div>

                      {/* Authorized By */}
                      <div className="space-y-4">
                        <div className="h-8 border-b border-slate-400 flex items-end justify-center pb-1">
                          <span className="text-[10px] text-slate-400 italic ">Station Manager</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine3Title}</p>
                          <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine3Sub}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Footer */}
                  <div 
                    className="pt-3 text-center text-[10px] text-slate-500 font-sans"
                    style={{ borderTop: `1px solid ${receiptConfig.primaryBrandColor}` }}
                  >
                    <p className="font-medium text-slate-600">
                      {receiptConfig.footerNote}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5 ">
                      {receiptConfig.footerDisclaimer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SMS NOTIFICATION GATEWAY */}
      {/* ========================================================================= */}
      {activeSubTab === 'sms' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>SMS Gateway Integration Settings</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect local Sri Lankan telecommunication SMS gateways for real-time customer and owner alerts</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                TRCSL Mask Active
              </span>
            </div>

            {/* Provider & Credentials Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  SMS Gateway Provider
                </label>
                <select
                  value={smsConfig.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="Text.lk (Sri Lanka Direct Gateway)">Text.lk (Sri Lanka Direct Gateway - Direct TRCSL Route)</option>
                  <option value="Notify.lk (Sri Lanka Direct Gateway)">Notify.lk (Sri Lanka Direct Gateway)</option>
                  <option value="Textware (Dialog Axiata Business)">Textware (Dialog Axiata Business)</option>
                  <option value="Dialog Enterprise SMS Gateway">Dialog Enterprise SMS Gateway</option>
                  <option value="Twilio Global API">Twilio Global API</option>
                  <option value="Generic HTTP Webhook / Custom REST API">Generic HTTP Webhook / Custom REST API</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-gray-700">
                    Sender Mask / ID <span className="text-gray-400 font-normal">(Approved Alphanumeric Mask)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSmsConfig({ ...smsConfig, senderMask: 'SAMSE_AUTO' })}
                      className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded cursor-pointer"
                      title="Set Custom Station Mask"
                    >
                      SAMSE_AUTO
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmsConfig({ ...smsConfig, senderMask: 'TextLK' })}
                      className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold cursor-pointer"
                      title="Set Text.lk Default Approved Sender"
                    >
                      TextLK (Default)
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={smsConfig.senderMask}
                  onChange={(e) => setSmsConfig({ ...smsConfig, senderMask: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="e.g. TextLK or SAMSE_AUTO"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  * Tip: If your custom mask is pending TRCSL registration, use <strong>TextLK</strong> as default sender ID.
                </p>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  API Key / Bearer Token {smsConfig.provider.includes('Text.lk') && <span className="text-emerald-600 font-semibold">(Text.lk Bearer Token)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={smsConfig.apiKey}
                    onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })}
                    className="w-full pl-3.5 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    placeholder={smsConfig.provider.includes('Text.lk') ? 'tlk_live_xxxxxxxxxxxxxxxxxxxxxxxx' : 'API Key / Token'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  API Endpoint URL
                </label>
                <input
                  type="text"
                  value={smsConfig.endpoint}
                  onChange={(e) => setSmsConfig({ ...smsConfig, endpoint: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 text-[11px] focus:outline-none focus:border-blue-500"
                  placeholder="https://app.text.lk/api/v3/sms/send"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-gray-700 block mb-1.5">
                  Owner / Manager Alert Mobile Numbers <span className="text-gray-400 font-normal">(Comma separated)</span>
                </label>
                <input
                  type="text"
                  value={smsConfig.ownerPhones}
                  onChange={(e) => setSmsConfig({ ...smsConfig, ownerPhones: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="0771234567, 0719876543"
                />
              </div>
            </div>

            {/* Automated Trigger Toggles */}
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Automated Dispatch Triggers</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Trigger 1 */}
                <div className="flex items-start justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div className="pr-3">
                    <span className="font-bold text-slate-900 block">Credit Fueling Notification</span>
                    <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                      Instant SMS alert to registered vehicle owners with vehicle number, liters pumped, and total bill.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={smsConfig.triggers.creditFueling}
                      onChange={(e) => setSmsConfig({
                        ...smsConfig,
                        triggers: { ...smsConfig.triggers, creditFueling: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Trigger 2 */}
                <div className="flex items-start justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div className="pr-3">
                    <span className="font-bold text-slate-900 block">Payment Settlement SMS</span>
                    <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                      Automated digital receipt confirmation sent to customer mobile when an invoice payment is logged.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={smsConfig.triggers.paymentSettlement}
                      onChange={(e) => setSmsConfig({
                        ...smsConfig,
                        triggers: { ...smsConfig.triggers, paymentSettlement: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Trigger 3 */}
                <div className="flex items-start justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div className="pr-3">
                    <span className="font-bold text-slate-900 block">Day-End / Shift Closure Owner Summary</span>
                    <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                      Summary SMS sent to owner mobile on shift closure with revenue (Rs.), cash collected, and tank variances.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={smsConfig.triggers.shiftSummary}
                      onChange={(e) => setSmsConfig({
                        ...smsConfig,
                        triggers: { ...smsConfig.triggers, shiftSummary: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Trigger 4 */}
                <div className="flex items-start justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200/80">
                  <div className="pr-3">
                    <span className="font-bold text-slate-900 block">Low Tank Stock Emergency SMS</span>
                    <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                      Critical alert dispatched when any fuel tank drops below the safety threshold percentage.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={smsConfig.triggers.lowStockAlert}
                      onChange={(e) => setSmsConfig({
                        ...smsConfig,
                        triggers: { ...smsConfig.triggers, lowStockAlert: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSaveSMSConfig}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save SMS Configuration</span>
              </button>
            </div>
          </div>

          {/* Interactive Test SMS Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <span>Gateway Diagnostics: Send Test SMS</span>
              </h3>
              <span className="text-[10px] text-gray-500 ">Carrier Direct Testing (Text.lk)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-gray-700">
                    Test Recipient Mobile Number
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    Target: {formattedTestRecipientPreview || 'Enter number'}
                  </span>
                </div>
                <div className="relative">
                  <Smartphone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 0768657349 or 94768657349"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  * Number is automatically converted to international <strong>94</strong> format (e.g. <code>{testRecipient}</code> &rarr; <code>{formattedTestRecipientPreview}</code>).
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleSendTestSMS}
                  disabled={isSendingTest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test SMS</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Template Box */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Dispatched Payload Preview</span>
                <span className="text-[10px] text-gray-500">Sender: {smsConfig.senderMask || 'TextLK'} &bull; Recipient: {formattedTestRecipientPreview}</span>
              </div>
              <p className="text-slate-700 leading-relaxed text-[11px] bg-white p-2.5 rounded-lg border border-gray-200/60">
                Samse Auto Mart: Test SMS alert from {stationProfile.stationName}. Gateway is ACTIVE & operational.
              </p>
            </div>

            {/* Test Result Banner */}
            {testResult && (
              <div className={`p-4 rounded-xl text-xs space-y-2.5 animate-fade-in border ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold block text-sm">
                        {testResult.success ? 'SMS Dispatch Processed' : 'SMS Dispatch Failed'}
                      </span>
                      {testResult.httpStatus && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          testResult.httpStatus === 200 
                            ? 'bg-emerald-200/80 text-emerald-900' 
                            : 'bg-rose-200/80 text-rose-900'
                        }`}>
                          HTTP {testResult.httpStatus} {testResult.httpStatus === 200 ? 'OK' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-95">{testResult.message}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-[10px] pt-1 opacity-90 border-t border-black/5">
                      <span>Recipient: <strong>{testResult.recipientFormatted}</strong></span>
                      <span>&bull;</span>
                      <span>Sender ID: <strong>{testResult.senderUsed}</strong></span>
                      <span>&bull;</span>
                      <span>Msg ID: <strong>{testResult.messageId}</strong></span>
                    </div>

                    {testResult.rawResponse && (
                      <details className="mt-2 text-[10px] bg-white/80 p-2.5 rounded-lg border border-gray-200/80">
                        <summary className="cursor-pointer font-bold text-gray-700 hover:text-gray-900 select-none">
                          View Carrier Raw JSON Response &amp; Headers
                        </summary>
                        <pre className="mt-1.5 p-2 bg-slate-900 text-emerald-400 rounded overflow-x-auto text-[10px] leading-relaxed">
                          {typeof testResult.rawResponse === 'object' 
                            ? JSON.stringify(testResult.rawResponse, null, 2) 
                            : testResult.rawResponse}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: OPERATIONAL & SHIFT RULES */}
      {/* ========================================================================= */}
      {activeSubTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  <span>Station Operational & Shift Guard Rules</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Control meter editing locks, safety thresholds, and tolerance variances</p>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">Audit Safety Guardrails</span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Rule 1: Start Meter Lock */}
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/80">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-sm">Start Meter Edit Lock</span>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    When enabled, opening nozzle meter values are strictly locked once a shift is created or saved. Pumper operators cannot manipulate opening totals.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={operationalRules.lockStartMeter}
                    onChange={(e) => setOperationalRules({ ...operationalRules, lockStartMeter: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Rule 2: Low Stock Threshold */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="font-bold text-slate-900 text-sm">Underground Tank Low Stock Alert Threshold</span>
                  </div>
                  <span className="font-extrabold text-sm text-slate-900 px-2.5 py-1 bg-white border border-gray-200 rounded-lg tabular-nums">
                    {operationalRules.tankLowStockThreshold}%
                  </span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Triggers visual dashboard warnings and emergency SMS dispatches when an underground fuel tank's capacity drops to or below this percentage.
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <span className="text-gray-400 text-[11px]">10%</span>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="5"
                    value={operationalRules.tankLowStockThreshold}
                    onChange={(e) => setOperationalRules({ ...operationalRules, tankLowStockThreshold: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-gray-400 text-[11px]">60%</span>
                </div>
              </div>

              {/* Rule 3 & 4 Grid: Tolerance Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                  <span className="font-bold text-slate-900 block text-xs">
                    Shift Closure Variance Warning Tolerance (Liters)
                  </span>
                  <p className="text-gray-500 text-[11px] leading-relaxed">
                    Warns the supervisor if the difference between pump sales volume and tank physical dip exceeds this volume.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      value={operationalRules.varianceToleranceLiters}
                      onChange={(e) => setOperationalRules({ ...operationalRules, varianceToleranceLiters: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 font-bold text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="font-bold text-gray-500">Liters</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                  <span className="font-bold text-slate-900 block text-xs">
                    Cash Discrepancy Alert Threshold (Rs.)
                  </span>
                  <p className="text-gray-500 text-[11px] leading-relaxed">
                    Highlights shift in red warning when cashier cash shortage exceeds this monetary amount.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="font-bold text-gray-500">Rs.</span>
                    <input
                      type="number"
                      value={operationalRules.cashDiscrepancyToleranceRs}
                      onChange={(e) => setOperationalRules({ ...operationalRules, cashDiscrepancyToleranceRs: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 font-bold text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rule 5: Strict Lubricants Reconcile */}
              <div className="flex items-start justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/80">
                <div className="space-y-1 pr-4">
                  <span className="font-bold text-slate-900 text-sm">Shift Lubricant Bottle Reconcile Gate</span>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Requires pumpers to reconcile all issued engine oil and 2T pouches before a shift can be marked as finalized.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={operationalRules.strictLubricantReconciliation}
                    onChange={(e) => setOperationalRules({ ...operationalRules, strictLubricantReconciliation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSaveRules}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Operational Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DATA MANAGEMENT & SYSTEM HEALTH */}
      {/* ========================================================================= */}
      {activeSubTab === 'data' && (
        <div className="space-y-4">
          {/* Data Backup & Export Controls */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Data Backups & CSV Export</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Download local offline copies of all system ledgers, shifts, and customer balances</p>
              </div>
              <span className="text-[10px] text-gray-400 ">JSON & CSV Standards</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              {/* Backup 1: JSON */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs mb-1">
                    <FileJson className="w-4 h-4" />
                    <span>Complete System Backup</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Full JSON archive of all station data (tanks, shifts, oil storage, customers, credit history, employees, and rules).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Backup (.JSON)</span>
                </button>
              </div>

              {/* Backup 2: Shifts CSV */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs mb-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Shift Sales & Audits</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Formatted spreadsheet containing all historical shift records, supervisor signatures, fuel volumes, and net revenue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportShiftsCSV}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Shifts (.CSV)</span>
                </button>
              </div>

              {/* Backup 3: Customers CSV */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-purple-600 font-bold text-xs mb-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Customer Credit Accounts</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Export customer list with registered vehicle numbers, phone numbers, approved credit limits, and outstanding balances.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCustomersCSV}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Customers (.CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supabase Cloud Connection & Diagnostics */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-[#1C1C1C] text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Supabase Cloud Integration Status</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Real-time database connectivity verification and SQL migration schemas</p>
              </div>
              <button
                type="button"
                onClick={checkSupabaseHealth}
                disabled={checkingConnection}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {checkingConnection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verify Connection</span>
                  </>
                )}
              </button>
            </div>

            {/* Connection Banner */}
            {connectionStatus !== 'idle' && (
              <div className={`p-4 rounded-xl text-xs flex gap-2.5 border ${
                connectionStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                connectionStatus === 'missing_tables' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}>
                {connectionStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
                {(connectionStatus === 'missing_tables' || connectionStatus === 'error') && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block">
                    {connectionStatus === 'success' ? 'Database Cloud Sync Ready!' : 
                     connectionStatus === 'missing_tables' ? 'Tables Require Setup' : 
                     'Connection Error'}
                  </span>
                  <p className="mt-0.5 leading-relaxed">{connectionMessage}</p>
                </div>
              </div>
            )}

            {/* SQL Copy Box */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Database Table Schema (supabase_schema.sql)
                </span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-slate-800 font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  {copiedSQL ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-gray-950 text-emerald-400 text-[11px] leading-normal rounded-xl h-44 overflow-y-auto border border-gray-900 shadow-inner">
                {SUPABASE_SQL}
              </pre>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50/50 border border-rose-200/60 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-rose-700 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Danger Zone: Diagnostic Demo Reset</span>
            </h3>
            <p className="text-xs text-rose-900/80 max-w-2xl leading-relaxed">
              Resetting station data clears all active shifts, custom registered staff, fuel delivery logs, and restores the original sandbox demonstration dataset.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTriggerReset}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Database to Initial Demo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
