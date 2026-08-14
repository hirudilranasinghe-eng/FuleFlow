/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shift, Employee, FuelTank } from '../types';

interface DailySalesTabProps {
  shiftHistory?: Shift[];
  setShiftHistory?: React.Dispatch<React.SetStateAction<Shift[]>>;
  onDeleteShift?: (shiftId: string) => void;
  employees?: Employee[];
  tanks?: FuelTank[];
}

export default function DailySalesTab(_props: DailySalesTabProps) {
  return (
    <div id="daily-sales-tab" className="space-y-6 pb-12">
      {/* Standard Compact Header */}
      <div id="sales-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
            Shift & Daily Sales History
          </h1>
          <p className="text-gray-500 text-xs mt-0.5 font-sans">
            Shift history and daily sales records
          </p>
        </div>
      </div>

      {/* Clean Empty Container Ready for Future Implementation */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-2xs">
        <div className="max-w-md mx-auto space-y-2">
          <p className="text-xs text-gray-400 font-medium">Daily Sales module ready for future implementation.</p>
        </div>
      </div>
    </div>
  );
}
