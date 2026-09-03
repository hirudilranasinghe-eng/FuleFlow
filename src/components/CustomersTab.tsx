/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Filter, Download, RefreshCw, Users, Wallet, CreditCard, 
  Phone, Mail, MapPin, Building2, User, MoreVertical, Edit2, FileText, 
  Trash2, ArrowUpRight, CheckCircle, AlertCircle, AlertTriangle, ShieldCheck,
  ChevronDown, Check, X, Car, PlusCircle
} from 'lucide-react';
import { Customer, CreditTransaction, CreditPayment, FuelTank, CustomerLedgerEntry, CustomerType, CustomerStatus } from '../types';
import { supabase, saveCustomer, deleteCustomer, saveCustomerLedgerEntry } from '../lib/supabaseClient';
import { formatRs, formatLiters, exportCustomersToCSV } from '../lib/customerData';

import CustomerAddEditModal from './customers/CustomerAddEditModal';
import CustomerPaymentModal from './customers/CustomerPaymentModal';
import CustomerStatementModal from './customers/CustomerStatementModal';
import CustomerAdjustmentModal from './customers/CustomerAdjustmentModal';
import CustomerDeleteModal from './customers/CustomerDeleteModal';

/**
 * Maps raw Supabase customer record into the strongly typed Customer interface.
 */
function mapSupabaseCustomer(c: any): Customer {
  const rawType = (c.customer_type || c.account_type || c.customerType || 'Credit').toString().toLowerCase();
  const customerType: CustomerType = rawType === 'deposit' ? 'Deposit' : 'Credit';

  const rawStatus = (c.status || 'Active').toString();
  const status: CustomerStatus = rawStatus.toLowerCase() === 'overdue' 
    ? 'Overdue' 
    : (rawStatus.toLowerCase() === 'suspended' || rawStatus.toLowerCase() === 'blocked')
    ? 'Suspended'
    : 'Active';

  let vehicleNumbers: string[] = [];
  if (Array.isArray(c.vehicle_numbers)) {
    vehicleNumbers = c.vehicle_numbers;
  } else if (Array.isArray(c.registered_vehicles)) {
    vehicleNumbers = c.registered_vehicles;
  } else if (typeof c.vehicle_numbers === 'string' && c.vehicle_numbers.trim()) {
    vehicleNumbers = c.vehicle_numbers.split(',').map((v: string) => v.trim()).filter(Boolean);
  } else if (typeof c.registered_vehicles === 'string' && c.registered_vehicles.trim()) {
    vehicleNumbers = c.registered_vehicles.split(',').map((v: string) => v.trim()).filter(Boolean);
  }

  return {
    id: c.id,
    name: c.name || '',
    phone: c.phone || c.contact_number || '',
    customerType,
    category: c.category || 'Business',
    email: c.email || '',
    address: c.address || '',
    notes: c.notes || '',
    creditLimit: Number(c.credit_limit !== undefined ? c.credit_limit : c.creditLimit) || 0,
    currentBalance: Number(c.current_balance !== undefined ? c.current_balance : c.currentBalance) || 0,
    depositBalance: Number(c.deposit_balance !== undefined ? c.deposit_balance : (c.initial_deposit !== undefined ? c.initial_deposit : c.depositBalance)) || 0,
    allowedCreditDays: Number(c.allowed_days !== undefined ? c.allowed_days : (c.allowed_credit_days !== undefined ? c.allowed_credit_days : c.allowedCreditDays)) || 30,
    status,
    vehicleNumbers,
    createdAt: c.created_at || new Date().toISOString()
  };
}

interface CustomersTabProps {
  customers?: Customer[];
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
  creditTransactions?: CreditTransaction[];
  setCreditTransactions?: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  payments?: CreditPayment[];
  setPayments?: React.Dispatch<React.SetStateAction<CreditPayment[]>>;
  tanks?: FuelTank[];
}

export default function CustomersTab({
  customers: externalCustomers = [],
  setCustomers: externalSetCustomers,
  creditTransactions = [],
  setCreditTransactions,
  payments = [],
  setPayments,
  tanks = []
}: CustomersTabProps) {
  // Pure live Supabase customer state - strictly empty array initially, zero mock data
  const [internalCustomers, setInternalCustomers] = useState<Customer[]>([]);
  const customers = externalCustomers && externalCustomers.length > 0 ? externalCustomers : internalCustomers;
  const setCustomers = (action: React.SetStateAction<Customer[]>) => {
    setInternalCustomers(action);
    if (externalSetCustomers) {
      externalSetCustomers(action);
    }
  };

  // Ledger transactions state - strictly empty array initially, zero mock data
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'ALL' | 'Deposit' | 'Credit'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Suspended' | 'Overdue'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [adjustmentCustomer, setAdjustmentCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Helper to show brief toast
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch from Supabase and listen for Real-time changes
  const fetchSupabaseData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch customers directly from Supabase
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mappedCustomers = data.map(mapSupabaseCustomer);
        setCustomers(mappedCustomers);
        setIsRealtimeActive(true);
      } else {
        setCustomers([]);
      }

      // 2. Fetch customer ledgers
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('customer_ledgers')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (!ledgerError && ledgerData && ledgerData.length > 0) {
        const mappedLedger: CustomerLedgerEntry[] = ledgerData.map((l: any) => ({
          id: l.id,
          customerId: l.customer_id || l.customerId,
          customerName: l.customer_name || l.customerName || '',
          transactionDate: l.transaction_date || l.transactionDate || l.created_at,
          transactionType: l.transaction_type || l.transactionType,
          description: l.description || '',
          referenceNo: l.reference_no || l.referenceNo || '',
          vehicleNo: l.vehicle_no || l.vehicleNo || '',
          fuelType: l.fuel_type || l.fuelType || '',
          liters: Number(l.liters) || 0,
          ratePerLiter: Number(l.rate_per_liter) || 0,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          amount: Number(l.amount) || 0,
          runningBalance: Number(l.running_balance) || 0,
          paymentMode: l.payment_mode || l.paymentMode,
          notes: l.notes || '',
          createdBy: l.created_by || l.createdBy || 'System',
          createdAt: l.created_at
        }));

        setLedgerEntries(mappedLedger);
      } else {
        setLedgerEntries([]);
      }
    } catch (err) {
      console.warn("Supabase customer sync notice:", err);
      setCustomers([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial fetch and Real-time subscription setup
  useEffect(() => {
    fetchSupabaseData();

    // Setup Supabase real-time channel
    const channel = supabase
      .channel('customers_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload: any) => {
          console.log('Realtime change on customers:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = mapSupabaseCustomer(payload.new);
            setCustomers(prev => {
              const exists = prev.some(c => c.id === updated.id);
              if (exists) {
                return prev.map(c => c.id === updated.id ? updated : c);
              }
              return [updated, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setCustomers(prev => prev.filter(c => c.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_ledgers' },
        (payload: any) => {
          console.log('Realtime change on customer_ledgers:', payload);
          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            const newEntry: CustomerLedgerEntry = {
              id: row.id,
              customerId: row.customer_id,
              customerName: row.customer_name || '',
              transactionDate: row.transaction_date || row.created_at,
              transactionType: row.transaction_type,
              description: row.description || '',
              referenceNo: row.reference_no || '',
              vehicleNo: row.vehicle_no || '',
              fuelType: row.fuel_type || '',
              liters: Number(row.liters) || 0,
              ratePerLiter: Number(row.rate_per_liter) || 0,
              debit: Number(row.debit) || 0,
              credit: Number(row.credit) || 0,
              amount: Number(row.amount) || 0,
              runningBalance: Number(row.running_balance) || 0,
              paymentMode: row.payment_mode,
              notes: row.notes || '',
              createdBy: row.created_by || 'System'
            };

            setLedgerEntries(prev => {
              if (prev.some(e => e.id === newEntry.id)) return prev;
              return [newEntry, ...prev];
            });
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered customers directory list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Account Type filter
      if (accountTypeFilter !== 'ALL' && c.customerType !== accountTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && c.status !== statusFilter) {
        return false;
      }

      // Search Query filter (matches Name, Phone, Email, ID, or Linked Vehicle Numbers)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesEmail = c.email ? c.email.toLowerCase().includes(q) : false;
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesVehicle = c.vehicleNumbers
          ? c.vehicleNumbers.some(v => v.toLowerCase().includes(q))
          : false;

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesId && !matchesVehicle) {
          return false;
        }
      }

      return true;
    });
  }, [customers, accountTypeFilter, statusFilter, searchQuery]);

  // Handle Save / Add / Edit Customer
  const handleSaveCustomer = async (savedCustomer: Customer, initialDepositAmount?: number) => {
    const isExisting = customers.some(c => c.id === savedCustomer.id);
    
    // Update local state optimistically
    setCustomers(prev => {
      if (isExisting) {
        return prev.map(c => c.id === savedCustomer.id ? savedCustomer : c);
      }
      return [savedCustomer, ...prev];
    });

    // If new customer with initial deposit, create an initial ledger record
    if (!isExisting && savedCustomer.customerType === 'Deposit' && initialDepositAmount && initialDepositAmount > 0) {
      const initialEntry: CustomerLedgerEntry = {
        id: `LEDGER-${Date.now().toString().slice(-6)}`,
        customerId: savedCustomer.id,
        customerName: savedCustomer.name,
        transactionDate: new Date().toISOString(),
        transactionType: 'DEPOSIT_TOPUP',
        description: `Initial Advance Deposit Opening Balance`,
        referenceNo: 'INIT-DEP',
        debit: 0,
        credit: initialDepositAmount,
        amount: initialDepositAmount,
        runningBalance: initialDepositAmount,
        paymentMode: 'Cash',
        notes: 'Account opening deposit balance',
        createdBy: 'Supervisor'
      };

      setLedgerEntries(prev => [initialEntry, ...prev]);
      saveCustomerLedgerEntry(supabase, initialEntry);
    } else if (!isExisting && savedCustomer.customerType === 'Credit') {
      const initialEntry: CustomerLedgerEntry = {
        id: `LEDGER-${Date.now().toString().slice(-6)}`,
        customerId: savedCustomer.id,
        customerName: savedCustomer.name,
        transactionDate: new Date().toISOString(),
        transactionType: 'INITIAL_DEPOSIT',
        description: `Approved Commercial Credit Facility of ${formatRs(savedCustomer.creditLimit)} (${savedCustomer.allowedCreditDays} Days)`,
        referenceNo: 'CREDIT-OPEN',
        debit: 0,
        credit: 0,
        amount: 0,
        runningBalance: 0,
        notes: 'Commercial credit account opened',
        createdBy: 'Supervisor'
      };

      setLedgerEntries(prev => [initialEntry, ...prev]);
      saveCustomerLedgerEntry(supabase, initialEntry);
    }

    showToast(
      isExisting 
        ? `Customer "${savedCustomer.name}" updated successfully!` 
        : `Customer "${savedCustomer.name}" registered successfully!`,
      'success'
    );

    // Sync to Supabase
    saveCustomer(supabase, savedCustomer);
  };

  // Handle Recording Top-up Deposit / Receive Payment
  const handleRecordPayment = async (
    targetCustomer: Customer,
    amount: number,
    paymentMode: 'Cash' | 'Cheque' | 'Bank Transfer' | 'Online',
    referenceNo: string,
    transactionDate: string,
    notes?: string
  ) => {
    const isDeposit = targetCustomer.customerType === 'Deposit';
    
    // Calculate new customer balance
    const newDepositBal = isDeposit 
      ? (targetCustomer.depositBalance || 0) + amount 
      : 0;
    
    const newCreditBal = !isDeposit 
      ? Math.max(0, (targetCustomer.currentBalance || 0) - amount)
      : 0;

    const updatedCustomer: Customer = {
      ...targetCustomer,
      depositBalance: newDepositBal,
      currentBalance: newCreditBal,
      // If was overdue and paid in full, return to Active status
      status: (!isDeposit && newCreditBal === 0 && targetCustomer.status === 'Overdue') 
        ? 'Active' 
        : targetCustomer.status
    };

    // Update customer state
    setCustomers(prev => prev.map(c => c.id === targetCustomer.id ? updatedCustomer : c));
    saveCustomer(supabase, updatedCustomer);

    // Create ledger transaction entry
    const ledgerEntry: CustomerLedgerEntry = {
      id: `LEDGER-${Date.now().toString().slice(-6)}`,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
      transactionDate: transactionDate || new Date().toISOString(),
      transactionType: isDeposit ? 'DEPOSIT_TOPUP' : 'CREDIT_PAYMENT',
      description: isDeposit 
        ? `Advance Deposit Top-up via ${paymentMode} (${referenceNo})`
        : `Credit Settlement Payment via ${paymentMode} (${referenceNo})`,
      referenceNo: referenceNo || (isDeposit ? 'DEP-TOPUP' : 'PAY-SETTLE'),
      debit: 0,
      credit: amount,
      amount: amount,
      runningBalance: isDeposit ? newDepositBal : newCreditBal,
      paymentMode,
      notes: notes || `Recorded at cashier counter`,
      createdBy: 'Cashier/Supervisor'
    };

    setLedgerEntries(prev => [ledgerEntry, ...prev]);
    saveCustomerLedgerEntry(supabase, ledgerEntry);

    // If payments prop exists, record in credit payments
    if (setPayments) {
      const newPay: CreditPayment = {
        id: `PAY-${Date.now().toString().slice(-5)}`,
        customerId: targetCustomer.id,
        customerName: targetCustomer.name,
        date: transactionDate,
        amount,
        paymentMethod: paymentMode === 'Cheque' ? 'Cheque' : paymentMode === 'Bank Transfer' ? 'Bank Transfer' : 'Cash',
        referenceNumber: referenceNo,
        notes
      };
      setPayments(prev => [newPay, ...prev]);
    }

    showToast(
      isDeposit
        ? `Deposit top-up of ${formatRs(amount)} credited to ${targetCustomer.name}!`
        : `Payment of ${formatRs(amount)} received from ${targetCustomer.name}!`,
      'success'
    );
  };

  // Handle Manual Ledger Adjustment
  const handleSaveAdjustment = async (
    targetCustomer: Customer,
    adjustmentType: 'DEBIT' | 'CREDIT',
    amount: number,
    reason: string,
    referenceNo?: string
  ) => {
    const isDeposit = targetCustomer.customerType === 'Deposit';
    let newDepositBal = targetCustomer.depositBalance || 0;
    let newCreditBal = targetCustomer.currentBalance || 0;

    if (isDeposit) {
      if (adjustmentType === 'DEBIT') {
        newDepositBal = Math.max(0, newDepositBal - amount);
      } else {
        newDepositBal += amount;
      }
    } else {
      if (adjustmentType === 'DEBIT') {
        newCreditBal += amount;
      } else {
        newCreditBal = Math.max(0, newCreditBal - amount);
      }
    }

    const updatedCustomer: Customer = {
      ...targetCustomer,
      depositBalance: newDepositBal,
      currentBalance: newCreditBal
    };

    setCustomers(prev => prev.map(c => c.id === targetCustomer.id ? updatedCustomer : c));
    saveCustomer(supabase, updatedCustomer);

    const ledgerEntry: CustomerLedgerEntry = {
      id: `LEDGER-${Date.now().toString().slice(-6)}`,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
      transactionDate: new Date().toISOString(),
      transactionType: 'ADJUSTMENT',
      description: `Manual ${adjustmentType} Adjustment: ${reason}`,
      referenceNo: referenceNo || 'ADJ-MANUAL',
      debit: adjustmentType === 'DEBIT' ? amount : 0,
      credit: adjustmentType === 'CREDIT' ? amount : 0,
      amount: amount,
      runningBalance: isDeposit ? newDepositBal : newCreditBal,
      notes: reason,
      createdBy: 'Manager/Supervisor'
    };

    setLedgerEntries(prev => [ledgerEntry, ...prev]);
    saveCustomerLedgerEntry(supabase, ledgerEntry);

    showToast(`Manual ${adjustmentType} adjustment of ${formatRs(amount)} recorded for ${targetCustomer.name}.`, 'info');
  };

  // Handle Customer Deletion
  const handleDeleteCustomer = async (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    const custName = cust?.name || customerId;

    // Immediately update local state
    setCustomers(prev => prev.filter(c => c.id !== customerId));

    // Delete the record directly from Supabase
    try {
      await supabase.from('customers').delete().eq('id', customerId);
    } catch (err) {
      console.error("Supabase customer delete error:", err);
    }

    showToast(`Customer "${custName}" has been deleted from database.`, 'info');
  };

  return (
    <div id="customers-tab" className="space-y-6 pb-12">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-bold animate-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950 text-emerald-200 border-emerald-800/80 shadow-emerald-950/20'
            : toastMessage.type === 'error'
            ? 'bg-rose-950 text-rose-200 border-rose-800/80'
            : 'bg-slate-900 text-slate-100 border-slate-700'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-white ml-2 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header with Actions */}
      <div id="customers-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-sans">
            Customer Accounts & Ledger
          </h1>
          <p className="text-gray-500 text-xs mt-1 font-sans">
            Prepaid advance deposit pools, commercial fleet credit limits, vehicle authorizations & statements
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => exportCustomersToCSV(customers)}
            className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export all customers to CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export</span>
          </button>

          <button
            id="btn-add-new-customer"
            onClick={() => {
              setEditingCustomer(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Customer Directory Filter & Search Controls */}
      <div 
        id="customer-directory-controls"
        className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="customer-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, email, or vehicle plate (e.g. WP CAB-9821)..."
              className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-gray-50/70 hover:bg-gray-50 focus:bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Account Type Tabs */}
            <div className="flex rounded-xl border border-gray-200 bg-gray-50/70 p-0.5">
              <button
                type="button"
                onClick={() => setAccountTypeFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  accountTypeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-slate-900'
                }`}
              >
                All ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setAccountTypeFilter('Deposit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  accountTypeFilter === 'Deposit'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-emerald-700'
                }`}
              >
                <Wallet className="w-3 h-3" />
                Deposit ({customers.filter(c => c.customerType === 'Deposit').length})
              </button>
              <button
                type="button"
                onClick={() => setAccountTypeFilter('Credit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  accountTypeFilter === 'Credit'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-indigo-700'
                }`}
              >
                <CreditCard className="w-3 h-3" />
                Credit ({customers.filter(c => c.customerType === 'Credit').length})
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Suspended">Suspended</option>
              <option value="Overdue">Overdue Accounts</option>
            </select>

            {/* Clear Filters button if filters applied */}
            {(searchQuery || accountTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setAccountTypeFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="p-2 text-gray-400 hover:text-slate-800 hover:bg-gray-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Reset filters"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Customer Register Table */}
      <div 
        id="customer-register-table-container"
        className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Customer / Business</th>
                <th className="py-3.5 px-3">Account Type</th>
                <th className="py-3.5 px-3">Contact</th>
                <th className="py-3.5 px-3">Linked Vehicles</th>
                <th className="py-3.5 px-3 text-right">Deposit / Credit Limit (Rs.)</th>
                <th className="py-3.5 px-3 text-right">Current Balance (Rs.)</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => {
                  const isDeposit = customer.customerType === 'Deposit';
                  const isCredit = customer.customerType === 'Credit';
                  const isOverdue = customer.status === 'Overdue';
                  const isSuspended = customer.status === 'Suspended' || customer.status === 'Blocked';

                  // Credit limit utilization
                  const creditLimit = Number(customer.creditLimit) || 0;
                  const currentBalance = Number(customer.currentBalance) || 0;
                  const creditPercent = creditLimit > 0 ? Math.min(100, (currentBalance / creditLimit) * 100) : 0;

                  return (
                    <tr 
                      key={customer.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isOverdue ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* 1. Customer / Business */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                            customer.category === 'Business' 
                              ? 'bg-slate-100 text-slate-700' 
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {customer.category === 'Business' ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <User className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                              <span>{customer.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                              <span className="font-mono text-gray-400 font-medium">#{customer.id}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-400">{customer.category || 'Business'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Account Type */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isDeposit ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-bold">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            Advance Deposit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-[11px] font-bold">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                            Credit ({customer.allowedCreditDays || 30}D)
                          </span>
                        )}
                      </td>

                      {/* 3. Contact */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5 text-xs">
                          <a 
                            href={`tel:${customer.phone}`}
                            className="font-mono text-slate-800 hover:text-indigo-600 font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-gray-400" />
                            {customer.phone}
                          </a>
                          {customer.email && (
                            <div className="text-[11px] text-gray-500 truncate max-w-[150px] flex items-center gap-1" title={customer.email}>
                              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Linked Vehicles */}
                      <td className="py-3.5 px-3">
                        {customer.vehicleNumbers && customer.vehicleNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {customer.vehicleNumbers.slice(0, 2).map((plate, vIdx) => (
                              <span 
                                key={vIdx}
                                className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-[10px]"
                              >
                                {plate}
                              </span>
                            ))}
                            {customer.vehicleNumbers.length > 2 && (
                              <span 
                                className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 font-bold text-[10px]"
                                title={customer.vehicleNumbers.join(', ')}
                              >
                                +{customer.vehicleNumbers.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">No vehicles</span>
                        )}
                      </td>

                      {/* 5. Deposit / Credit Limit (Rs.) */}
                      <td className="py-3.5 px-3 text-right">
                        {isDeposit ? (
                          <div>
                            <span className="font-mono text-xs text-gray-600 font-bold tabular-nums">
                              Prepaid Pool
                            </span>
                            <span className="block text-[10px] text-gray-400">No debt limit</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                              {formatRs(customer.creditLimit)}
                            </span>
                            <span className="block text-[10px] text-gray-400">
                              Terms: {customer.allowedCreditDays || 30} Days
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Current Balance (Rs.) */}
                      <td className="py-3.5 px-3 text-right">
                        {isDeposit ? (
                          <div>
                            <span className="font-mono text-sm font-extrabold text-emerald-600 tabular-nums">
                              {formatRs(customer.depositBalance)}
                            </span>
                            <span className="block text-[10px] text-emerald-700 font-semibold">
                              Available Pool
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className={`font-mono text-sm font-extrabold tabular-nums ${
                              isOverdue ? 'text-rose-600' : 'text-slate-900'
                            }`}>
                              {formatRs(customer.currentBalance)}
                            </span>
                            
                            {/* Small progress meter for credit utilization */}
                            {creditLimit > 0 && (
                              <div className="w-24 ml-auto mt-1 flex items-center gap-1.5">
                                <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      creditPercent > 90 ? 'bg-rose-500' : creditPercent > 70 ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${creditPercent}%` }}
                                  ></div>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400 font-semibold">{creditPercent.toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {customer.status === 'Active' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                        {customer.status === 'Overdue' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Overdue
                          </span>
                        )}
                        {(customer.status === 'Suspended' || customer.status === 'Blocked') && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-300 text-[10px] font-bold">
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Top-up / Receive Payment button */}
                          <button
                            onClick={() => setPaymentCustomer(customer)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer ${
                              isDeposit 
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                            title={isDeposit ? "Top-up advance deposit pool" : "Receive debt payment"}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isDeposit ? 'Top-up' : 'Pay'}</span>
                          </button>

                          {/* Statement / Ledger */}
                          <button
                            onClick={() => setStatementCustomer(customer)}
                            className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-slate-900 border border-gray-200 transition-colors cursor-pointer"
                            title="View full account ledger & statement"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Edit / Manage */}
                          <button
                            onClick={() => {
                              setEditingCustomer(customer);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-slate-900 border border-gray-200 transition-colors cursor-pointer"
                            title="Edit customer details & vehicles"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingCustomer(customer)}
                            className="p-1.5 rounded-xl bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 transition-colors cursor-pointer"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-slate-900 font-sans">
                        {searchQuery || accountTypeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? "No Matching Customers Found"
                          : "No customer accounts registered yet"}
                      </div>
                      <p className="text-xs text-gray-500 font-sans leading-relaxed">
                        {searchQuery || accountTypeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? "No customer accounts match your search or active filters."
                          : "No customer accounts registered yet. Click '+ Add New Customer' to register credit or prepaid deposit accounts."}
                      </p>
                      <button
                        id="btn-empty-add-customer"
                        onClick={() => {
                          setEditingCustomer(null);
                          setIsAddModalOpen(true);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-slate-800 transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Add New Customer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary Bar */}
        <div className="px-4 py-3 bg-slate-50/70 border-t border-gray-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <span>
            Showing <strong className="text-slate-800">{filteredCustomers.length}</strong> of{' '}
            <strong className="text-slate-800">{customers.length}</strong> registered customer accounts
          </span>
          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="text-emerald-700">
              Total Deposits: {formatRs(customers.reduce((s, c) => s + (c.customerType === 'Deposit' ? (Number(c.depositBalance) || 0) : 0), 0))}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-900">
              Total Outstanding: {formatRs(customers.reduce((s, c) => s + (c.customerType === 'Credit' ? (Number(c.currentBalance) || 0) : 0), 0))}
            </span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Add / Edit Customer Modal */}
      <CustomerAddEditModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        customerToEdit={editingCustomer}
      />

      {/* 2. Top-up Deposit / Receive Payment Modal */}
      <CustomerPaymentModal
        isOpen={!!paymentCustomer}
        onClose={() => setPaymentCustomer(null)}
        customer={paymentCustomer}
        onRecordTransaction={handleRecordPayment}
      />

      {/* 3. Customer Statement / Ledger Modal */}
      <CustomerStatementModal
        isOpen={!!statementCustomer}
        onClose={() => setStatementCustomer(null)}
        customer={statementCustomer}
        ledgerEntries={ledgerEntries}
        onOpenPaymentModal={(c) => {
          setStatementCustomer(null);
          setPaymentCustomer(c);
        }}
        onOpenAdjustmentModal={(c) => {
          setStatementCustomer(null);
          setAdjustmentCustomer(c);
        }}
      />

      {/* 4. Manual Adjustment Modal */}
      <CustomerAdjustmentModal
        isOpen={!!adjustmentCustomer}
        onClose={() => setAdjustmentCustomer(null)}
        customer={adjustmentCustomer}
        onSaveAdjustment={handleSaveAdjustment}
      />

      {/* 5. Safe Customer Deletion Modal */}
      <CustomerDeleteModal
        isOpen={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        customer={deletingCustomer}
        onConfirmDelete={handleDeleteCustomer}
      />
    </div>
  );
}
