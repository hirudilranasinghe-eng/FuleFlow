/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FuelType = 'Petrol 92' | 'Petrol 95' | 'Auto Diesel' | 'Super Diesel' | 'Lanka Ordinary Diesel' | 'Oil & Lubricants';

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

export interface PumpMachine {
  id: string;
  name: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location?: string;
}

export interface Pump {
  id: string;
  name: string;
  fuelType: FuelType;
  tankId: string; // Linked underground storage tank ID (e.g. 'tank-petrol92')
  status: 'Active' | 'Idle' | 'Maintenance';
  machineId?: string; // Linked Dispenser Machine ID (e.g. 'mach-01')
  machineName?: string; // Linked Dispenser Machine Name (e.g. 'Pump Machine 01')
  startMeter?: number; // Configured start meter reading (liters)
}

export interface PumpReading {
  pumpId: string;
  pumpName: string;
  fuelType: FuelType;
  tankId?: string; // Linked underground storage tank ID
  machineId?: string;
  machineName?: string;
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
  actualCash?: number; // Physical cash handed over by pumper
  cashVariance?: number; // (actualCash - netExpectedCash)
  creditSalesAmount?: number; // Credit / Chitty sales amount
  cardSalesAmount?: number; // Card / POS sales amount
  oilSalesAmount?: number; // Engine oil / lubricant sales amount
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

export type CustomerType = 'Cash' | 'Credit' | 'Deposit';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  customerType: CustomerType;
  creditLimit: number; // in Rs.
  currentBalance: number; // in Rs. (Outstanding credit owed)
  depositBalance: number; // in Rs. (Prepaid deposit balance available)
  allowedCreditDays: number; // e.g. 14, 30 days
  address?: string;
  vehicleNumbers?: string[];
  status: 'Active' | 'Blocked' | 'Overdue';
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  date: string; // ISO String
  dueDate: string; // ISO String (Date + allowedCreditDays)
  vehicleNumber: string;
  invoiceNumber: string; // Chitty / Invoice No
  fuelType: FuelType;
  liters: number;
  ratePerLiter: number;
  totalAmount: number; // in Rs.
  paidAmount: number; // in Rs.
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  notes?: string;
}

export interface CreditPayment {
  id: string;
  customerId: string;
  customerName: string;
  date: string; // ISO String
  amount: number; // in Rs.
  paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer';
  referenceNumber: string;
  notes?: string;
}

