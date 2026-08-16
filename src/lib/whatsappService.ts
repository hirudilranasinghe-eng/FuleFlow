/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shift, Employee, FuelTank, OilTank } from '../types';

/**
 * Normalizes any Sri Lankan or international phone number for WhatsApp wa.me links
 * e.g. "077 123 4567" -> "94771234567"
 *      "+94 77 123 4567" -> "94771234567"
 *      "011 289 4500" -> "94112894500"
 */
export function cleanPhoneNumberForWhatsApp(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Sri Lankan local format: 07x xxx xxxx -> 947x xxx xxxx
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '94' + digits.slice(1);
  } else if ((digits.startsWith('7') || digits.startsWith('1') || digits.startsWith('8')) && digits.length === 9) {
    digits = '94' + digits;
  }
  return digits;
}

/**
 * Returns saved WhatsApp Owner/Manager phone from localStorage or defaults
 */
export function getSavedWhatsAppRecipientPhone(): string {
  try {
    const saved = localStorage.getItem('fuelflow_whatsapp_owner_phone');
    if (saved && saved.trim()) return saved.trim();

    const profileStr = localStorage.getItem('fms_station_profile');
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      if (profile.emergencyHotline) return profile.emergencyHotline;
      if (profile.contactPhone) return profile.contactPhone;
    }

    const smsConfigStr = localStorage.getItem('fms_sms_gateway_config');
    if (smsConfigStr) {
      const smsConfig = JSON.parse(smsConfigStr);
      if (smsConfig.ownerPhones) {
        const first = smsConfig.ownerPhones.split(',')[0].trim();
        if (first) return first;
      }
    }
  } catch (_) {}

  return '+94 77 123 4567';
}

/**
 * Persists WhatsApp Owner/Manager phone to localStorage
 */
export function saveWhatsAppRecipientPhone(phone: string): void {
  try {
    localStorage.setItem('fuelflow_whatsapp_owner_phone', phone.trim());
  } catch (_) {}
}

/**
 * Formats a ready-to-send structured WhatsApp shift closure report
 */
export function generateWhatsAppShiftReport(
  shift: Shift,
  employees: Employee[] = [],
  tanks: FuelTank[] = [],
  _oilTanks: OilTank[] = []
): string {
  const supervisor = employees.find(e => e.id === shift.supervisorId || (shift as any).supervisorid === e.id);
  const supervisorName = supervisor?.name || (shift as any).supervisorName || 'Station Supervisor';
  
  let shiftDate = '';
  if (shift.startTime) {
    try {
      const d = new Date(shift.startTime);
      shiftDate = d.toISOString().slice(0, 10);
    } catch (_) {
      shiftDate = shift.startTime.slice(0, 10);
    }
  } else {
    shiftDate = new Date().toISOString().slice(0, 10);
  }

  const shiftName = shift.name || 'Full Day Shift';

  // Tank price lookup map
  const tankPriceMap = new Map<string, number>();
  tanks.forEach(t => {
    tankPriceMap.set(t.fuelType, t.pricePerLiter || 0);
  });

  const getPrice = (ft: string, unitPrice?: number) => {
    if (unitPrice && unitPrice > 0) return unitPrice;
    return tankPriceMap.get(ft) || 0;
  };

  // Group sales by fuel type
  const fuelSalesSummary: Record<string, { liters: number; amount: number }> = {
    'Petrol 92': { liters: 0, amount: 0 },
    'Petrol 95': { liters: 0, amount: 0 },
    'Auto Diesel': { liters: 0, amount: 0 },
    'Super Diesel': { liters: 0, amount: 0 },
  };

  let totalForecourtOilSales = 0;
  let totalCreditSales = 0;
  let totalCardSales = 0;
  let totalActualCashFromReadings = 0;

  const readings = shift.pumpReadings || [];
  readings.forEach(r => {
    const isOilBay = r.pumpId === 'pump-oil-bay' || r.fuelType === 'Oil & Lubricants' || (r.pumpName && r.pumpName.toLowerCase().includes('oil'));
    if (isOilBay) {
      totalForecourtOilSales += (r.oilSalesAmount || 0);
    } else {
      const soldLiters = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0));
      const netLiters = Math.max(0, soldLiters - (r.testingQty || 0));
      const price = getPrice(r.fuelType, r.unitPrice);
      const fuelRev = netLiters * price;

      if (!fuelSalesSummary[r.fuelType]) {
        fuelSalesSummary[r.fuelType] = { liters: 0, amount: 0 };
      }
      fuelSalesSummary[r.fuelType].liters += netLiters;
      fuelSalesSummary[r.fuelType].amount += fuelRev;
    }

    totalCreditSales += (r.creditSalesAmount || 0);
    totalCardSales += (r.cardSalesAmount || 0);
    totalActualCashFromReadings += (r.actualCash || 0);
  });

  // Calculate gross fuel revenue
  let totalFuelRev = 0;
  Object.values(fuelSalesSummary).forEach(item => {
    totalFuelRev += item.amount;
  });

  let grossSales = totalFuelRev + totalForecourtOilSales;
  if (grossSales === 0 && (shift.totalNetSales || 0) > 0) {
    grossSales = shift.totalNetSales;
  }

  const nonCash = totalCreditSales + totalCardSales;
  const netExpectedCash = Math.max(0, grossSales - nonCash);

  // Actual cash handed over
  let actualCash = totalActualCashFromReadings;
  if (actualCash === 0 && shift.totalPhysicalCash !== undefined && shift.totalPhysicalCash > 0) {
    actualCash = shift.totalPhysicalCash;
  } else if (actualCash === 0 && ((shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0)) > 0) {
    actualCash = (shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0);
  }

  // Variance calculation
  const variance = actualCash - netExpectedCash;
  let varianceText = 'Rs. 0.00 (Balanced)';
  if (variance < -0.01) {
    varianceText = `-Rs. ${Math.abs(variance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Shortage)`;
  } else if (variance > 0.01) {
    varianceText = `+Rs. ${variance.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Excess)`;
  }

  const fmtCurrency = (num: number) => (num || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtLiters = (num: number) => (num || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Format fuel lines
  const fuelLines: string[] = [];
  const standardFuelOrder = ['Petrol 92', 'Petrol 95', 'Auto Diesel', 'Super Diesel'];
  
  standardFuelOrder.forEach(ft => {
    const data = fuelSalesSummary[ft] || { liters: 0, amount: 0 };
    fuelLines.push(`• ${ft}: ${fmtLiters(data.liters)} L (Rs. ${fmtCurrency(data.amount)})`);
  });

  // Any other fuel types
  Object.keys(fuelSalesSummary).forEach(ft => {
    if (!standardFuelOrder.includes(ft)) {
      const data = fuelSalesSummary[ft];
      fuelLines.push(`• ${ft}: ${fmtLiters(data.liters)} L (Rs. ${fmtCurrency(data.amount)})`);
    }
  });

  fuelLines.push(`• Forecourt Bulk Oil: Rs. ${fmtCurrency(totalForecourtOilSales)}`);

  // Format tank status lines
  const tankLines: string[] = [];
  if (tanks && tanks.length > 0) {
    tanks.forEach(t => {
      const pct = t.capacity > 0 ? Math.round((t.currentLevel / t.capacity) * 100) : 0;
      tankLines.push(`• ${t.name}: ${fmtLiters(t.currentLevel)} L (${pct}%)`);
    });
  } else {
    tankLines.push('• All Storage Tanks at Normal Operating Capacity');
  }

  return `----------------------------------------
⛽ *FUELFLOW SHIFT CLOSURE REPORT*
📅 Date: ${shiftDate} | 🕒 Shift: ${shiftName}
👤 Supervisor: ${supervisorName}
----------------------------------------
📊 *SALES & FUEL VOLUME:*
${fuelLines.join('\n')}
----------------------------------------
💰 *FINANCIAL SUMMARY:*
• Gross Sales: Rs. ${fmtCurrency(grossSales)}
• Non-Cash (Card + Credit): Rs. ${fmtCurrency(nonCash)}
• Net Expected Cash: Rs. ${fmtCurrency(netExpectedCash)}
• Handed Over Cash: Rs. ${fmtCurrency(actualCash)}
• Net Cash Variance: ${varianceText}
----------------------------------------
🛢️ *UNDERGROUND TANK STATUS:*
${tankLines.join('\n')}
----------------------------------------`;
}

/**
 * Builds the WhatsApp direct dispatch URL
 */
export function getWhatsAppDispatchUrl(phoneNumber: string, message: string): string {
  const cleanDigits = cleanPhoneNumberForWhatsApp(phoneNumber);
  const encodedMsg = encodeURIComponent(message);

  if (cleanDigits) {
    return `https://wa.me/${cleanDigits}?text=${encodedMsg}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedMsg}`;
}
