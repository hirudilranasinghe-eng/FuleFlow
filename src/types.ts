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

export interface OilTank {
  id: string;
  name: string; // e.g. "Oil Tank 01", "Barrel Storage 02"
  grade: string; // e.g. "Caltex 20W-50", "Lanka 2T", "Hydraulic 68", "Coolant 50/50"
  capacity: number; // in liters
  currentLevel: number; // in liters
  pricePerLiter: number; // in Rs. per liter
}

export interface PackagedOilItem {
  id: string;
  name: string; // e.g. "Caltex Havoline Super 4T 20W-40"
  category: 'Engine Oil' | '2T/4T Oil' | 'Brake Fluid' | 'Coolant' | 'Gear Oil' | 'Hydraulic' | 'Other';
  grade: string; // e.g. "20W-40", "2T", "DOT 4", "15W-40"
  packageSize: string; // e.g. "1L Bottle", "500ml Bottle", "4L Can", "200ml Pouch"
  currentStock: number; // in bottle/unit count
  minReorderLevel: number; // alert threshold
  unitCost: number; // purchase cost in Rs.
  retailPrice: number; // retail selling price in Rs.
  barcode?: string;
  location?: string; // Shelf or Bay location
}

export interface OilGRNRecord {
  id: string;
  grnNumber: string; // e.g. "GRN-OIL-2026-001"
  date: string;
  supplier: string;
  invoiceNumber: string;
  type: 'bulk' | 'packaged';
  tankId?: string; // If bulk oil
  tankName?: string;
  litersReceived?: number;
  items?: {
    itemId: string;
    itemName: string;
    packageSize: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  totalAmount: number; // in Rs.
  receivedBy: string;
  notes?: string;
}

export interface PumperOilAllocation {
  id: string;
  date: string;
  shiftId?: string;
  shiftName?: string;
  pumperId: string;
  pumperName: string;
  itemId: string;
  itemName: string;
  packageSize: string;
  unitPrice: number; // selling price
  issuedQty: number; // quantity issued
  returnedQty: number; // quantity returned unsold
  soldQty: number; // (issuedQty - returnedQty)
  totalAmount: number; // (soldQty * unitPrice) in Rs.
  status: 'Issued' | 'Returned' | 'Reconciled';
  notes?: string;
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

export interface TankDipEntry {
  tankId: string;
  tankName: string;
  fuelType: string;
  systemVolume: number; // Current calculated Liters in system
  physicalDip: number; // Measured physical dip volume in Liters
  varianceLiters: number; // physicalDip - systemVolume
  variancePercentage: number; // (varianceLiters / systemVolume) * 100
  status: 'Normal' | 'Gain' | 'Loss' | 'Warning';
  notes?: string;
}

export interface DailyDipSession {
  id: string;
  date: string; // e.g. "2026-08-14"
  time: string; // e.g. "08:30"
  shift: string; // e.g. "Morning", "Evening", "Night", "Daily Audit"
  supervisor: string;
  remarks?: string;
  entries: TankDipEntry[];
  totalSystemVolume: number;
  totalPhysicalDip: number;
  totalVarianceLiters: number;
  tanksCount: number;
  createdAt?: string;
}

export interface TankDipLog {
  id: string;
  date: string;
  tankId: string;
  tankName: string;
  fuelType: string;
  openingDip: number;
  closingDip: number;
  bowserReceipts: number;
  pumpSales: number;
  expectedStock: number;
  varianceLiters: number;
  variancePercentage: number;
  recordedBy?: string;
  notes?: string;
}

export interface ReceiptDesignerConfig {
  primaryBrandColor: string; // e.g. '#123d82'
  accentColor: string; // e.g. '#d62828'
  companyName: string;
  tagline: string;
  address: string;
  contactPhone: string;
  email: string;
  dealerCode: string;
  regNo: string;
  logoUrl?: string;
  documentTitle: string; // e.g. 'PURCHASE RECEIPT'
  receiptNoPrefix: string; // e.g. 'PR-2026-'
  defaultRemarks: string;
  signatureLine1Title: string;
  signatureLine1Sub: string;
  signatureLine2Title: string;
  signatureLine2Sub: string;
  signatureLine3Title: string;
  signatureLine3Sub: string;
  footerNote: string;
  footerDisclaimer: string;
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptDesignerConfig = {
  primaryBrandColor: '#123d82',
  accentColor: '#d62828',
  companyName: 'Samse Auto Mart (Pvt) Ltd',
  tagline: 'Quality Fuel, Trusted Service',
  address: 'No. 123, Main Road, Kurunegala, Sri Lanka',
  contactPhone: '+94 37 222 3456',
  email: 'info@samseautomart.lk',
  dealerCode: 'CPC-NW-4491',
  regNo: 'PV-00239108',
  logoUrl: '',
  documentTitle: 'PURCHASE RECEIPT',
  receiptNoPrefix: 'PR-2026-',
  defaultRemarks: 'Underground tank calibration and density quality checks performed before and after decanting. Free water test negative, temperature adjusted dip levels confirmed. Stock automatically reflected in fuel inventory register.',
  signatureLine1Title: 'Prepared By',
  signatureLine1Sub: 'Samse Auto Mart',
  signatureLine2Title: 'Received By',
  signatureLine2Sub: 'Supplier / Bowser Driver',
  signatureLine3Title: 'Authorized By',
  signatureLine3Sub: 'Management & Accounts',
  footerNote: 'This is a computer generated purchase receipt.',
  footerDisclaimer: 'Samse Auto Mart Management System • Verified & Logged Automatically'
};

