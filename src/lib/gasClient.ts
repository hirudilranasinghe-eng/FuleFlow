import { supabase } from './supabase';
import { GasInventoryItem, GasPurchaseRecord, GasSaleRecord, GasBrand, GasCylinderSize } from '../types';

/**
 * Standard Sri Lankan LP Gas initial inventory items for Litro and Laugfs Gas
 */
export const DEFAULT_GAS_INVENTORY: GasInventoryItem[] = [
  // Litro Gas Lanka
  {
    id: 'litro-12.5',
    brand: 'Litro',
    cylinderSize: '12.5 kg Regular',
    sizeKg: 12.5,
    stockFull: 35,
    stockEmpty: 18,
    buyingPrice: 3520,
    refillSellingPrice: 3690,
    packageSellingPrice: 14500,
    minAlertThreshold: 10
  },
  {
    id: 'litro-5',
    brand: 'Litro',
    cylinderSize: '5 kg Baby',
    sizeKg: 5,
    stockFull: 22,
    stockEmpty: 12,
    buyingPrice: 1410,
    refillSellingPrice: 1482,
    packageSellingPrice: 7800,
    minAlertThreshold: 5
  },
  {
    id: 'litro-2.3',
    brand: 'Litro',
    cylinderSize: '2.3 kg Mini',
    sizeKg: 2.3,
    stockFull: 16,
    stockEmpty: 9,
    buyingPrice: 645,
    refillSellingPrice: 694,
    packageSellingPrice: 4500,
    minAlertThreshold: 5
  },
  {
    id: 'litro-37.5',
    brand: 'Litro',
    cylinderSize: '37.5 kg Industrial',
    sizeKg: 37.5,
    stockFull: 8,
    stockEmpty: 4,
    buyingPrice: 10600,
    refillSellingPrice: 11100,
    packageSellingPrice: 38000,
    minAlertThreshold: 3
  },

  // Laugfs Gas PLC
  {
    id: 'laugfs-12.5',
    brand: 'Laugfs',
    cylinderSize: '12.5 kg Regular',
    sizeKg: 12.5,
    stockFull: 25,
    stockEmpty: 14,
    buyingPrice: 3520,
    refillSellingPrice: 3690,
    packageSellingPrice: 14500,
    minAlertThreshold: 10
  },
  {
    id: 'laugfs-5',
    brand: 'Laugfs',
    cylinderSize: '5 kg Baby',
    sizeKg: 5,
    stockFull: 18,
    stockEmpty: 8,
    buyingPrice: 1410,
    refillSellingPrice: 1482,
    packageSellingPrice: 7800,
    minAlertThreshold: 5
  },
  {
    id: 'laugfs-2.3',
    brand: 'Laugfs',
    cylinderSize: '2.3 kg Mini',
    sizeKg: 2.3,
    stockFull: 12,
    stockEmpty: 6,
    buyingPrice: 645,
    refillSellingPrice: 694,
    packageSellingPrice: 4500,
    minAlertThreshold: 5
  },
  {
    id: 'laugfs-37.5',
    brand: 'Laugfs',
    cylinderSize: '37.5 kg Industrial',
    sizeKg: 37.5,
    stockFull: 6,
    stockEmpty: 3,
    buyingPrice: 10600,
    refillSellingPrice: 11100,
    packageSellingPrice: 38000,
    minAlertThreshold: 3
  }
];

export function formatRs(val: number): string {
  return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatRsPlain(val: number): string {
  return `Rs. ${(val || 0).toLocaleString('en-LK')}`;
}

/**
 * Normalizes raw Supabase row to GasInventoryItem
 */
export function mapGasInventory(raw: any): GasInventoryItem {
  const brand: GasBrand = (raw.brand || '').toLowerCase().includes('laugfs') ? 'Laugfs' : 'Litro';
  let size: GasCylinderSize = '12.5 kg Regular';
  const sizeRaw = (raw.cylinder_size || raw.cylindersize || raw.size || '').toString().toLowerCase();
  const sizeKgRaw = Number(raw.size_kg || raw.sizekg) || 0;

  if (sizeRaw.includes('5 kg') || sizeRaw.includes('baby') || sizeKgRaw === 5) {
    size = '5 kg Baby';
  } else if (sizeRaw.includes('2.3') || sizeRaw.includes('mini') || sizeKgRaw === 2.3) {
    size = '2.3 kg Mini';
  } else if (sizeRaw.includes('37.5') || sizeRaw.includes('industrial') || sizeKgRaw === 37.5) {
    size = '37.5 kg Industrial';
  }

  const sizeKg = size === '5 kg Baby' ? 5 : size === '2.3 kg Mini' ? 2.3 : size === '37.5 kg Industrial' ? 37.5 : 12.5;

  return {
    id: raw.id || `${brand.toLowerCase()}-${sizeKg}`,
    brand,
    cylinderSize: size,
    sizeKg,
    stockFull: Number(raw.stock_full ?? raw.stockfull ?? raw.full_stock ?? raw.full_cylinders ?? 0),
    stockEmpty: Number(raw.stock_empty ?? raw.stockempty ?? raw.empty_stock ?? raw.empty_cylinders ?? 0),
    buyingPrice: Number(raw.buying_price ?? raw.buyingprice ?? raw.cost_price ?? raw.unit_cost ?? 0),
    refillSellingPrice: Number(raw.refill_selling_price ?? raw.refillprice ?? raw.refill_price ?? raw.selling_price ?? 0),
    packageSellingPrice: Number(raw.package_selling_price ?? raw.packagesellingprice ?? raw.new_package_price ?? 0),
    minAlertThreshold: Number(raw.min_alert_threshold ?? raw.min_threshold ?? raw.reorder_level ?? 5),
    updatedAt: raw.updated_at || raw.updatedat
  };
}

/**
 * 1. FETCH GAS INVENTORY
 */
export async function fetchGasInventory(): Promise<GasInventoryItem[]> {
  try {
    const { data, error } = await supabase.from('gas_inventory').select('*');
    if (!error && data && data.length > 0) {
      const mapped = data.map(mapGasInventory);
      // Merge with default items to ensure all 8 standard brand/sizes are available
      const mergedMap = new Map<string, GasInventoryItem>();
      DEFAULT_GAS_INVENTORY.forEach(d => mergedMap.set(d.id, { ...d }));
      mapped.forEach(m => mergedMap.set(m.id, m));
      const res = Array.from(mergedMap.values());
      try {
        localStorage.setItem('fms_gas_inventory', JSON.stringify(res));
      } catch (_) {}
      return res;
    }
  } catch (err) {
    console.warn("Notice: gas_inventory fetch notice:", err);
  }

  // Fallback to local storage or defaults
  try {
    const stored = localStorage.getItem('fms_gas_inventory');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}

  return DEFAULT_GAS_INVENTORY;
}

/**
 * 2. SAVE / UPDATE GAS INVENTORY ITEM
 */
export async function saveGasInventoryItem(item: GasInventoryItem): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. Update local storage
    const current = await fetchGasInventory();
    const updated = current.map(c => c.id === item.id ? item : c);
    if (!updated.some(c => c.id === item.id)) {
      updated.push(item);
    }
    localStorage.setItem('fms_gas_inventory', JSON.stringify(updated));

    // 2. Persist to Supabase with multi-schema payload
    const payload = {
      id: item.id,
      brand: item.brand,
      cylinder_size: item.cylinderSize,
      size_kg: item.sizeKg,
      stock_full: item.stockFull,
      stock_empty: item.stockEmpty,
      buying_price: item.buyingPrice,
      refill_selling_price: item.refillSellingPrice,
      package_selling_price: item.packageSellingPrice,
      min_alert_threshold: item.minAlertThreshold,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('gas_inventory').upsert([payload]);
    if (error) {
      console.warn("Supabase gas_inventory upsert notice:", error.message);
    }
    return { success: true };
  } catch (err) {
    console.warn("Error saving gas inventory item:", err);
    return { success: false, error: err };
  }
}

/**
 * Normalizes raw Supabase row to GasPurchaseRecord
 */
export function mapGasPurchase(raw: any): GasPurchaseRecord {
  return {
    id: raw.id || `GAS-DEL-${Date.now()}`,
    date: raw.date || (raw.created_at ? raw.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    brand: (raw.brand || '').toLowerCase().includes('laugfs') ? 'Laugfs' : 'Litro',
    cylinderSize: raw.cylinder_size || raw.cylindersize || '12.5 kg Regular',
    purchaseType: (raw.purchase_type || raw.purchasetype || '').toLowerCase().includes('new') ? 'New Packages' : 'Refill Restock',
    fullQtyReceived: Number(raw.full_qty_received ?? raw.fullqtyreceived ?? raw.full_qty ?? raw.quantity ?? 0),
    emptyQtyHandedOver: Number(raw.empty_qty_handed_over ?? raw.emptyqtyhandedover ?? raw.empty_qty ?? 0),
    invoiceNo: raw.invoice_no || raw.invoiceno || raw.invoice_number || raw.do_number || raw.id,
    supplier: raw.supplier || raw.supplier_name || 'Litro Gas Lanka Ltd',
    unitBuyingPrice: Number(raw.unit_buying_price ?? raw.unitbuyingprice ?? raw.unit_price ?? 0),
    totalCost: Number(raw.total_cost ?? raw.totalcost ?? raw.total_amount ?? 0),
    receivedBy: raw.received_by || raw.receivedby || 'Storekeeper',
    notes: raw.notes || '',
    createdAt: raw.created_at
  };
}

/**
 * 3. FETCH GAS PURCHASES
 */
export async function fetchGasPurchases(): Promise<GasPurchaseRecord[]> {
  try {
    const { data, error } = await supabase
      .from('gas_purchases')
      .select('*')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = data.map(mapGasPurchase);
      try {
        localStorage.setItem('fms_gas_purchases', JSON.stringify(mapped));
      } catch (_) {}
      return mapped;
    }
  } catch (err) {
    console.warn("gas_purchases fetch notice:", err);
  }

  // Fallback to local storage
  try {
    const stored = localStorage.getItem('fms_gas_purchases');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return [];
}

/**
 * 4. SAVE GAS PURCHASE & AUTOMATICALLY UPDATE INVENTORY
 * Requirements:
 * "When a Gas Purchase is logged, automatically increment stock_full and decrement stock_empty in gas_inventory."
 */
export async function saveGasPurchase(record: GasPurchaseRecord): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. Save to local storage purchases list
    const currentPurchases = await fetchGasPurchases();
    const updatedPurchases = [record, ...currentPurchases.filter(p => p.id !== record.id)];
    localStorage.setItem('fms_gas_purchases', JSON.stringify(updatedPurchases));

    // 2. Adjust gas inventory
    const inventory = await fetchGasInventory();
    const targetItem = inventory.find(i => 
      i.brand.toLowerCase() === record.brand.toLowerCase() && 
      i.cylinderSize.toLowerCase() === record.cylinderSize.toLowerCase()
    ) || inventory[0];

    if (targetItem) {
      const updatedFull = targetItem.stockFull + record.fullQtyReceived;
      // In Refill Restock, empty cylinders are handed over to distributor (decrements empty stock)
      const updatedEmpty = Math.max(0, targetItem.stockEmpty - (record.emptyQtyHandedOver || 0));

      const updatedTarget: GasInventoryItem = {
        ...targetItem,
        stockFull: updatedFull,
        stockEmpty: updatedEmpty,
        buyingPrice: record.unitBuyingPrice || targetItem.buyingPrice,
        updatedAt: new Date().toISOString()
      };

      await saveGasInventoryItem(updatedTarget);
    }

    // 3. Persist purchase record to Supabase
    const payload = {
      id: record.id,
      date: record.date,
      brand: record.brand,
      cylinder_size: record.cylinderSize,
      purchase_type: record.purchaseType,
      full_qty_received: record.fullQtyReceived,
      empty_qty_handed_over: record.emptyQtyHandedOver,
      invoice_no: record.invoiceNo,
      supplier: record.supplier,
      unit_buying_price: record.unitBuyingPrice,
      total_cost: record.totalCost,
      received_by: record.receivedBy || 'Storekeeper',
      notes: record.notes || '',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('gas_purchases').upsert([payload]);
    if (error) {
      console.warn("Supabase gas_purchases insert notice:", error.message);
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving gas purchase:", err);
    return { success: false, error: err };
  }
}

/**
 * Normalizes raw Supabase row to GasSaleRecord
 */
export function mapGasSale(raw: any): GasSaleRecord {
  return {
    id: raw.id || `GAS-SALE-${Date.now()}`,
    date: raw.date || (raw.created_at ? raw.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    brand: (raw.brand || '').toLowerCase().includes('laugfs') ? 'Laugfs' : 'Litro',
    cylinderSize: raw.cylinder_size || raw.cylindersize || '12.5 kg Regular',
    saleType: (raw.sale_type || raw.saletype || '').toLowerCase().includes('new') 
      ? 'New Package' 
      : (raw.sale_type || '').toLowerCase().includes('return') 
      ? 'Empty Return' 
      : 'Refill Exchange',
    quantity: Number(raw.quantity ?? raw.qty ?? 1),
    emptyReceivedQty: Number(raw.empty_received_qty ?? raw.emptyreceivedqty ?? 0),
    unitPrice: Number(raw.unit_price ?? raw.unitprice ?? 0),
    totalAmount: Number(raw.total_amount ?? raw.totalamount ?? 0),
    customerType: (raw.customer_type || '').toLowerCase().includes('credit') ? 'Credit' : 'Walk-in',
    customerName: raw.customer_name || raw.customername || '',
    customerId: raw.customer_id || raw.customerid,
    paymentMethod: (raw.payment_method || 'Cash') as any,
    soldBy: raw.sold_by || raw.soldby || 'Counter Cashier',
    vehicleNo: raw.vehicle_no || raw.vehicleno || '',
    notes: raw.notes || '',
    createdAt: raw.created_at
  };
}

/**
 * 5. FETCH GAS SALES
 */
export async function fetchGasSales(): Promise<GasSaleRecord[]> {
  try {
    const { data, error } = await supabase
      .from('gas_sales')
      .select('*')
      .order('date', { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped = data.map(mapGasSale);
      try {
        localStorage.setItem('fms_gas_sales', JSON.stringify(mapped));
      } catch (_) {}
      return mapped;
    }
  } catch (err) {
    console.warn("gas_sales fetch notice:", err);
  }

  try {
    const stored = localStorage.getItem('fms_gas_sales');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return [];
}

/**
 * 6. SAVE GAS SALE & AUTOMATICALLY UPDATE INVENTORY
 * Requirements:
 * Decrement stock_full on sale
 * Increment stock_empty when customer returns an empty cylinder during Refill Exchange
 */
export async function saveGasSale(record: GasSaleRecord): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. Save to local sales history
    const currentSales = await fetchGasSales();
    const updatedSales = [record, ...currentSales.filter(s => s.id !== record.id)];
    localStorage.setItem('fms_gas_sales', JSON.stringify(updatedSales));

    // 2. Adjust gas inventory
    const inventory = await fetchGasInventory();
    const targetItem = inventory.find(i => 
      i.brand.toLowerCase() === record.brand.toLowerCase() && 
      i.cylinderSize.toLowerCase() === record.cylinderSize.toLowerCase()
    );

    if (targetItem) {
      let updatedFull = targetItem.stockFull;
      let updatedEmpty = targetItem.stockEmpty;

      if (record.saleType === 'Refill Exchange') {
        // Customer gives empty cylinder, receives full cylinder
        updatedFull = Math.max(0, targetItem.stockFull - record.quantity);
        updatedEmpty = targetItem.stockEmpty + (record.emptyReceivedQty || record.quantity);
      } else if (record.saleType === 'New Package') {
        // Customer buys cylinder + gas (no empty cylinder returned)
        updatedFull = Math.max(0, targetItem.stockFull - record.quantity);
      } else if (record.saleType === 'Empty Return') {
        // Customer just returns empty cylinder
        updatedEmpty = targetItem.stockEmpty + (record.emptyReceivedQty || record.quantity);
      }

      const updatedTarget: GasInventoryItem = {
        ...targetItem,
        stockFull: updatedFull,
        stockEmpty: updatedEmpty,
        updatedAt: new Date().toISOString()
      };

      await saveGasInventoryItem(updatedTarget);
    }

    // 3. Persist sale to Supabase
    const payload = {
      id: record.id,
      date: record.date,
      brand: record.brand,
      cylinder_size: record.cylinderSize,
      sale_type: record.saleType,
      quantity: record.quantity,
      empty_received_qty: record.emptyReceivedQty,
      unit_price: record.unitPrice,
      total_amount: record.totalAmount,
      customer_type: record.customerType,
      customer_name: record.customerName || null,
      customer_id: record.customerId || null,
      payment_method: record.paymentMethod,
      sold_by: record.soldBy || 'Counter Cashier',
      vehicle_no: record.vehicleNo || null,
      notes: record.notes || '',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('gas_sales').upsert([payload]);
    if (error) {
      console.warn("Supabase gas_sales insert notice:", error.message);
    }

    return { success: true };
  } catch (err) {
    console.error("Error saving gas sale:", err);
    return { success: false, error: err };
  }
}
