/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FuelType = 'Petrol 92' | 'Petrol 95' | 'Auto Diesel' | 'Super Diesel';

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
  status: 'Active' | 'Idle' | 'Maintenance';
}

export interface PumpReading {
  pumpId: string;
  pumpName: string;
  fuelType: FuelType;
  assignedPumperId: string | null; // null if unassigned
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
}

export interface StockDelivery {
  id: string;
  date: string;
  fuelType: FuelType;
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
