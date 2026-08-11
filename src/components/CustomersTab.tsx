/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, CreditCard, Plus, Search, DollarSign, AlertTriangle, CheckCircle2, 
  Calendar, FileText, ArrowUpRight, ArrowDownLeft, ShieldAlert, Edit2, 
  Clock, Download, Filter, Fuel, ChevronRight, X, Phone, MapPin, Truck, Check, Wallet
} from 'lucide-react';
import { Customer, CustomerType, CreditTransaction, CreditPayment, FuelType, FuelTank } from '../types';

interface CustomersTabProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  creditTransactions: CreditTransaction[];
  setCreditTransactions: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  payments: CreditPayment[];
  setPayments: React.Dispatch<React.SetStateAction<CreditPayment[]>>;
  tanks: FuelTank[];
}

export default function CustomersTab({
  customers,
  setCustomers,
  creditTransactions,
  setCreditTransactions,
  payments,
  setPayments,
  tanks,
}: CustomersTabProps) {
  // Navigation Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'credit-sales' | 'settlements' | 'overdue'>('directory');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedCustomerIdForStatement, setSelectedCustomerIdForStatement] = useState<string | null>(null);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [isCreditSaleModalOpen, setIsCreditSaleModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Form states - Customer
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerType, setCustomerType] = useState<CustomerType>('Credit');
  const [creditLimit, setCreditLimit] = useState<string>('100000');
  const [depositBalance, setDepositBalance] = useState<string>('0');
  const [allowedCreditDays, setAllowedCreditDays] = useState<string>('14');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [vehicleNumbers, setVehicleNumbers] = useState<string>('');

  // Form states - Record Credit Sale
  const [selectedCustomerIdForSale, setSelectedCustomerIdForSale] = useState<string>('');
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>('Petrol 92');
  const [saleVehicleNumber, setSaleVehicleNumber] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [saleLiters, setSaleLiters] = useState<string>('50');
  const [saleRate, setSaleRate] = useState<string>('355');
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Form states - Record Payment
  const [selectedCustomerIdForPayment, setSelectedCustomerIdForPayment] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Cheque' | 'Bank Transfer'>('Cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Currency & Volume Formatters (Sri Lankan Rs.)
  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)}`;
  };

  const formatLiters = (val: number) => {
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)} L`;
  };

  // Top Level KPI Aggregates
  const kpis = useMemo(() => {
    let totalOutstanding = 0;
    let totalDeposits = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    customers.forEach(c => {
      totalOutstanding += (c.currentBalance || 0);
      totalDeposits += (c.depositBalance || 0);
      if (c.status === 'Overdue' || c.currentBalance > c.creditLimit) {
        overdueCount += 1;
      }
    });

    creditTransactions.forEach(tx => {
      if (tx.status !== 'Paid' && tx.dueDate < todayStr) {
        overdueAmount += (tx.totalAmount - tx.paidAmount);
      }
    });

    return {
      totalOutstanding,
      totalDeposits,
      overdueCount,
      overdueAmount,
      totalCustomers: customers.length,
    };
  }, [customers, creditTransactions]);

  // Filtered Customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        c.name.toLowerCase().includes(query) || 
        c.phone.toLowerCase().includes(query) ||
        (c.vehicleNumbers && c.vehicleNumbers.some(v => v.toLowerCase().includes(query)));
      
      const matchesType = typeFilter === 'all' || c.customerType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [customers, searchQuery, typeFilter]);

  // Filtered Credit Transactions list
  const filteredTransactions = useMemo(() => {
    return creditTransactions.filter(tx => {
      const query = searchQuery.toLowerCase();
      return !searchQuery || 
        tx.customerName.toLowerCase().includes(query) ||
        tx.invoiceNumber.toLowerCase().includes(query) ||
        tx.vehicleNumber.toLowerCase().includes(query);
    });
  }, [creditTransactions, searchQuery]);

  // Overdue Credit Transactions
  const overdueTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return creditTransactions.filter(tx => tx.status !== 'Paid' && tx.dueDate < todayStr);
  }, [creditTransactions]);

  // Open Modal Helpers
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerType('Credit');
    setCreditLimit('100000');
    setDepositBalance('0');
    setAllowedCreditDays('14');
    setCustomerAddress('');
    setVehicleNumbers('');
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerType(c.customerType);
    setCreditLimit(c.creditLimit.toString());
    setDepositBalance(c.depositBalance.toString());
    setAllowedCreditDays(c.allowedCreditDays.toString());
    setCustomerAddress(c.address || '');
    setVehicleNumbers((c.vehicleNumbers || []).join(', '));
    setIsCustomerModalOpen(true);
  };

  const handleOpenCreditSale = (customerId?: string) => {
    const defaultCustId = customerId || (customers.length > 0 ? customers[0].id : '');
    setSelectedCustomerIdForSale(defaultCustId);
    setSelectedFuelType('Petrol 92');
    const p92Tank = tanks.find(t => t.fuelType === 'Petrol 92');
    setSaleRate(p92Tank ? p92Tank.pricePerLiter.toString() : '355');
    setSaleLiters('50');
    setInvoiceNumber(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setSaleVehicleNumber('');
    setSaleNotes('');
    setIsCreditSaleModalOpen(true);
  };

  const handleOpenPayment = (customerId?: string) => {
    const defaultCustId = customerId || (customers.length > 0 ? customers[0].id : '');
    setSelectedCustomerIdForPayment(defaultCustId);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentReference(`PAY-2026-${Math.floor(100 + Math.random() * 900)}`);
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Save Customer Handler
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;

    const vehiclesList = vehicleNumbers.split(',').map(v => v.trim()).filter(Boolean);

    if (editingCustomer) {
      setCustomers(prev => prev.map(c => {
        if (c.id === editingCustomer.id) {
          return {
            ...c,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            customerType,
            creditLimit: parseFloat(creditLimit) || 0,
            depositBalance: parseFloat(depositBalance) || 0,
            allowedCreditDays: parseInt(allowedCreditDays) || 14,
            address: customerAddress.trim(),
            vehicleNumbers: vehiclesList,
          };
        }
        return c;
      }));
    } else {
      const newCust: Customer = {
        id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
        name: customerName.trim(),
        phone: customerPhone.trim(),
        customerType,
        creditLimit: parseFloat(creditLimit) || 0,
        currentBalance: 0,
        depositBalance: parseFloat(depositBalance) || 0,
        allowedCreditDays: parseInt(allowedCreditDays) || 14,
        address: customerAddress.trim(),
        vehicleNumbers: vehiclesList,
        status: 'Active',
        createdAt: new Date().toISOString(),
      };
      setCustomers(prev => [newCust, ...prev]);
    }
    setIsCustomerModalOpen(false);
  };

  // Save Credit Sale Handler
  const handleSaveCreditSale = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === selectedCustomerIdForSale);
    if (!cust) return;

    const litersVal = parseFloat(saleLiters) || 0;
    const rateVal = parseFloat(saleRate) || 0;
    const totalVal = litersVal * rateVal;

    if (litersVal <= 0 || rateVal <= 0) return;

    const now = new Date();
    const dueDateObj = new Date(now.getTime() + (cust.allowedCreditDays || 14) * 86400000);

    const newTx: CreditTransaction = {
      id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: cust.id,
      customerName: cust.name,
      date: now.toISOString(),
      dueDate: dueDateObj.toISOString().split('T')[0],
      vehicleNumber: saleVehicleNumber.trim() || 'WP CAA-1234',
      invoiceNumber: invoiceNumber.trim() || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      fuelType: selectedFuelType,
      liters: litersVal,
      ratePerLiter: rateVal,
      totalAmount: totalVal,
      paidAmount: 0,
      status: 'Unpaid',
      notes: saleNotes.trim(),
    };

    setCreditTransactions(prev => [newTx, ...prev]);

    // Update Customer current balance
    setCustomers(prev => prev.map(c => {
      if (c.id === cust.id) {
        const newBal = c.currentBalance + totalVal;
        const isOver = newBal > c.creditLimit;
        return {
          ...c,
          currentBalance: newBal,
          status: isOver ? 'Overdue' : c.status,
        };
      }
      return c;
    }));

    setIsCreditSaleModalOpen(false);
  };

  // Save Payment Settlement Handler
  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === selectedCustomerIdForPayment);
    if (!cust) return;

    const amt = parseFloat(paymentAmount) || 0;
    if (amt <= 0) return;

    const newPay: CreditPayment = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: cust.id,
      customerName: cust.name,
      date: new Date().toISOString(),
      amount: amt,
      paymentMethod,
      referenceNumber: paymentReference.trim() || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: paymentNotes.trim(),
    };

    setPayments(prev => [newPay, ...prev]);

    // Adjust Customer balance
    setCustomers(prev => prev.map(c => {
      if (c.id === cust.id) {
        if (c.customerType === 'Deposit') {
          return {
            ...c,
            depositBalance: c.depositBalance + amt,
          };
        } else {
          const newBal = Math.max(0, c.currentBalance - amt);
          return {
            ...c,
            currentBalance: newBal,
            status: newBal <= c.creditLimit ? 'Active' : c.status,
          };
        }
      }
      return c;
    }));

    // Auto update transaction payment statuses
    setCreditTransactions(prev => {
      let remainingPayment = amt;
      return prev.map(tx => {
        if (tx.customerId === cust.id && tx.status !== 'Paid' && remainingPayment > 0) {
          const unpaid = tx.totalAmount - tx.paidAmount;
          if (remainingPayment >= unpaid) {
            remainingPayment -= unpaid;
            return { ...tx, paidAmount: tx.totalAmount, status: 'Paid' };
          } else {
            const newPaid = tx.paidAmount + remainingPayment;
            remainingPayment = 0;
            return { ...tx, paidAmount: newPaid, status: 'Partial' };
          }
        }
        return tx;
      });
    });

    setIsPaymentModalOpen(false);
  };

  // Selected Customer Statement Data
  const statementCustomer = useMemo(() => {
    if (!selectedCustomerIdForStatement) return null;
    return customers.find(c => c.id === selectedCustomerIdForStatement) || null;
  }, [customers, selectedCustomerIdForStatement]);

  const statementHistory = useMemo(() => {
    if (!selectedCustomerIdForStatement) return [];
    const txs = creditTransactions
      .filter(tx => tx.customerId === selectedCustomerIdForStatement)
      .map(tx => ({
        type: 'INVOICE' as const,
        id: tx.id,
        date: tx.date,
        docNo: tx.invoiceNumber,
        details: `${tx.fuelType} - ${tx.liters} L @ Rs.${tx.ratePerLiter} (${tx.vehicleNumber})`,
        debit: tx.totalAmount,
        credit: 0,
      }));

    const pays = payments
      .filter(p => p.customerId === selectedCustomerIdForStatement)
      .map(p => ({
        type: 'PAYMENT' as const,
        id: p.id,
        date: p.date,
        docNo: p.referenceNumber,
        details: `Payment (${p.paymentMethod})`,
        debit: 0,
        credit: p.amount,
      }));

    return [...txs, ...pays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedCustomerIdForStatement, creditTransactions, payments]);

  return (
    <div id="customers-tab-container" className="space-y-6 pb-12">
      {/* Top Header */}
      <div id="customers-header" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs tracking-wider uppercase">
            <Users className="w-4 h-4" />
            <span>Commercial Accounts & Ledger Control</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1 tracking-tight">
            Customer & Credit Management
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage commercial client credit limits, fuel chitty sales, payment settlements, and overdue aging ledgers.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            id="btn-add-customer"
            onClick={handleOpenAddCustomer}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer Account</span>
          </button>

          <button
            id="btn-issue-credit"
            onClick={() => handleOpenCreditSale()}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Fuel className="w-4 h-4" />
            <span>Issue Credit Sale</span>
          </button>

          <button
            id="btn-record-settlement"
            onClick={() => handleOpenPayment()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
          >
            <DollarSign className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div id="customers-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Credit */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Total Outstanding Credit</span>
            <span className="text-xl font-black text-gray-900 block mt-1 leading-none">
              {formatCurrency(kpis.totalOutstanding)}
            </span>
            <span className="text-[11px] text-gray-500 mt-1.5 block font-medium">
              Owed by commercial credit clients
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue Credit Amount */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Overdue Outstanding</span>
            <span className="text-xl font-black text-red-600 block mt-1 leading-none">
              {formatCurrency(kpis.overdueAmount)}
            </span>
            <span className="text-[11px] text-red-500 mt-1.5 block font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{kpis.overdueCount} account(s) overdue</span>
            </span>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Prepaid Deposit Balances */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Available Deposits</span>
            <span className="text-xl font-black text-emerald-600 block mt-1 leading-none">
              {formatCurrency(kpis.totalDeposits)}
            </span>
            <span className="text-[11px] text-gray-500 mt-1.5 block font-medium">
              Prepaid advance balances held
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Accounts Registered */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Registered Clients</span>
            <span className="text-xl font-black text-gray-900 block mt-1 leading-none">
              {kpis.totalCustomers} Accounts
            </span>
            <span className="text-[11px] text-gray-500 mt-1.5 block font-medium">
              Active commercial profile directory
            </span>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div id="customers-subtab-navigation" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex flex-wrap gap-2">
        <button
          id="subtab-directory"
          onClick={() => setActiveSubTab('directory')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Directory</span>
        </button>

        <button
          id="subtab-credit-sales"
          onClick={() => setActiveSubTab('credit-sales')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'credit-sales'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>Credit Invoices & Chitty Sales</span>
        </button>

        <button
          id="subtab-settlements"
          onClick={() => setActiveSubTab('settlements')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'settlements'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Payment Settlements</span>
        </button>

        <button
          id="subtab-overdue"
          onClick={() => setActiveSubTab('overdue')}
          className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'overdue'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-red-600 hover:bg-red-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Overdue Alerts ({kpis.overdueCount})</span>
        </button>
      </div>

      {/* SUB-VIEW 1: CUSTOMER DIRECTORY & ACCOUNTS */}
      {activeSubTab === 'directory' && (
        <div id="customer-directory-view" className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  id="search-customer-input"
                  placeholder="Search by company, phone, vehicle no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs font-medium pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Account Type Filter */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                {['all', 'Credit', 'Deposit', 'Cash'].map((t) => (
                  <button
                    key={t}
                    id={`filter-type-${t}`}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-semibold text-gray-500">
              Showing {filteredCustomers.length} Accounts
            </span>
          </div>

          {/* Customer Profiles Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Client / Company Name</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Account Type</th>
                    <th className="py-3.5 px-4 text-right">Credit Limit</th>
                    <th className="py-3.5 px-4 text-right">Current Balance</th>
                    <th className="py-3.5 px-4">Credit Utilization</th>
                    <th className="py-3.5 px-4 text-center">Allowed Days</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 font-medium">
                        No customer accounts found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const utilPercent = c.creditLimit > 0 ? Math.min(100, Math.round((c.currentBalance / c.creditLimit) * 100)) : 0;
                      const isNearLimit = utilPercent >= 85;

                      return (
                        <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                            </div>
                            {c.vehicleNumbers && c.vehicleNumbers.length > 0 && (
                              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                <span>Vehicles: {c.vehicleNumbers.join(', ')}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-gray-700 font-medium">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{c.phone}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                              c.customerType === 'Credit'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : c.customerType === 'Deposit'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {c.customerType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                            {formatCurrency(c.creditLimit)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900">
                            {c.customerType === 'Deposit' ? (
                              <span className="text-emerald-600">{formatCurrency(c.depositBalance)} (Deposit)</span>
                            ) : (
                              <span className={c.currentBalance > c.creditLimit ? 'text-red-600' : 'text-gray-900'}>
                                {formatCurrency(c.currentBalance)}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 min-w-[140px]">
                            {c.customerType === 'Credit' ? (
                              <div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold mb-1">
                                  <span>{utilPercent}% Used</span>
                                  <span>Limit: {formatCurrency(c.creditLimit)}</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isNearLimit ? 'bg-red-500' : utilPercent > 50 ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${utilPercent}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-[11px]">N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                            {c.allowedCreditDays} Days
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                              c.status === 'Overdue' || c.currentBalance > c.creditLimit
                                ? 'bg-red-100 text-red-700'
                                : c.status === 'Blocked'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {c.currentBalance > c.creditLimit ? 'Over Limit' : c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                id={`btn-statement-${c.id}`}
                                onClick={() => setSelectedCustomerIdForStatement(c.id)}
                                title="View Customer Statement"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                id={`btn-sale-${c.id}`}
                                onClick={() => handleOpenCreditSale(c.id)}
                                title="Issue Fuel Sale"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Fuel className="w-4 h-4" />
                              </button>
                              <button
                                id={`btn-payment-${c.id}`}
                                onClick={() => handleOpenPayment(c.id)}
                                title="Record Settlement Payment"
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                id={`btn-edit-${c.id}`}
                                onClick={() => handleOpenEditCustomer(c)}
                                title="Edit Account Details"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CREDIT INVOICES & CHITTY SALES */}
      {activeSubTab === 'credit-sales' && (
        <div id="credit-sales-view" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-emerald-600" />
                <span>Credit Fuel Invoices & Chitty Issuance History</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Detailed record of all fuel dispensed on credit chitties to verified commercial vehicle fleets.
              </p>
            </div>
            <button
              onClick={() => handleOpenCreditSale()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Credit Chitty</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Invoice / Chitty No</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Vehicle Number</th>
                  <th className="py-3.5 px-4">Fuel Product</th>
                  <th className="py-3.5 px-4 text-right">Volume (L)</th>
                  <th className="py-3.5 px-4 text-right">Rate (Rs/L)</th>
                  <th className="py-3.5 px-4 text-right">Total Invoice Value</th>
                  <th className="py-3.5 px-4 text-center">Due Date</th>
                  <th className="py-3.5 px-4 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400 font-medium">
                      No credit sales or fuel chitties recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = tx.status !== 'Paid' && tx.dueDate < todayStr;

                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-blue-600 font-mono">{tx.invoiceNumber}</td>
                        <td className="py-3.5 px-4 text-gray-600 font-medium">
                          {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">{tx.customerName}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800">{tx.vehicleNumber}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">
                            {tx.fuelType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">{tx.liters.toLocaleString()} L</td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-600">Rs. {tx.ratePerLiter}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900">{formatCurrency(tx.totalAmount)}</td>
                        <td className="py-3.5 px-4 text-center font-medium text-gray-700">{tx.dueDate}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            tx.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOverdue
                              ? 'bg-red-100 text-red-800'
                              : tx.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {isOverdue ? 'Overdue' : tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: PAYMENT SETTLEMENTS */}
      {activeSubTab === 'settlements' && (
        <div id="settlements-view" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span>Credit Payment Settlement Ledger</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Audit trail of payments received from commercial clients via Cash, Cheque, or Direct Bank Transfer.
              </p>
            </div>
            <button
              onClick={() => handleOpenPayment()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Settlement</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Payment Ref / Receipt</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4 text-right">Amount Settled</th>
                  <th className="py-3.5 px-4">Notes / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                      No payment settlements recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-purple-600 font-mono">{p.referenceNumber}</td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        {new Date(p.date).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">{p.customerName}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 italic">{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: OVERDUE ALERTS */}
      {activeSubTab === 'overdue' && (
        <div id="overdue-alerts-view" className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">Overdue Commercial Accounts Requiring Action</h3>
                <p className="text-xs text-red-700 mt-0.5">
                  These transactions or accounts have exceeded allowed credit days or breached assigned credit limits.
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-red-700 bg-red-100 px-3 py-1.5 rounded-xl border border-red-200">
              Total Overdue: {formatCurrency(kpis.overdueAmount)}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-red-50/50 text-red-700 font-bold border-b border-red-100 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Invoice No</th>
                    <th className="py-3.5 px-4">Client Name</th>
                    <th className="py-3.5 px-4">Vehicle No</th>
                    <th className="py-3.5 px-4 text-right">Invoice Value</th>
                    <th className="py-3.5 px-4 text-right">Amount Due</th>
                    <th className="py-3.5 px-4 text-center">Due Date</th>
                    <th className="py-3.5 px-4 text-center">Days Overdue</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-emerald-600 font-bold">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                        <span>All customer accounts are currently up to date with zero overdue invoices!</span>
                      </td>
                    </tr>
                  ) : (
                    overdueTransactions.map((tx) => {
                      const today = new Date();
                      const dueDate = new Date(tx.dueDate);
                      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const dueAmt = tx.totalAmount - tx.paidAmount;

                      return (
                        <tr key={tx.id} className="bg-red-50/20 hover:bg-red-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-red-600 font-mono">{tx.invoiceNumber}</td>
                          <td className="py-3.5 px-4 font-bold text-gray-900">{tx.customerName}</td>
                          <td className="py-3.5 px-4 font-medium text-gray-800">{tx.vehicleNumber}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-gray-700">{formatCurrency(tx.totalAmount)}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-red-600">{formatCurrency(dueAmt)}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-red-700">{tx.dueDate}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black rounded text-[11px]">
                              {diffDays} Days Late
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenPayment(tx.customerId)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer"
                            >
                              Settle Now
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CUSTOMER */}
      {isCustomerModalOpen && (
        <div id="modal-customer" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>{editingCustomer ? 'Edit Customer Profile' : 'Add New Customer Account'}</span>
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Company / Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lanka Logistics Ltd"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="0771234567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Account Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Credit">Credit Client</option>
                    <option value="Deposit">Deposit Account</option>
                    <option value="Cash">Cash Client</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100000"
                    value={creditLimit}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Allowed Credit Days</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="14"
                    value={allowedCreditDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAllowedCreditDays(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {customerType === 'Deposit' && (
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Initial Deposit Balance (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={depositBalance}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDepositBalance(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-bold mb-1">Registered Vehicle Numbers (Comma separated)</label>
                <input
                  type="text"
                  placeholder="WP CAA-1234, WP EP-5678"
                  value={vehicleNumbers}
                  onChange={(e) => setVehicleNumbers(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Address / Company Details</label>
                <input
                  type="text"
                  placeholder="e.g. No. 45, Main Street, Colombo 03"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  {editingCustomer ? 'Update Account' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD CREDIT FUEL SALE */}
      {isCreditSaleModalOpen && (
        <div id="modal-credit-sale" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Fuel className="w-5 h-5 text-emerald-600" />
                <span>Issue Credit Sale / Chitty</span>
              </h3>
              <button onClick={() => setIsCreditSaleModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreditSale} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Select Customer Account *</label>
                <select
                  required
                  value={selectedCustomerIdForSale}
                  onChange={(e) => {
                    setSelectedCustomerIdForSale(e.target.value);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — (Bal: Rs.{c.currentBalance.toLocaleString()} / Limit: Rs.{c.creditLimit.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Fuel Product *</label>
                  <select
                    value={selectedFuelType}
                    onChange={(e) => {
                      const ft = e.target.value as FuelType;
                      setSelectedFuelType(ft);
                      const t = tanks.find(tk => tk.fuelType === ft);
                      if (t) setSaleRate(t.pricePerLiter.toString());
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Petrol 92">Petrol 92</option>
                    <option value="Petrol 95">Petrol 95</option>
                    <option value="Auto Diesel">Auto Diesel</option>
                    <option value="Super Diesel">Super Diesel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="e.g. WP CAA-1234"
                    value={saleVehicleNumber}
                    onChange={(e) => setSaleVehicleNumber(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Volume Dispensed (Liters) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={saleLiters}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSaleLiters(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Unit Price (Rs./L) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={saleRate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSaleRate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Invoice / Chitty Number *</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Total Calculation Display */}
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center">
                <span className="font-bold text-emerald-900">Total Invoice Amount:</span>
                <span className="font-black text-lg text-emerald-700 font-mono">
                  {formatCurrency((parseFloat(saleLiters) || 0) * (parseFloat(saleRate) || 0))}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreditSaleModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirm & Issue Chitty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD PAYMENT SETTLEMENT */}
      {isPaymentModalOpen && (
        <div id="modal-payment" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span>Record Settlement Payment</span>
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Select Customer *</label>
                <select
                  required
                  value={selectedCustomerIdForPayment}
                  onChange={(e) => setSelectedCustomerIdForPayment(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Outstanding: Rs. {c.currentBalance.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Amount Settled (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="25000"
                    value={paymentAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Cheque / Reference / Receipt No *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CHQ-882910"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Settlement for July invoices"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Save Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CUSTOMER LEDGER STATEMENT */}
      {selectedCustomerIdForStatement && statementCustomer && (
        <div id="modal-statement" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 space-y-4 printable-area max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Account Statement</span>
                <h3 className="text-xl font-black text-gray-900">{statementCustomer.name}</h3>
                <p className="text-xs text-gray-500">Phone: {statementCustomer.phone} | Address: {statementCustomer.address || 'N/A'}</p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button onClick={() => window.print()} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer">
                  <Download className="w-4 h-4 text-gray-700" />
                </button>
                <button onClick={() => setSelectedCustomerIdForStatement(null)} className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Account Summary */}
            <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl text-xs flex-shrink-0">
              <div>
                <span className="text-gray-500 font-medium block">Credit Limit</span>
                <span className="font-bold text-gray-900 font-mono">{formatCurrency(statementCustomer.creditLimit)}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block">Outstanding Owed</span>
                <span className="font-black text-red-600 font-mono">{formatCurrency(statementCustomer.currentBalance)}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block">Allowed Credit Terms</span>
                <span className="font-bold text-gray-900">{statementCustomer.allowedCreditDays} Days</span>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="overflow-y-auto flex-1 border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Doc Ref</th>
                    <th className="py-2.5 px-3">Transaction Details</th>
                    <th className="py-2.5 px-3 text-right">Debit (Sales)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statementHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400 italic">No ledger transactions recorded yet.</td>
                    </tr>
                  ) : (
                    statementHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-gray-600 font-medium">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{item.docNo}</td>
                        <td className="py-2.5 px-3 text-gray-800">{item.details}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                          {item.debit > 0 ? formatCurrency(item.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                          {item.credit > 0 ? formatCurrency(item.credit) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
