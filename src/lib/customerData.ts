/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, CustomerLedgerEntry } from '../types';

/**
 * Customer records initial state (pure Supabase integration - no mock data).
 */
export const INITIAL_CUSTOMERS: Customer[] = [];

/**
 * Customer ledger records initial state (pure Supabase integration - no mock data).
 */
export const INITIAL_LEDGER_ENTRIES: CustomerLedgerEntry[] = [];

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

/**
 * Inserts or saves a customer to Supabase with explicitly mapped email and contact fields.
 */
export async function saveCustomerToSupabase(supabase: any, data: any) {
  const newCustomerRecord = {
    name: data.name.trim(),
    contact_number: data.contact_number || data.contactNumber || data.phone || '',
    phone: data.contact_number || data.contactNumber || data.phone || '',
    email: data.email && data.email.trim().length > 0 ? data.email.trim() : null,
    account_type: data.account_type || data.accountType || 'credit',
    credit_limit: data.account_type === 'credit' || data.accountType === 'Credit' || data.customerType === 'Credit' ? Number(data.credit_limit || data.creditLimit || 0) : 0,
    initial_deposit: data.account_type === 'deposit' || data.accountType === 'Deposit' || data.customerType === 'Deposit' ? Number(data.initial_deposit || data.initialDeposit || 0) : 0,
    current_balance: data.account_type === 'deposit' || data.accountType === 'Deposit' || data.customerType === 'Deposit' ? Number(data.initial_deposit || data.initialDeposit || 0) : 0,
    registered_vehicles: data.registered_vehicles || data.vehicle_numbers || data.vehicleNumbers || [],
    status: 'active'
  };

  const { data: inserted, error } = await supabase
    .from('customers')
    .insert([newCustomerRecord])
    .select()
    .single();

  if (error) {
    console.error("Supabase customer insert error:", error);
  }

  return { data: inserted, error };
}

