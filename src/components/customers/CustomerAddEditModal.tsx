/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, CreditCard, Wallet, AlertCircle, Car, CheckCircle2, Circle } from 'lucide-react';
import { Customer, CustomerType, CustomerStatus, CustomerCategory } from '../../types';

interface CustomerAddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer, initialDepositAmount?: number) => void;
  customerToEdit?: Customer | null;
}

export default function CustomerAddEditModal({
  isOpen,
  onClose,
  onSave,
  customerToEdit
}: CustomerAddEditModalProps) {
  const isEdit = !!customerToEdit;

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Credit');
  const [creditLimit, setCreditLimit] = useState<number | ''>(500000);
  const [initialDeposit, setInitialDeposit] = useState<number | ''>(0);
  const [vehicleNumbers, setVehicleNumbers] = useState<string[]>([]);
  const [category, setCategory] = useState<CustomerCategory>('Business');
  const [status, setStatus] = useState<CustomerStatus>('Active');
  const [allowedCreditDays, setAllowedCreditDays] = useState<number>(30);
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [newVehicleInput, setNewVehicleInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Populate form when editing or opening
  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setPhone(customerToEdit.phone || '');
      setEmail(customerToEdit.email || '');
      setCustomerType(customerToEdit.customerType || 'Credit');
      setCreditLimit(customerToEdit.creditLimit !== undefined ? customerToEdit.creditLimit : 500000);
      setInitialDeposit(customerToEdit.depositBalance !== undefined ? customerToEdit.depositBalance : 0);
      setVehicleNumbers(customerToEdit.vehicleNumbers ? [...customerToEdit.vehicleNumbers] : []);
      setCategory(customerToEdit.category || 'Business');
      setStatus(customerToEdit.status || 'Active');
      setAllowedCreditDays(customerToEdit.allowedCreditDays || 30);
      setAddress(customerToEdit.address || '');
      setNotes(customerToEdit.notes || '');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setCustomerType('Credit');
      setCreditLimit(500000);
      setInitialDeposit(0);
      setVehicleNumbers([]);
      setCategory('Business');
      setStatus('Active');
      setAllowedCreditDays(30);
      setAddress('');
      setNotes('');
    }
    setNewVehicleInput('');
    setErrorMsg(null);
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddVehicle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPlate = newVehicleInput.trim().toUpperCase();
    if (!cleanPlate) return;
    if (vehicleNumbers.includes(cleanPlate)) {
      setErrorMsg(`Vehicle ${cleanPlate} is already registered.`);
      return;
    }
    setVehicleNumbers(prev => [...prev, cleanPlate]);
    setNewVehicleInput('');
    setErrorMsg(null);
  };

  const handleRemoveVehicle = (indexToRemove: number) => {
    setVehicleNumbers(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Customer / Business Name is required.');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg('Contact Number is required.');
      return;
    }

    const nowIso = new Date().toISOString();
    const customerId = customerToEdit ? customerToEdit.id : `CUST-${Date.now().toString().slice(-4)}`;

    const newCustomerObj: Customer = {
      id: customerId,
      name: cleanName,
      category,
      customerType,
      phone: cleanPhone,
      email: email && email.trim().length > 0 ? email.trim() : undefined,
      address: address.trim() || undefined,
      creditLimit: customerType === 'Credit' ? (Number(creditLimit) || 0) : 0,
      allowedCreditDays: customerType === 'Credit' ? (Number(allowedCreditDays) || 30) : 0,
      currentBalance: customerToEdit ? customerToEdit.currentBalance : 0,
      depositBalance: customerType === 'Deposit' ? (Number(initialDeposit) || 0) : 0,
      status,
      vehicleNumbers,
      notes: notes.trim() || undefined,
      createdAt: customerToEdit ? customerToEdit.createdAt : nowIso
    };

    onSave(
      newCustomerObj, 
      customerType === 'Deposit' && !customerToEdit ? (Number(initialDeposit) || 0) : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        id="customer-modal-card" 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-sans">
              {isEdit ? 'Edit Customer Account' : 'Register New Customer Account'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-sans">
              {isEdit 
                ? `Update details for ${customerToEdit?.name}` 
                : 'Select account type and enter customer credentials'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Account Type Pill Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Account Type *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCustomerType('Credit')}
                className={`py-3 px-3.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  customerType === 'Credit'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                }`}
              >
                {customerType === 'Credit' ? (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-xs">Credit Customer</div>
                  <div className="text-[10px] text-gray-500 font-medium">Postpaid billing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCustomerType('Deposit')}
                className={`py-3 px-3.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  customerType === 'Deposit'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                }`}
              >
                {customerType === 'Deposit' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-xs">Deposit Customer</div>
                  <div className="text-[10px] text-gray-500 font-medium">Prepaid advance</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Customer / Business Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Business Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lanka Logistics (Pvt) Ltd"
              className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-sans"
              required
            />
          </div>

          {/* 3. Contact Number & Email Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +94 77 123 4567"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. accounts@pggomez.com"
                className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-sans"
              />
            </div>
          </div>

          {/* 4. Conditional Financial Amount */}
          {customerType === 'Credit' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Credit Limit (Rs.) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-sans">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="500000"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-bold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-mono text-slate-900"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEdit ? 'Deposit Balance (Rs.) *' : 'Initial Deposit Amount (Rs.) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-sans">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs font-bold text-emerald-700 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent font-mono"
                  required
                />
              </div>
              {!isEdit && (
                <p className="text-[11px] text-gray-500 mt-1 font-sans">
                  Initial prepaid balance credited to this customer's ledger upon registration.
                </p>
              )}
            </div>
          )}

          {/* 5. Registered Vehicle Numbers */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Registered Vehicle Numbers
              </label>
              <span className="text-[11px] text-gray-400 font-mono">{vehicleNumbers.length} registered</span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Car className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={newVehicleInput}
                  onChange={(e) => setNewVehicleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVehicle();
                    }
                  }}
                  placeholder="e.g. WP CAB-9821, CP ND-5566"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddVehicle()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Vehicle Number Chips */}
            {vehicleNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {vehicleNumbers.map((plate, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-800 text-xs font-bold font-mono"
                  >
                    <span>{plate}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicle(idx)}
                      className="text-gray-400 hover:text-rose-600 rounded-sm cursor-pointer"
                      title={`Remove ${plate}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic font-sans">
                Optional: Add vehicle license plates for auto-verification during shift dispenses.
              </p>
            )}
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
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isEdit ? 'Save Changes' : 'Register Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

