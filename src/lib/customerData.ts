/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, CustomerLedgerEntry } from '../types';

/**
 * Initial Sri Lankan commercial and individual fleet customer seed data.
 */
export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-101',
    name: 'Lanka Logistics (Pvt) Ltd',
    category: 'Business',
    phone: '+94 11 234 5678',
    email: 'accounts@lankalogistics.lk',
    address: '45/2 Baseline Road, Colombo 09',
    customerType: 'Credit',
    creditLimit: 750000,
    currentBalance: 312450,
    depositBalance: 0,
    allowedCreditDays: 30,
    status: 'Active',
    vehicleNumbers: ['WP CAB-9821', 'WP GA-4512', 'WP LD-8890', 'WP NC-2234'],
    notes: 'Approved commercial freight account. 30-day payment cycle.',
    createdAt: '2026-06-15T08:30:00.000Z'
  },
  {
    id: 'CUST-102',
    name: 'Senok Mining & Construction',
    category: 'Business',
    phone: '+94 11 489 1200',
    email: 'fleet@senokconstruction.com',
    address: '108 Negombo Road, Peliyagoda',
    customerType: 'Deposit',
    creditLimit: 0,
    currentBalance: 0,
    depositBalance: 485600,
    allowedCreditDays: 0,
    status: 'Active',
    vehicleNumbers: ['WP LX-7711', 'SP NC-3345', 'WP CAB-3011', 'EP QA-9012'],
    notes: 'Prepaid deposit account. Auto-alert when deposit drops below Rs. 100,000.',
    createdAt: '2026-07-01T10:15:00.000Z'
  },
  {
    id: 'CUST-103',
    name: 'Jayawardena Luxury Express',
    category: 'Business',
    phone: '+94 77 789 4433',
    email: 'jayawardena.coaches@gmail.com',
    address: '12 Central Bus Stand Road, Kandy',
    customerType: 'Credit',
    creditLimit: 500000,
    currentBalance: 468200,
    depositBalance: 0,
    allowedCreditDays: 14,
    status: 'Overdue',
    vehicleNumbers: ['CP ND-5566', 'CP ND-5567', 'CP NC-1209'],
    notes: 'Intercity passenger bus fleet. Payment pending for over 18 days.',
    createdAt: '2026-07-10T14:20:00.000Z'
  },
  {
    id: 'CUST-104',
    name: 'Singer Sri Lanka Deliveries',
    category: 'Business',
    phone: '+94 11 540 0400',
    email: 'transport@singersl.com',
    address: '320 Union Place, Colombo 02',
    customerType: 'Credit',
    creditLimit: 1200000,
    currentBalance: 580400,
    depositBalance: 0,
    allowedCreditDays: 45,
    status: 'Active',
    vehicleNumbers: ['WP LD-3040', 'WP LD-3041', 'WP LD-3042', 'WP LD-3043', 'WP GA-6677'],
    notes: 'Islandwide retail distribution fleet. Corporate credit agreement.',
    createdAt: '2026-05-20T09:00:00.000Z'
  },
  {
    id: 'CUST-105',
    name: 'Kurunegala Dairies Transport',
    category: 'Business',
    phone: '+94 37 222 8901',
    email: 'logistics@kdairies.lk',
    address: '88 Dambulla Road, Kurunegala',
    customerType: 'Deposit',
    creditLimit: 0,
    currentBalance: 0,
    depositBalance: 215000,
    allowedCreditDays: 0,
    status: 'Active',
    vehicleNumbers: ['NW LA-4401', 'NW LA-4402', 'NW CAB-7800'],
    notes: 'Refrigerated milk transport tankers. Advance deposit pool.',
    createdAt: '2026-07-18T11:45:00.000Z'
  },
  {
    id: 'CUST-106',
    name: 'Ranjith Perera (Personal Fleet)',
    category: 'Personal',
    phone: '+94 71 456 7890',
    email: 'ranjith.perera88@gmail.com',
    address: '24 Temple Road, Nugegoda',
    customerType: 'Deposit',
    creditLimit: 0,
    currentBalance: 0,
    depositBalance: 65400,
    allowedCreditDays: 0,
    status: 'Active',
    vehicleNumbers: ['WP CAX-1122', 'WP KH-4499'],
    notes: 'Personal family vehicles prepaid fuel wallet.',
    createdAt: '2026-08-01T16:00:00.000Z'
  },
  {
    id: 'CUST-107',
    name: 'Southern Highway Express Tours',
    category: 'Business',
    phone: '+94 91 223 9988',
    email: 'info@southerntours.lk',
    address: '15 Matara Road, Galle',
    customerType: 'Credit',
    creditLimit: 400000,
    currentBalance: 84000,
    depositBalance: 0,
    allowedCreditDays: 30,
    status: 'Active',
    vehicleNumbers: ['SP GA-8810', 'SP GA-8811', 'SP NC-9022'],
    notes: 'Expressway passenger vans.',
    createdAt: '2026-08-05T09:30:00.000Z'
  }
];

/**
 * Initial sample ledger history records for seeded customer accounts.
 */
export const INITIAL_LEDGER_ENTRIES: CustomerLedgerEntry[] = [
  // Lanka Logistics (Credit)
  {
    id: 'LEDGER-001',
    customerId: 'CUST-101',
    customerName: 'Lanka Logistics (Pvt) Ltd',
    transactionDate: '2026-08-10T08:30:00.000Z',
    transactionType: 'INITIAL_DEPOSIT',
    description: 'Account Opening & Approved Credit Facility of Rs. 750,000',
    referenceNo: 'CREDIT-AGR-101',
    debit: 0,
    credit: 0,
    amount: 0,
    runningBalance: 0,
    notes: 'Credit terms 30 days approved by management.',
    createdBy: 'Admin'
  },
  {
    id: 'LEDGER-002',
    customerId: 'CUST-101',
    customerName: 'Lanka Logistics (Pvt) Ltd',
    transactionDate: '2026-08-14T09:15:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Auto Diesel (180.00 L @ Rs. 341.00)',
    referenceNo: 'CHITTY-8841',
    vehicleNo: 'WP CAB-9821',
    fuelType: 'Auto Diesel',
    liters: 180,
    ratePerLiter: 341,
    debit: 61380,
    credit: 0,
    amount: 61380,
    runningBalance: 61380,
    notes: 'Shift Morning - Pumper Nimal',
    createdBy: 'Pumper Nimal'
  },
  {
    id: 'LEDGER-003',
    customerId: 'CUST-101',
    customerName: 'Lanka Logistics (Pvt) Ltd',
    transactionDate: '2026-08-18T16:40:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Super Diesel (250.00 L @ Rs. 368.00)',
    referenceNo: 'CHITTY-8910',
    vehicleNo: 'WP GA-4512',
    fuelType: 'Super Diesel',
    liters: 250,
    ratePerLiter: 368,
    debit: 92000,
    credit: 0,
    amount: 92000,
    runningBalance: 153380,
    notes: 'Shift Evening - Pumper Sunimal',
    createdBy: 'Pumper Sunimal'
  },
  {
    id: 'LEDGER-004',
    customerId: 'CUST-101',
    customerName: 'Lanka Logistics (Pvt) Ltd',
    transactionDate: '2026-08-21T11:20:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Auto Diesel (466.48 L @ Rs. 341.00)',
    referenceNo: 'CHITTY-9055',
    vehicleNo: 'WP LD-8890',
    fuelType: 'Auto Diesel',
    liters: 466.48,
    ratePerLiter: 341,
    debit: 159070,
    credit: 0,
    amount: 159070,
    runningBalance: 312450,
    notes: 'Shift Morning - Pumper Kamal',
    createdBy: 'Pumper Kamal'
  },

  // Senok Mining (Deposit)
  {
    id: 'LEDGER-005',
    customerId: 'CUST-102',
    customerName: 'Senok Mining & Construction',
    transactionDate: '2026-08-01T10:00:00.000Z',
    transactionType: 'DEPOSIT_TOPUP',
    description: 'Advance Deposit Received via Bank Transfer (Commercial Bank #CB-8892)',
    referenceNo: 'REC-DEP-201',
    debit: 0,
    credit: 600000,
    amount: 600000,
    runningBalance: 600000,
    paymentMode: 'Bank Transfer',
    notes: 'Initial deposit top-up for August fleet fueling.',
    createdBy: 'Supervisor'
  },
  {
    id: 'LEDGER-006',
    customerId: 'CUST-102',
    customerName: 'Senok Mining & Construction',
    transactionDate: '2026-08-12T14:30:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Auto Diesel (335.48 L @ Rs. 341.00) deducted from deposit',
    referenceNo: 'CHITTY-8802',
    vehicleNo: 'WP LX-7711',
    fuelType: 'Auto Diesel',
    liters: 335.48,
    ratePerLiter: 341,
    debit: 114400,
    credit: 0,
    amount: 114400,
    runningBalance: 485600,
    notes: 'Deducted from prepaid deposit pool',
    createdBy: 'Pumper Sunil'
  },

  // Jayawardena Luxury (Overdue Credit)
  {
    id: 'LEDGER-007',
    customerId: 'CUST-103',
    customerName: 'Jayawardena Luxury Express',
    transactionDate: '2026-08-02T06:45:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Super Diesel (800.00 L @ Rs. 368.00)',
    referenceNo: 'CHITTY-8711',
    vehicleNo: 'CP ND-5566',
    fuelType: 'Super Diesel',
    liters: 800,
    ratePerLiter: 368,
    debit: 294400,
    credit: 0,
    amount: 294400,
    runningBalance: 294400,
    notes: 'Bus refueling for long-distance Kandy-Jaffna trip',
    createdBy: 'Pumper Nimal'
  },
  {
    id: 'LEDGER-008',
    customerId: 'CUST-103',
    customerName: 'Jayawardena Luxury Express',
    transactionDate: '2026-08-08T19:00:00.000Z',
    transactionType: 'FUEL_DISPENSE',
    description: 'Fuel Dispense - Super Diesel (472.28 L @ Rs. 368.00)',
    referenceNo: 'CHITTY-8799',
    vehicleNo: 'CP ND-5567',
    fuelType: 'Super Diesel',
    liters: 472.28,
    ratePerLiter: 368,
    debit: 173800,
    credit: 0,
    amount: 173800,
    runningBalance: 468200,
    notes: 'Payment term was 14 days; now overdue.',
    createdBy: 'Pumper Sunimal'
  }
];

/**
 * Format currency in Sri Lankan Rupees (Rs.) with standard formatting.
 */
export function formatRs(amount: number): string {
  const val = Number(amount) || 0;
  return `Rs. ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)}`;
}

/**
 * Format liters volume with unit.
 */
export function formatLiters(liters: number): string {
  const val = Number(liters) || 0;
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)} L`;
}

/**
 * Format friendly date and time.
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (_) {
    return isoString;
  }
}

/**
 * Format short date (YYYY-MM-DD).
 */
export function formatDateOnly(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (_) {
    return isoString;
  }
}

/**
 * Generate CSV text for customer directory export.
 */
export function exportCustomersToCSV(customers: Customer[]): void {
  const headers = [
    'Customer ID',
    'Customer Name',
    'Category',
    'Account Type',
    'Phone',
    'Email',
    'Address',
    'Linked Vehicles',
    'Deposit Balance (Rs.)',
    'Credit Limit (Rs.)',
    'Outstanding Credit Balance (Rs.)',
    'Credit Terms (Days)',
    'Status',
    'Created Date'
  ];

  const rows = customers.map(c => [
    `"${c.id}"`,
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${c.category || 'Business'}"`,
    `"${c.customerType}"`,
    `"${c.phone || ''}"`,
    `"${c.email || ''}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    `"${(c.vehicleNumbers || []).join(', ')}"`,
    (c.depositBalance || 0).toFixed(2),
    (c.creditLimit || 0).toFixed(2),
    (c.currentBalance || 0).toFixed(2),
    c.allowedCreditDays || 30,
    `"${c.status}"`,
    `"${c.createdAt || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `FuelFlow_Customers_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate CSV text for customer ledger statement export.
 */
export function exportLedgerToCSV(customer: Customer, entries: CustomerLedgerEntry[]): void {
  const headers = [
    'Date & Time',
    'Transaction Type',
    'Description',
    'Reference No',
    'Vehicle No',
    'Fuel Type',
    'Liters',
    'Rate (Rs./L)',
    'Debit (Rs.)',
    'Credit (Rs.)',
    'Running Balance (Rs.)',
    'Payment Mode',
    'Notes',
    'Recorded By'
  ];

  const rows = entries.map(e => [
    `"${e.transactionDate || ''}"`,
    `"${e.transactionType}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    `"${e.referenceNo || ''}"`,
    `"${e.vehicleNo || ''}"`,
    `"${e.fuelType || ''}"`,
    (e.liters || 0).toFixed(2),
    (e.ratePerLiter || 0).toFixed(2),
    (e.debit || 0).toFixed(2),
    (e.credit || 0).toFixed(2),
    (e.runningBalance || 0).toFixed(2),
    `"${e.paymentMode || ''}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
    `"${e.createdBy || ''}"`
  ]);

  const customerHeader = [
    `Customer Statement: ${customer.name} (${customer.id})`,
    `Account Type: ${customer.customerType}`,
    `Generated On: ${new Date().toLocaleString()}`,
    `Current Balance: ${customer.customerType === 'Deposit' ? 'Deposit Rs. ' + (customer.depositBalance || 0).toFixed(2) : 'Debt Rs. ' + (customer.currentBalance || 0).toFixed(2)}`,
    ''
  ].join('\n');

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(customerHeader + '\n' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `Statement_${customer.id}_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
