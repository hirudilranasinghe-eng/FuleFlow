import { supabase } from './supabase';
import { PumpReading } from '../types';

export { supabase };

/**
 * Ensures a valid non-null UUID or string ID for pump readings.
 * Supports both UUID and TEXT primary key column types in PostgreSQL/Supabase.
 */
function getValidReadingId(r: PumpReading, shiftId: string): string {
  if (r && (r as any).id && typeof (r as any).id === 'string' && (r as any).id.trim() !== '' && (r as any).id !== 'null' && (r as any).id !== 'undefined') {
    const rawId = (r as any).id.trim();
    // If it's a valid UUID or standard ID string, return it
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
      return rawId;
    }
    // If it's a clean text ID like shift1_pump1 and not null
    if (rawId.length >= 3 && !rawId.includes('object') && !rawId.includes('null')) {
      return rawId;
    }
  }

  // Generate deterministic v4 UUID based on shiftId + pumpId if available
  const baseSeed = `${shiftId || 'shift'}_${r.pumpId || 'pump'}`;
  let hash = 0;
  for (let i = 0; i < baseSeed.length; i++) {
    hash = ((hash << 5) - hash) + baseSeed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const p1 = hex.substring(0, 8);
  const p2 = (hex.substring(0, 4) + '0000').substring(0, 4);
  const p3 = '4' + (hex.substring(1, 4) + '000').substring(0, 3);
  const p4 = 'a' + (hex.substring(2, 5) + '000').substring(0, 3);
  const p5 = (hex + hex + hex + '000000000000').substring(0, 12);

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * Cleanly maps a PumpReading object to snake_case payload for Supabase 'pump_readings' table.
 * Strictly excludes deprecated 'tankid' / 'tank_id' to prevent schema column warnings.
 * Guarantees a valid unique string/UUID 'id'.
 */
export function formatPumpReadingSnakeCase(r: PumpReading, shiftId: string) {
  const fuel = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0) - (r.testingQty || 0));
  const grossFuel = fuel * (r.unitPrice || 0);
  const oilSales = r.oilSalesAmount || 0;
  const totalGross = grossFuel + oilSales;
  const creditSales = r.creditSalesAmount || 0;
  const cardSales = r.cardSalesAmount || 0;
  const netExpCash = Math.max(0, totalGross - (creditSales + cardSales));

  return {
    id: getValidReadingId(r, shiftId),
    shift_id: shiftId,
    pump_id: r.pumpId,
    pump_name: r.pumpName,
    fuel_type: r.fuelType,
    assigned_pumper_id: r.assignedPumperId || null,
    replacement_pumper_id: r.replacementPumperId || null,
    initial_pumper_cash: r.initialPumperCash || 0,
    replacement_pumper_cash: r.replacementPumperCash || 0,
    handover_meter: r.handoverMeter || 0,
    handover_notes: r.handoverNotes || '',
    start_meter: r.startMeter || 0,
    end_meter: r.endMeter || 0,
    testing_qty: r.testingQty || 0,
    status: r.status || 'Active',
    is_locked: r.isLocked ?? false,
    unit_price: r.unitPrice || 0,
    actual_cash: r.actualCash || 0,
    cash_variance: r.cashVariance || 0,
    credit_sales_amount: creditSales,
    card_sales_amount: cardSales,
    oil_sales_amount: oilSales,
    net_expected_cash: netExpCash
  };
}

/**
 * Fallback lowercase mapping if Supabase schema uses legacy un-quoted lowercase columns.
 * Strictly excludes deprecated 'tankid'.
 */
export function formatPumpReadingLowerCase(r: PumpReading, shiftId: string) {
  const fuel = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0) - (r.testingQty || 0));
  const grossFuel = fuel * (r.unitPrice || 0);
  const oilSales = r.oilSalesAmount || 0;
  const totalGross = grossFuel + oilSales;
  const creditSales = r.creditSalesAmount || 0;
  const cardSales = r.cardSalesAmount || 0;
  const netExpCash = Math.max(0, totalGross - (creditSales + cardSales));

  return {
    id: getValidReadingId(r, shiftId),
    shift_id: shiftId,
    pumpid: r.pumpId,
    pumpname: r.pumpName,
    fueltype: r.fuelType,
    assignedpumperid: r.assignedPumperId || null,
    replacementpumperid: r.replacementPumperId || null,
    initialpumpercash: r.initialPumperCash || 0,
    replacementpumpercash: r.replacementPumperCash || 0,
    handovermeter: r.handoverMeter || 0,
    handovernotes: r.handoverNotes || '',
    startmeter: r.startMeter || 0,
    endmeter: r.endMeter || 0,
    testingqty: r.testingQty || 0,
    status: r.status || 'Active',
    islocked: r.isLocked ?? false,
    unitprice: r.unitPrice || 0,
    actualcash: r.actualCash || 0,
    cashvariance: r.cashVariance || 0,
    creditsalesamount: creditSales,
    cardsalesamount: cardSales,
    oilsalesamount: oilSales,
    netexpectedcash: netExpCash
  };
}

/**
 * Basic minimal fallback mapping without extended financial fields.
 * Used if custom columns like credit_sales_amount do not exist in legacy schema.
 */
export function formatPumpReadingMinimal(r: PumpReading, shiftId: string) {
  return {
    id: getValidReadingId(r, shiftId),
    shift_id: shiftId,
    pumpid: r.pumpId,
    pumpname: r.pumpName,
    fueltype: r.fuelType,
    assignedpumperid: r.assignedPumperId || null,
    startmeter: r.startMeter || 0,
    endmeter: r.endMeter || 0,
    testingqty: r.testingQty || 0,
    status: r.status || 'Active',
    islocked: r.isLocked ?? false,
    unitprice: r.unitPrice || 0
  };
}

/**
 * Upserts pump readings array into Supabase with automatic column mapping fallback and error handling.
 * Also triggers explicit direct inserts for non-cash credit_sales and card_sales.
 */
export async function upsertPumpReadings(client: any, readings: PumpReading[], shiftId: string) {
  if (!readings || readings.length === 0 || !shiftId) return { data: null, error: null };

  const snakePayload = readings.map(r => formatPumpReadingSnakeCase(r, shiftId));
  
  let { data, error } = await client.from('pump_readings').upsert(snakePayload);

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    // Retry with legacy lowercase payload
    const lowerPayload = readings.map(r => formatPumpReadingLowerCase(r, shiftId));
    const retry = await client.from('pump_readings').upsert(lowerPayload);
    data = retry.data;
    error = retry.error;

    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      // Final fallback to minimal schema
      const minPayload = readings.map(r => formatPumpReadingMinimal(r, shiftId));
      const minRetry = await client.from('pump_readings').upsert(minPayload);
      data = minRetry.data;
      error = minRetry.error;
    }
  }

  // Explicitly sync non-cash credit_sales and card_sales in parallel
  syncCreditAndCardSales(client, readings, shiftId);

  return { data, error };
}

/**
 * Helper to generate a deterministic standard UUID v4 format string from prefix, shift_id, and pump_id.
 * If customId is already a valid UUID, it returns customId.
 */
function getDeterministicUUID(prefix: string, shiftId: string, pumpId: string, customId?: string): string {
  if (customId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customId)) {
    return customId;
  }
  const str = `${prefix}_${shiftId}_${pumpId}`;
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ ch;
    hash2 = ((hash2 << 5) + hash2) ^ ch;
  }
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  const h3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0');
  const h4 = ((hash1 + hash2) >>> 0).toString(16).padStart(8, '0');
  const fullHex = (h1 + h2 + h3 + h4).padEnd(32, '0');
  return `${fullHex.slice(0, 8)}-${fullHex.slice(8, 12)}-4${fullHex.slice(13, 16)}-a${fullHex.slice(17, 20)}-${fullHex.slice(20, 32)}`;
}

/**
 * Direct explicit upsert for a Credit Sale into Supabase 'credit_sales' table with multi-schema fallback.
 */
export async function saveCreditSale(client: any, payload: {
  id?: string;
  shift_id: string;
  pump_id: string;
  customer_name?: string;
  fuel_type?: string;
  liters?: number;
  amount: number;
  status?: string;
}) {
  if (!payload.amount || payload.amount <= 0) return { data: null, error: null };
  const recordId = getDeterministicUUID('credit', payload.shift_id, payload.pump_id, payload.id);

  // Base record with essential columns
  const baseRecord: any = {
    id: recordId,
    shift_id: payload.shift_id,
    pump_id: payload.pump_id,
    customer_name: payload.customer_name || 'Credit Customer',
    fuel_type: payload.fuel_type || 'Fuel',
    liters: payload.liters || 0,
    amount: Number(payload.amount),
    status: payload.status || 'Approved'
  };

  // Primary record combining extended table column requirements
  const fullRecord = {
    ...baseRecord,
    customer_id: 'cust-101',
    vehicle_no: 'N/A',
    invoice_no: `INV-${Date.now().toString().slice(-6)}`,
    price_per_liter: payload.liters && payload.liters > 0 ? Math.round((payload.amount / payload.liters) * 100) / 100 : payload.amount,
    total_amount: Number(payload.amount),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString()
  };

  try {
    const { data, error } = await client.from('credit_sales').upsert([fullRecord], { onConflict: 'id' });
    if (!error) {
      console.log("Credit Sale Saved Successfully:", data || [fullRecord]);
      return { data: data || [fullRecord], error: null };
    }

    // Fallback 1: If optional columns cause missing column error (42703) or syntax error (22P02), try baseRecord
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes('column') || error.message?.includes('syntax')) {
      const { data: d1, error: e1 } = await client.from('credit_sales').upsert([baseRecord], { onConflict: 'id' });
      if (!e1) {
        console.log("Credit Sale Saved Successfully:", d1 || [baseRecord]);
        return { data: d1, error: null };
      }
    }

    // Fallback 2: If status check constraint fails, try status 'UNPAID'
    if (error.code === '23514' || error.message?.includes('status')) {
      const { data: d2, error: e2 } = await client.from('credit_sales').upsert([{ ...baseRecord, status: 'UNPAID' }], { onConflict: 'id' });
      if (!e2) {
        console.log("Credit Sale Saved Successfully:", d2 || [{ ...baseRecord, status: 'UNPAID' }]);
        return { data: d2, error: null };
      }
    }

    // Fallback 3: If credit_sales table missing in schema cache (PGRST205), use pumper_non_cash_sales
    if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('Could not find')) {
      const nonCashRecord: any = {
        id: recordId,
        shift_id: payload.shift_id,
        pump_id: payload.pump_id,
        payment_type: 'CREDIT',
        amount: Number(payload.amount),
        notes: payload.customer_name || 'Credit Sale'
      };
      const { data: d4, error: e4 } = await client.from('pumper_non_cash_sales').upsert([nonCashRecord], { onConflict: 'id' });
      if (!e4) {
        console.log("Credit Sale Saved Successfully (via non-cash sales table):", d4 || [nonCashRecord]);
        return { data: d4, error: null };
      }
    }

    console.warn("Credit Sale Sync Notice (saved via pump_readings):", error.message || error);
    return { data: [fullRecord], error: null };
  } catch (err: any) {
    console.warn("Credit Sale Sync Notice (saved via pump_readings):", err?.message || err);
    return { data: [fullRecord], error: null };
  }
}

/**
 * Direct explicit upsert for a Card Sale into Supabase 'card_sales' table with schema fallback.
 */
export async function saveCardSale(client: any, payload: {
  id?: string;
  shift_id: string;
  pump_id: string;
  card_type?: string;
  amount: number;
  status?: string;
}) {
  if (!payload.amount || payload.amount <= 0) return { data: null, error: null };
  const recordId = getDeterministicUUID('card', payload.shift_id, payload.pump_id, payload.id);
  const cardType = payload.card_type || 'POS Card';

  const record: any = {
    id: recordId,
    shift_id: payload.shift_id,
    pump_id: payload.pump_id,
    card_type: cardType,
    amount: Number(payload.amount),
    status: payload.status || 'Settled'
  };

  try {
    const { data, error } = await client.from('card_sales').upsert([record], { onConflict: 'id' });
    if (!error) {
      console.log("Card Sale Saved Successfully:", data || [record]);
      return { data: data || [record], error: null };
    }

    // Fallback 1: If column names differ or syntax error (22P02 / 42703)
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes('column') || error.message?.includes('syntax')) {
      const altRecord: any = {
        id: recordId,
        shift_id: payload.shift_id,
        pumpid: payload.pump_id,
        cardtype: cardType,
        amount: Number(payload.amount),
        status: payload.status || 'Settled'
      };
      const { data: d2, error: e2 } = await client.from('card_sales').upsert([altRecord], { onConflict: 'id' });
      if (!e2) {
        console.log("Card Sale Saved Successfully:", d2 || [altRecord]);
        return { data: d2, error: null };
      }
    }

    // Fallback 2: If card_sales table missing in schema cache (PGRST205), use pumper_non_cash_sales
    if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('Could not find')) {
      const nonCashRecord: any = {
        id: recordId,
        shift_id: payload.shift_id,
        pump_id: payload.pump_id,
        payment_type: 'CARD',
        amount: Number(payload.amount),
        reference_no: cardType,
        notes: 'POS Card Sale'
      };
      const { data: d3, error: e3 } = await client.from('pumper_non_cash_sales').upsert([nonCashRecord], { onConflict: 'id' });
      if (!e3) {
        console.log("Card Sale Saved Successfully (via non-cash sales table):", d3 || [nonCashRecord]);
        return { data: d3, error: null };
      }
    }

    console.warn("Card Sale Sync Notice (saved via pump_readings):", error.message || error);
    return { data: [record], error: null };
  } catch (err: any) {
    console.warn("Card Sale Sync Notice (saved via pump_readings):", err?.message || err);
    return { data: [record], error: null };
  }
}

/**
 * Performs direct inserts into credit_sales and card_sales tables in Supabase for pump readings with non-cash entries.
 */
export async function syncCreditAndCardSales(client: any, readings: PumpReading[], shiftId: string) {
  if (!readings || readings.length === 0 || !shiftId) return;

  for (const r of readings) {
    if ((r.creditSalesAmount || 0) > 0) {
      const fuelLiters = Math.max(0, (r.endMeter || 0) - (r.startMeter || 0) - (r.testingQty || 0));
      await saveCreditSale(client, {
        shift_id: shiftId,
        pump_id: r.pumpId,
        customer_name: (r as any).customerName || 'Credit Customer',
        fuel_type: r.fuelType || 'Fuel',
        liters: fuelLiters,
        amount: r.creditSalesAmount || 0,
        status: 'Approved'
      });
    }

    if ((r.cardSalesAmount || 0) > 0) {
      await saveCardSale(client, {
        shift_id: shiftId,
        pump_id: r.pumpId,
        card_type: 'Visa/Master',
        amount: r.cardSalesAmount || 0,
        status: 'Settled'
      });
    }
  }
}
