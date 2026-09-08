/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building2, User, Wallet, CreditCard, Shield, AlertCircle, Car } from 'lucide-react';
import { Customer, CustomerCategory, CustomerType, CustomerStatus } from '../../types';

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
  const [category, setCategory] = useState<CustomerCategory>('Business');
  const [customerType, setCustomerType] = useState<CustomerType>('Credit');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>(500000);
  const [allowedCreditDays, setAllowedCreditDays] = useState<number>(30);
  const [initialDeposit, setInitialDeposit] = useState<number | ''>(0);
  const [status, setStatus] = useState<CustomerStatus>('Active');
  const [notes, setNotes] = useState('');
  
  // Vehicle plate inputs
  const [vehicleNumbers, setVehicleNumbers] = useState<string[]>([]);
  const [newVehicleInput, setNewVehicleInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Populate when editing or opening
  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setCategory(customerToEdit.category || 'Business');
      setCustomerType(customerToEdit.customerType || 'Credit');
      setPhone(customerToEdit.phone || '');
      setEmail(customerToEdit.email || '');
      setAddress(customerToEdit.address || '');
      setCreditLimit(customerToEdit.creditLimit !== undefined ? customerToEdit.creditLimit : 500000);
      setAllowedCreditDays(customerToEdit.allowedCreditDays || 30);
      setInitialDeposit(customerToEdit.depositBalance || 0);
      setStatus(customerToEdit.status || 'Active');
      setNotes(customerToEdit.notes || '');
      setVehicleNumbers(customerToEdit.vehicleNumbers ? [...customerToEdit.vehicleNumbers] : []);
    } else {
      // Defaults for new customer
      setName('');
      setCategory('Business');
      setCustomerType('Credit');
      setPhone('');
      setEmail('');
      setAddress('');
      setCreditLimit(500000);
      setAllowedCreditDays(30);
      setInitialDeposit(0);
      setStatus('Active');
      setNotes('');
      setVehicleNumbers([]);
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
      setErrorMsg(`Vehicle ${cleanPlate} is already added.`);
      return;
    }
    setVehicleNumbers([...vehicleNumbers, cleanPlate]);
    setNewVehicleInput('');
    setErrorMsg(null);
  };

  const handleRemoveVehicle = (indexToRemove: number) => {
    setVehicleNumbers(vehicleNumbers.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Customer or Business Name is required.');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg('Valid Contact Phone number is required.');
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
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      creditLimit: customerType === 'Credit' ? (Number(creditLimit) || 0) : 0,
      allowedCreditDays: customerType === 'Credit' ? (Number(allowedCreditDays) || 30) : 0,
      currentBalance: customerToEdit ? customerToEdit.currentBalance : 0,
      depositBalance: customerToEdit 
        ? customerToEdit.depositBalance 
        : (customerType === 'Deposit' ? (Number(initialDeposit) || 0) : 0),
      status,
      vehicleNumbers,
      notes: notes.trim() || undefined,
      createdAt: customerToEdit ? customerToEdit.createdAt : nowIso
    };

    onSave(newCustomerObj, customerType === 'Deposit' && !customerToEdit ? (Number(initialDeposit) || 0) : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        id="customer-modal-card" 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-sans">
              {isEdit ? 'Edit Customer Account' : 'Register New Customer Account'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-sans">
              {isEdit ? `Update profile and settings for ${customerToEdit?.name}` : 'Setup commercial credit terms or prepaid advance deposit account'}
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Account Facility Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('Credit')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  customerType === 'Credit'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${customerType === 'Credit' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">Commercial Credit (Postpaid)</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Approved fuel on credit with fixed payment cycles (14/30 days)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCustomerType('Deposit')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  customerType === 'Deposit'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`p-2 rounded-lg ${customerType === 'Deposit' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">Advance Deposit (Prepaid)</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Prepaid customer pool balance deducted per shift dispense</div>
                </div>
              </button>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-3.5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lanka Logistics (Pvt) Ltd"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50/80">
                  <button
                    type="button"
                    onClick={() => setCategory('Business')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      category === 'Business'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-gray-500 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Business
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('Personal')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      category === 'Personal'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-gray-500 hover:text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Personal
                  </button>
                </div>
              </div>
            </div>

            {/* Contact Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +94 77 123 4567"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-mono"
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
                  placeholder="e.g. accounts@company.lk"
                  className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            {/* Physical / Postal Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business / Billing Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 45/2 Baseline Road, Colombo 09"
                className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>
          </div>

          {/* Financial Configuration */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-gray-200/80 space-y-3.5">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-700" />
              {customerType === 'Credit' ? 'Credit Limit & Settlement Terms' : 'Prepaid Deposit Pool Configuration'}
            </div>

            {customerType === 'Credit' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved Credit Limit (Rs.) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="500000"
                      className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Cycle / Allowed Credit Days
                  </label>
                  <select
                    value={allowedCreditDays}
                    onChange={(e) => setAllowedCreditDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                  >
                    <option value={7}>7 Days (Weekly)</option>
                    <option value={14}>14 Days (Bi-weekly)</option>
                    <option value={30}>30 Days (Monthly)</option>
                    <option value={45}>45 Days</option>
                    <option value={60}>60 Days (Commercial)</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!isEdit && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Advance Deposit (Rs.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={initialDeposit}
                        onChange={(e) => setInitialDeposit(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-2 text-xs font-bold text-emerald-600 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Can also be topped up later via the register</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="Active">Active (Dispensing Allowed)</option>
                    <option value="Suspended">Suspended (Blocked from Shifts)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Assigned Vehicle Numbers (License Plates) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Assigned Vehicle Numbers / Fleet License Plates
              </label>
              <span className="text-[11px] text-gray-400 font-mono">{vehicleNumbers.length} linked</span>
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
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Rendered Plate Chips */}
            {vehicleNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {vehicleNumbers.map((plate, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-800 text-xs font-bold font-mono"
                  >
                    <span>{plate}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicle(idx)}
                      className="text-gray-400 hover:text-rose-600 rounded-sm"
                      title={`Remove ${plate}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">
                No vehicle license numbers linked yet. Add plates to auto-verify vehicles during shifts.
              </p>
            )}
          </div>

          {/* Account Status for Edit Mode */}
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="Active">Active (Permitted for Fuel Dispensing)</option>
                <option value="Suspended">Suspended (Temporarily Frozen)</option>
                <option value="Overdue">Overdue (Payment Past Terms)</option>
                <option value="Blocked">Blocked (Credit Limit Exceeded)</option>
              </select>
            </div>
          )}

          {/* Commercial Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Commercial Terms & Internal Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commercial agreement details, contact person, or specific delivery instructions..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
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
            {isEdit ? 'Save Changes' : 'Register Customer Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
