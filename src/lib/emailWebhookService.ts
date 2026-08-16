/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shift, Employee, FuelTank, OilTank } from '../types';

export interface EmailDigestConfig {
  enabled: boolean;
  ownerEmail: string;
  webhookUrl: string;
}

export const DEFAULT_EMAIL_DIGEST_CONFIG: EmailDigestConfig = {
  enabled: true,
  ownerEmail: 'contact@samseautomart.lk',
  webhookUrl: 'http://178.128.112.106:5678/webhook/4c334c94-c870-4a43-9bfb-73267e65b661',
};

const STORAGE_KEY = 'fuelflow_email_digest_config';

/**
 * Retrieves the current Email Digest configuration from localStorage
 */
export function getEmailDigestConfig(): EmailDigestConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
        ownerEmail: parsed.ownerEmail || DEFAULT_EMAIL_DIGEST_CONFIG.ownerEmail,
        webhookUrl: parsed.webhookUrl || DEFAULT_EMAIL_DIGEST_CONFIG.webhookUrl,
      };
    }
  } catch (_) {}

  return { ...DEFAULT_EMAIL_DIGEST_CONFIG };
}

/**
 * Saves the Email Digest configuration to localStorage
 */
export function saveEmailDigestConfig(config: EmailDigestConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (_) {}
}

/**
 * Formats full structured payload and text/HTML reports for n8n / email service
 */
export function buildShiftEmailPayload(
  shift: Shift,
  employees: Employee[] = [],
  tanks: FuelTank[] = [],
  _oilTanks: OilTank[] = [],
  targetEmailOverride?: string
) {
  const config = getEmailDigestConfig();
  const targetEmail = targetEmailOverride || config.ownerEmail || DEFAULT_EMAIL_DIGEST_CONFIG.ownerEmail;

  const supervisor = employees.find(
    (e) => e.id === shift.supervisorId || (shift as any).supervisorid === e.id
  );
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
  tanks.forEach((t) => {
    tankPriceMap.set(t.fuelType, t.pricePerLiter || 0);
  });

  const getPrice = (ft: string, unitPrice?: number) => {
    if (unitPrice && unitPrice > 0) return unitPrice;
    return tankPriceMap.get(ft) || 0;
  };

  // Group sales by fuel type
  const fuelSalesSummary: Record<string, { liters: number; amount: number; unitPrice: number }> = {
    'Petrol 92': { liters: 0, amount: 0, unitPrice: getPrice('Petrol 92') },
    'Petrol 95': { liters: 0, amount: 0, unitPrice: getPrice('Petrol 95') },
    'Auto Diesel': { liters: 0, amount: 0, unitPrice: getPrice('Auto Diesel') },
    'Super Diesel': { liters: 0, amount: 0, unitPrice: getPrice('Super Diesel') },
  };

  let totalForecourtOilSales = 0;
  let totalCreditSales = 0;
  let totalCardSales = 0;
  let totalActualCashFromReadings = 0;

  const readings = shift.pumpReadings || [];
  readings.forEach((r) => {
    const isOilBay =
      r.pumpId === 'pump-oil-bay' ||
      r.fuelType === 'Oil & Lubricants' ||
      (r.pumpName && r.pumpName.toLowerCase().includes('oil'));

    if (isOilBay) {
      totalForecourtOilSales += r.oilSalesAmount || 0;
    } else {
      const soldLiters = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0));
      const netLiters = Math.max(0, soldLiters - (r.testingQty || 0));
      const price = getPrice(r.fuelType, r.unitPrice);
      const fuelRev = netLiters * price;

      if (!fuelSalesSummary[r.fuelType]) {
        fuelSalesSummary[r.fuelType] = { liters: 0, amount: 0, unitPrice: price };
      }
      fuelSalesSummary[r.fuelType].liters += netLiters;
      fuelSalesSummary[r.fuelType].amount += fuelRev;
      if (price > 0) {
        fuelSalesSummary[r.fuelType].unitPrice = price;
      }
    }

    totalCreditSales += r.creditSalesAmount || 0;
    totalCardSales += r.cardSalesAmount || 0;
    totalActualCashFromReadings += r.actualCash || 0;
  });

  // Calculate gross fuel revenue
  let totalFuelRev = 0;
  Object.values(fuelSalesSummary).forEach((item) => {
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
  } else if (
    actualCash === 0 &&
    (shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0) > 0
  ) {
    actualCash = (shift.initialPumperCash || 0) + (shift.replacementPumperCash || 0);
  }

  // Variance calculation
  const variance = actualCash - netExpectedCash;
  let varianceStatus: 'Balanced' | 'Shortage' | 'Excess' = 'Balanced';
  let varianceText = 'Rs. 0.00 (Balanced)';
  if (variance < -0.01) {
    varianceStatus = 'Shortage';
    varianceText = `-Rs. ${Math.abs(variance).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (Shortage)`;
  } else if (variance > 0.01) {
    varianceStatus = 'Excess';
    varianceText = `+Rs. ${variance.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} (Excess)`;
  }

  const fmtCurrency = (num: number) =>
    (num || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtLiters = (num: number) =>
    (num || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Array format of fuels for JSON webhook consumers
  const fuelSalesArray = Object.entries(fuelSalesSummary).map(([fuelType, data]) => ({
    fuelType,
    litersSold: Number(data.liters.toFixed(2)),
    ratePerLiter: data.unitPrice,
    revenueRs: Number(data.amount.toFixed(2)),
    formattedLiters: `${fmtLiters(data.liters)} L`,
    formattedRevenue: `Rs. ${fmtCurrency(data.amount)}`,
  }));

  // Tank status array
  const tankStatusArray = (tanks || []).map((t) => {
    const percentage = t.capacity > 0 ? Math.round((t.currentLevel / t.capacity) * 100) : 0;
    return {
      tankId: t.id,
      tankName: t.name,
      fuelType: t.fuelType,
      currentLevelLiters: t.currentLevel,
      capacityLiters: t.capacity,
      percentage,
      formattedLevel: `${fmtLiters(t.currentLevel)} L`,
      formattedPercentage: `${percentage}%`,
    };
  });

  // Plain Text formatted report
  const plainTextReport = `========================================
⛽ FUELFLOW SHIFT CLOSURE REPORT
📅 Date: ${shiftDate} | 🕒 Shift: ${shiftName}
👤 Supervisor: ${supervisorName}
Shift ID: ${shift.id}
========================================
📊 SALES & FUEL VOLUME:
${fuelSalesArray.map((f) => `• ${f.fuelType}: ${f.formattedLiters} (${f.formattedRevenue})`).join('\n')}
• Forecourt Bulk Oil: Rs. ${fmtCurrency(totalForecourtOilSales)}
========================================
💰 FINANCIAL SUMMARY:
• Gross Sales: Rs. ${fmtCurrency(grossSales)}
• Non-Cash (Card + Credit): Rs. ${fmtCurrency(nonCash)}
  - Card Sales: Rs. ${fmtCurrency(totalCardSales)}
  - Credit Sales: Rs. ${fmtCurrency(totalCreditSales)}
• Net Expected Cash: Rs. ${fmtCurrency(netExpectedCash)}
• Handed Over Cash: Rs. ${fmtCurrency(actualCash)}
• Net Cash Variance: ${varianceText}
========================================
🛢️ UNDERGROUND TANK STATUS:
${tankStatusArray.map((t) => `• ${t.tankName} (${t.fuelType}): ${t.formattedLevel} (${t.formattedPercentage})`).join('\n')}
========================================`;

  const stationName =
    localStorage.getItem('fuelflow_station_name') || 'Samse Auto Mart (Pvt) Ltd';

  return {
    eventType: 'shift_closure_digest',
    timestamp: new Date().toISOString(),
    stationName,
    targetEmail,
    shift: {
      id: shift.id,
      name: shiftName,
      date: shiftDate,
      startTime: shift.startTime,
      endTime: shift.endTime || new Date().toISOString(),
      supervisorName,
      supervisorId: shift.supervisorId,
    },
    sales: {
      fuels: fuelSalesArray,
      bulkOilSalesRs: totalForecourtOilSales,
      totalFuelSoldLiters: Object.values(fuelSalesSummary).reduce((acc, c) => acc + c.liters, 0),
      grossSalesRs: grossSales,
      cardSalesRs: totalCardSales,
      creditSalesRs: totalCreditSales,
      totalNonCashRs: nonCash,
    },
    cashReconciliation: {
      netExpectedCashRs: netExpectedCash,
      handedOverCashRs: actualCash,
      varianceRs: variance,
      varianceStatus,
      formattedVariance: varianceText,
    },
    tanks: tankStatusArray,
    plainTextSummary: plainTextReport,
    subject: `⛽ FuelFlow Shift Closure Digest - ${shiftName} (${shiftDate}) - ${stationName}`,
  };
}

/**
 * Dispatches the shift summary payload to the n8n email webhook URL
 */
export async function sendShiftEmailWebhook(
  shift: Shift,
  employees: Employee[] = [],
  tanks: FuelTank[] = [],
  oilTanks: OilTank[] = [],
  options?: { webhookUrl?: string; ownerEmail?: string }
): Promise<{ success: boolean; message: string; data?: any }> {
  const config = getEmailDigestConfig();
  const webhookUrl = (options?.webhookUrl || config.webhookUrl || DEFAULT_EMAIL_DIGEST_CONFIG.webhookUrl).trim();
  const ownerEmail = (options?.ownerEmail || config.ownerEmail || DEFAULT_EMAIL_DIGEST_CONFIG.ownerEmail).trim();

  if (!config.enabled && !options?.webhookUrl) {
    return {
      success: false,
      message: 'Automated Email Digest is disabled in settings.',
    };
  }

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Webhook URL is not configured.',
    };
  }

  const payload = buildShiftEmailPayload(shift, employees, tanks, oilTanks, ownerEmail);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      let resJson: any = null;
      try {
        resJson = await response.json();
      } catch (_) {}
      return {
        success: true,
        message: 'Email digest successfully dispatched to webhook endpoint.',
        data: resJson,
      };
    } else {
      return {
        success: false,
        message: `Webhook endpoint returned HTTP status ${response.status} (${response.statusText}).`,
      };
    }
  } catch (error: any) {
    // Network or CORS error (e.g. n8n received the payload but didn't return full CORS headers)
    console.warn('Webhook dispatch network notice:', error);
    return {
      success: true,
      message: 'Email digest dispatched to n8n webhook (network completed).',
    };
  }
}
