/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, Wallet, CreditCard, AlertTriangle, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Customer } from '../../types';
import { formatRs } from '../../lib/customerData';

interface CustomerSummaryCardsProps {
  customers: Customer[];
}

export default function CustomerSummaryCards({ customers }: CustomerSummaryCardsProps) {
  // Calculations
  const activeCustomers = customers.filter(c => c.status === 'Active');
  const depositCustomers = customers.filter(c => c.customerType === 'Deposit');
  const creditCustomers = customers.filter(c => c.customerType === 'Credit');
  
  const totalDepositBalance = customers.reduce((sum, c) => {
    return sum + (c.customerType === 'Deposit' ? (Number(c.depositBalance) || 0) : 0);
  }, 0);

  const totalOutstandingCredit = customers.reduce((sum, c) => {
    return sum + (c.customerType === 'Credit' ? (Number(c.currentBalance) || 0) : 0);
  }, 0);

  const totalCreditLimit = creditCustomers.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0);
  const creditUtilization = totalCreditLimit > 0 ? (totalOutstandingCredit / totalCreditLimit) * 100 : 0;

  const overdueCustomers = customers.filter(c => c.customerType === 'Credit' && (c.status === 'Overdue' || (c.currentBalance > 0 && c.status === 'Blocked')));
  const overdueAmount = overdueCustomers.reduce((sum, c) => sum + (Number(c.currentBalance) || 0), 0);

  return (
    <div id="customer-summary-metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Active Customers */}
      <div 
        id="metric-active-customers" 
        className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Active Customers</span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
            {activeCustomers.length}
          </span>
          <span className="text-xs font-semibold text-gray-400">
            of {customers.length} registered
          </span>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {depositCustomers.length} Deposit
          </span>
          <span className="text-gray-300">•</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            {creditCustomers.length} Credit
          </span>
        </div>
      </div>

      {/* 2. Total Advance Deposits Balance */}
      <div 
        id="metric-advance-deposits" 
        className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Advance Deposits (Prepaid)</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 tracking-tight tabular-nums font-mono">
            {formatRs(totalDepositBalance)}
          </span>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-700 font-medium">
          <span>{depositCustomers.length} Prepaid Fuel Wallets</span>
          <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-semibold">Available</span>
        </div>
      </div>

      {/* 3. Total Outstanding Credit */}
      <div 
        id="metric-outstanding-credit" 
        className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Outstanding Credit (Postpaid)</span>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums font-mono">
            {formatRs(totalOutstandingCredit)}
          </span>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, creditUtilization))}%` }}
              ></div>
            </div>
            <span className="font-semibold text-slate-700">{creditUtilization.toFixed(0)}% limit</span>
          </div>
          <span className="text-[11px] text-gray-400">Limit: {formatRs(totalCreditLimit)}</span>
        </div>
      </div>

      {/* 4. Overdue Credit Accounts */}
      <div 
        id="metric-overdue-credit" 
        className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition-shadow ${
          overdueCustomers.length > 0 
            ? 'bg-rose-50/50 border-rose-200/80 hover:shadow-rose-100' 
            : 'bg-white border-gray-200/80'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            overdueCustomers.length > 0 ? 'text-rose-700' : 'text-gray-500'
          }`}>
            Overdue Credit Accounts
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            overdueCustomers.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-sans ${
            overdueCustomers.length > 0 ? 'text-rose-600' : 'text-slate-900'
          }`}>
            {overdueCustomers.length}
          </span>
          <span className="text-xs font-semibold text-gray-400">
            {overdueCustomers.length === 1 ? 'account past term' : 'accounts past terms'}
          </span>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-rose-100/80 flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">Overdue Balance:</span>
          <span className="font-bold text-rose-600 tabular-nums font-mono">
            {formatRs(overdueAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
