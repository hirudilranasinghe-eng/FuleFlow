/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Wallet, CreditCard, CheckCircle2, ArrowRight, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Customer } from '../../types';
import { formatRs } from '../../lib/customerData';

interface CustomerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onRecordTransaction: (
    customer: Customer,
    amount: number,
    paymentMode: 'Cash' | 'Cheque' | 'Bank Transfer' | 'Online',
    referenceNo: string,
    transactionDate: string,
    notes?: string
  ) => void;
}

export default function CustomerPaymentModal({
  isOpen,
  onClose,
  customer,
  onRecordTransaction
}: CustomerPaymentModalProps) {
  const isDeposit = customer?.customerType === 'Deposit';

  // Form states
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Cheque' | 'Bank Transfer' | 'Online'>('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      if (isDeposit) {
        setAmount('');
        setReferenceNo(`DEP-${Date.now().toString().slice(-5)}`);
      } else {
        // For credit, default to outstanding balance or empty
        setAmount(customer.currentBalance > 0 ? customer.currentBalance : '');
        setReferenceNo(`PAY-${Date.now().toString().slice(-5)}`);
      }
      setPaymentMode('Cash');
      setTransactionDate(new Date().toISOString().slice(0, 16));
      setNotes('');
      setErrorMsg(null);
    }
  }, [customer, isOpen, isDeposit]);

  if (!isOpen || !customer) return null;

  const numAmount = Number(amount) || 0;
  
  // Calculate projected new balance
  const projectedBalance = isDeposit
    ? (customer.depositBalance || 0) + numAmount
    : Math.max(0, (customer.currentBalance || 0) - numAmount);

  const handlePresetAmount = (preset: number) => {
    setAmount(preset);
  };

  const handleSettleFull = () => {
    setAmount(customer.currentBalance || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than Rs. 0.00');
      return;
    }

    onRecordTransaction(
      customer,
      numAmount,
      paymentMode,
      referenceNo.trim() || (isDeposit ? 'DEP-TOPUP' : 'PAY-SETTLE'),
      new Date(transactionDate).toISOString(),
      notes.trim() || undefined
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        id="customer-payment-card" 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDeposit ? 'bg-emerald-50/60 border-emerald-100' : 'bg-indigo-50/60 border-indigo-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isDeposit ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              {isDeposit ? <Wallet className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight font-sans">
                {isDeposit ? 'Top-up Advance Deposit Pool' : 'Receive Credit Debt Payment'}
              </h2>
              <p className="text-xs text-gray-600 font-sans font-medium">
                {customer.name} • <span className="font-mono text-slate-700">{customer.id}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Balance Summary Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-gray-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 font-medium block">
                {isDeposit ? 'Current Prepaid Balance' : 'Outstanding Credit Debt'}
              </span>
              <span className={`text-base font-extrabold font-mono tabular-nums ${
                isDeposit ? 'text-emerald-600' : 'text-slate-900'
              }`}>
                {formatRs(isDeposit ? customer.depositBalance : customer.currentBalance)}
              </span>
            </div>

            {!isDeposit && customer.currentBalance > 0 && (
              <button
                type="button"
                onClick={handleSettleFull}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Pay Full Balance
              </button>
            )}
          </div>

          {/* Amount Field & Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isDeposit ? 'Top-up Deposit Amount (Rs.) *' : 'Payment Settlement Amount (Rs.) *'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">Rs.</span>
              <input
                type="number"
                min="1"
                step="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                autoFocus
                className={`w-full pl-10 pr-4 py-2.5 text-base font-extrabold font-mono rounded-xl border focus:outline-none focus:ring-2 ${
                  isDeposit
                    ? 'text-emerald-700 border-gray-300 focus:ring-emerald-600'
                    : 'text-slate-900 border-gray-300 focus:ring-indigo-600'
                }`}
                required
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[10000, 25000, 50000, 100000, 250000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetAmount(preset)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold font-mono transition-colors cursor-pointer"
                >
                  +{preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Mode / Settlement Channel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Cash', 'Cheque', 'Bank Transfer', 'Online'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                    paymentMode === mode
                      ? isDeposit
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Reference No & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Receipt / Cheque No
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. REC-8801 / CHQ-1049"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Date & Time
              </label>
              <input
                type="datetime-local"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remarks & Payment Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received by supervisor on morning shift"
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Projected Balance Preview Card */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            isDeposit ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-gray-200 text-slate-900'
          }`}>
            <span className="font-semibold">
              {isDeposit ? 'New Available Deposit:' : 'New Outstanding Balance:'}
            </span>
            <span className="text-sm font-extrabold font-mono tabular-nums">
              {formatRs(projectedBalance)}
            </span>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 ${
              isDeposit
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isDeposit ? 'Confirm Deposit Top-up' : 'Record Debt Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
