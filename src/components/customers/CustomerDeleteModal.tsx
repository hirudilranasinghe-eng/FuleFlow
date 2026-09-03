/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Customer } from '../../types';
import { formatRs } from '../../lib/customerData';

interface CustomerDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onConfirmDelete: (customerId: string) => void;
}

export default function CustomerDeleteModal({
  isOpen,
  onClose,
  customer,
  onConfirmDelete
}: CustomerDeleteModalProps) {
  if (!isOpen || !customer) return null;

  const hasOutstanding = customer.currentBalance > 0 || customer.depositBalance > 0;

  const handleConfirm = () => {
    onConfirmDelete(customer.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">Delete Customer Account?</h3>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Are you sure you want to permanently delete <strong className="text-slate-900">{customer.name}</strong> ({customer.id})?
              </p>
            </div>
          </div>

          {hasOutstanding && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <span className="font-bold block">Warning: Active Account Balance</span>
              {customer.customerType === 'Deposit' ? (
                <p>This customer has a prepaid deposit balance of <strong>{formatRs(customer.depositBalance)}</strong>.</p>
              ) : (
                <p>This customer has an unpaid credit balance of <strong>{formatRs(customer.currentBalance)}</strong>.</p>
              )}
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            This action will remove the customer profile from the station database. Historical sales receipts and completed shifts will retain audit numbers.
          </p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Customer
          </button>
        </div>
      </div>
    </div>
  );
}
