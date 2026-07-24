/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FuelType = 'Petrol 92' | 'Petrol 95' | 'Auto Diesel' | 'Super Diesel';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarColor?: string;
}

export function resolveUserRole(email?: string, metaRole?: string): { role: 'admin' | 'supervisor'; roleTitle: string } {
  if (metaRole && typeof metaRole === 'string' && metaRole.trim().toLowerCase() === 'admin') {
    return { role: 'admin', roleTitle: 'System Admin' };
  }

  const lowerEmail = (email || '').toLowerCase().trim();
  if (lowerEmail.includes('admin')) {
    return { role: 'admin', roleTitle: 'System Admin' };
  }
  return { role: 'supervisor', roleTitle: 'User' };
}

export interface Employee {
  id: string;
  name: string;
  role: 'Supervisor' | 'Pumper';
  phone: string;
  status: 'Active' | 'On Shift' | 'Off-duty' | 'Suspended';
  avatarColor: string;
}

export interface FuelTank {
  id: string;
  fuelType: FuelType;
  name: string;
  capacity: number; // in liters
  currentLevel: number; // in liters
  pricePerLiter: number; // e.g. Rs. or USD
}

export interface Pump {
  id: string;
  name: string;
  fuelType: FuelType;
  tankId: string; // Linked underground storage tank ID (e.g. 'tank-petrol92')
  status: 'Active' | 'Idle' | 'Maintenance';
}

export interface PumpReading {
  pumpId: string;
  pumpName: string;
  fuelType: FuelType;
  tankId?: string; // Linked underground storage tank ID
  assignedPumperId: string | null; // null if unassigned
  replacementPumperId?: string | null; // Mid-shift replacement pumper
  initialPumperCash?: number; // Cash handed over by initial pumper
  replacementPumperCash?: number; // Cash handed over by replacement pumper
  handoverMeter?: number; // Meter reading at mid-shift handover
  handoverNotes?: string; // Handover notes for mid-shift transfer
  startMeter: number; // in liters
  endMeter: number; // in liters
  testingQty: number; // in liters (testing deduction)
  status: 'Active' | 'Idle' | 'Completed';
  isLocked?: boolean;
  unitPrice?: number;
}

export interface Shift {
  id: string; // e.g. SH-2026-071
  name: string; // e.g. "Morning (06:00 - 14:00)"
  supervisorId: string;
  startTime: string; // e.g. "2026-07-12T06:01:00"
  endTime?: string;
  isActive: boolean;
  pumpReadings: PumpReading[];
  totalFuelSold: number;
  totalNetSold: number;
  totalNetSales: number;
  // Mid-shift handover & cash reconciliation
  initialPumperCash?: number;
  replacementPumperCash?: number;
  totalPhysicalCash?: number;
  cashVariance?: number;
  handoverNotes?: string;
  replacementPumperId?: string;
}

export interface StockDelivery {
  id: string;
  date: string;
  fuelType: FuelType;
  tankId?: string; // Target Storage Tank ID
  tankName?: string; // Target Storage Tank Name
  quantity: number; // in liters
  supplier: string;
  cost: number;
}

export interface PriceSchedule {
  id: string;
  fuelType: FuelType;
  newPrice: number;
  effectiveDate: string; // ISO string
  status: 'Pending' | 'Applied' | 'Cancelled';
}
