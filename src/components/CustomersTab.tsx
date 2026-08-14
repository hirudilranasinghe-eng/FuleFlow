/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Customer, CreditTransaction, CreditPayment, FuelTank } from '../types';

interface CustomersTabProps {
  customers?: Customer[];
  setCustomers?: React.Dispatch<React.SetStateAction<Customer[]>>;
  creditTransactions?: CreditTransaction[];
  setCreditTransactions?: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  payments?: CreditPayment[];
  setPayments?: React.Dispatch<React.SetStateAction<CreditPayment[]>>;
  tanks?: FuelTank[];
}

export default function CustomersTab(_props: CustomersTabProps) {
  return (
    <div id="customers-tab" className="space-y-6 pb-12">
      {/* Standard Compact Header */}
      <div id="customers-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
            Customers
          </h1>
          <p className="text-gray-500 text-xs mt-0.5 font-sans">
            Commercial accounts, customer profiles, and ledger management
          </p>
        </div>
      </div>

      {/* Clean Empty Container Ready for Future Implementation */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-2xs">
        <div className="max-w-md mx-auto space-y-2">
          <p className="text-xs text-gray-400 font-medium">Customer management module ready for future implementation.</p>
        </div>
      </div>
    </div>
  );
}
