import { supabase } from './supabase';
import { PackagedOilItem, OilTank, OilGRNRecord } from '../types';

/**
 * Normalizes a raw Supabase record to PackagedOilItem
 */
export function mapPackagedLubricant(raw: any): PackagedOilItem {
  return {
    id: raw.id || `pkg-${Date.now()}`,
    name: raw.product_name || raw.productname || raw.productName || raw.name || raw.item_name || raw.itemName || 'Unnamed Lubricant',
    category: (raw.category as any) || 'Engine Oil',
    grade: raw.grade || raw.oil_grade || raw.oilGrade || 'Standard',
    packageSize: raw.pack_size || raw.packsize || raw.packSize || raw.package_size || raw.packagesize || raw.packageSize || raw.package_size_label || raw.size || '1L Bottle',
    currentStock: Number(raw.current_stock ?? raw.currentstock ?? raw.currentStock ?? raw.stock_qty ?? raw.stock ?? 0) || 0,
    minReorderLevel: Number(raw.min_reorder_level ?? raw.minreorderlevel ?? raw.minReorderLevel ?? raw.reorder_level ?? raw.min_stock ?? 10) || 10,
    unitCost: Number(raw.cost_price ?? raw.costprice ?? raw.costPrice ?? raw.unit_cost ?? raw.unitcost ?? raw.unitCost ?? raw.purchase_price ?? 0) || 0,
    retailPrice: Number(raw.retail_price ?? raw.retailprice ?? raw.retailPrice ?? raw.selling_price ?? raw.sellingprice ?? raw.sellingPrice ?? raw.price ?? 0) || 0,
    barcode: raw.barcode || '',
    location: raw.location || raw.shelf_location || raw.shelflocation || raw.shelfLocation || 'Main Rack'
  };
}

/**
 * Normalizes a raw Supabase record to OilTank (Bulk Lubricant / Drum / Chamber)
 */
export function mapBulkLubricant(raw: any): OilTank {
  const name = raw.name || 'Bulk Oil Tank';
  const isChamber = raw.type === 'chamber' || name.toLowerCase().includes('chamber') || String(raw.id).includes('chamber');
  
  return {
    id: raw.id || `oil-tank-${Date.now()}`,
    name: name,
    grade: raw.grade || raw.oil_grade || 'Caltex 20W-50',
    capacity: Number(raw.capacity) || (isChamber ? 100 : 210),
    currentLevel: Number(raw.current_level ?? raw.currentlevel ?? 0) || 0,
    pricePerLiter: Number(raw.price_per_liter ?? raw.priceperliter ?? raw.rate ?? 0) || 0,
    type: (raw.type as any) || (isChamber ? 'chamber' : 'drum'),
    chamberNumber: raw.chamber_number ?? raw.chambernumber ?? undefined
  };
}

/**
 * Normalizes a raw Supabase record to OilGRNRecord
 */
export function mapGRNReceipt(raw: any, items: any[] = []): OilGRNRecord {
  let parsedItems = items;
  if ((!parsedItems || parsedItems.length === 0) && raw.items) {
    if (Array.isArray(raw.items)) {
      parsedItems = raw.items;
    } else if (typeof raw.items === 'string') {
      try {
        parsedItems = JSON.parse(raw.items);
      } catch (_) {
        parsedItems = [];
      }
    }
  }

  const mappedItems = (parsedItems || []).map((it: any) => ({
    itemId: it.item_id || it.itemid || it.itemId || '',
    itemName: it.product_name || it.item_name || it.itemname || it.itemName || it.name || 'Lubricant Item',
    packageSize: it.pack_size || it.package_size || it.packagesize || it.packageSize || '1L Bottle',
    quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
    unitCost: Number(it.cost_price ?? it.costprice ?? it.unit_cost ?? it.unitcost ?? it.unitCost ?? 0) || 0,
    totalCost: Number(it.total_cost ?? it.totalcost ?? it.totalCost ?? 0) || 0
  }));

  return {
    id: raw.id || `grn-${Date.now()}`,
    grnNumber: raw.grn_number || raw.grnnumber || raw.grn_no || `GRN-${raw.id}`,
    date: raw.date || raw.created_at ? new Date(raw.date || raw.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    supplier: raw.supplier || raw.supplier_name || '',
    invoiceNumber: raw.invoice_number || raw.invoicenumber || raw.invoice_no || '',
    type: (raw.type as any) || (raw.tank_id || raw.tankid ? 'bulk' : 'packaged'),
    tankId: raw.tank_id || raw.tankid || undefined,
    tankName: raw.tank_name || raw.tankname || undefined,
    litersReceived: Number(raw.liters_received ?? raw.litersreceived ?? raw.quantity ?? 0) || undefined,
    items: mappedItems,
    totalAmount: Number(raw.total_amount ?? raw.totalamount ?? raw.amount ?? 0) || 0,
    receivedBy: raw.received_by || raw.receivedby || 'Supervisor',
    notes: raw.notes || ''
  };
}

/**
 * 1. FETCH PACKAGED LUBRICANTS
 */
export async function fetchPackagedLubricants(): Promise<PackagedOilItem[]> {
  try {
    // Primary table: packaged_lubricants
    let { data, error } = await supabase.from('packaged_lubricants').select('*');
    
    // Fallback table: packaged_oil_items
    if (error || !data || data.length === 0) {
      const fallback = await supabase.from('packaged_oil_items').select('*');
      if (!fallback.error && fallback.data) {
        data = fallback.data;
      }
    }

    if (data && Array.isArray(data)) {
      return data.map(mapPackagedLubricant).sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );
    }
  } catch (err) {
    console.warn("fetchPackagedLubricants notice:", err);
  }
  return [];
}

/**
 * 2. SAVE PACKAGED LUBRICANT (Add / Edit with comprehensive multi-schema fallbacks)
 */
export async function savePackagedLubricant(item: PackagedOilItem): Promise<{ success: boolean; data?: PackagedOilItem; error?: any }> {
  if (!item || !item.id) return { success: false, error: 'Invalid item payload' };

  const id = item.id;
  const name = item.name?.trim() || 'Unnamed Lubricant';
  const category = item.category || 'Engine Oil';
  const grade = item.grade?.trim() || 'Standard';
  const packageSize = item.packageSize?.trim() || '1L Bottle';
  const location = item.location?.trim() || 'Main Rack';
  const currentStock = Number(item.currentStock) || 0;
  const minReorderLevel = Number(item.minReorderLevel) || 10;
  const unitCost = Number(item.unitCost) || 0;
  const retailPrice = Number(item.retailPrice) || 0;
  const barcode = item.barcode?.trim() || '';

  // Multi-schema variants to support exact column names in Postgres / Supabase
  const payloadVariants = [
    // 1. Explicit user columns: product_name, pack_size, cost_price, retail_price
    {
      id,
      product_name: name,
      grade,
      category,
      pack_size: packageSize,
      location,
      current_stock: currentStock,
      min_reorder_level: minReorderLevel,
      cost_price: unitCost,
      retail_price: retailPrice,
      barcode
    },
    // 2. Standard snake_case: name, package_size, unit_cost, retail_price
    {
      id,
      name,
      grade,
      category,
      package_size: packageSize,
      location,
      current_stock: currentStock,
      min_reorder_level: minReorderLevel,
      unit_cost: unitCost,
      retail_price: retailPrice,
      barcode
    },
    // 3. Hybrid: product_name, package_size, unit_cost, retail_price
    {
      id,
      product_name: name,
      grade,
      category,
      package_size: packageSize,
      location,
      current_stock: currentStock,
      min_reorder_level: minReorderLevel,
      unit_cost: unitCost,
      retail_price: retailPrice,
      barcode
    },
    // 4. Variant with name, pack_size, cost_price, selling_price
    {
      id,
      name,
      grade,
      category,
      pack_size: packageSize,
      location,
      current_stock: currentStock,
      min_reorder_level: minReorderLevel,
      cost_price: unitCost,
      selling_price: retailPrice,
      barcode
    },
    // 5. Lowercase single-word
    {
      id,
      name,
      grade,
      category,
      packagesize: packageSize,
      location,
      currentstock: currentStock,
      minreorderlevel: minReorderLevel,
      unitcost: unitCost,
      retailprice: retailPrice,
      barcode
    },
    // 6. CamelCase
    {
      id,
      name,
      grade,
      category,
      packageSize,
      location,
      currentStock,
      minReorderLevel,
      unitCost,
      retailPrice,
      barcode
    }
  ];

  let lastError: any = null;

  // Try each payload variant against packaged_lubricants table
  for (const payload of payloadVariants) {
    try {
      const res = await supabase.from('packaged_lubricants').upsert([payload]);
      if (!res.error) {
        return { success: true, data: item };
      }
      lastError = res.error;
    } catch (err: any) {
      lastError = err;
    }
  }

  // Fallback to packaged_oil_items table
  for (const payload of payloadVariants) {
    try {
      const altRes = await supabase.from('packaged_oil_items').upsert([payload]);
      if (!altRes.error) {
        return { success: true, data: item };
      }
      if (altRes.error) lastError = altRes.error;
    } catch (err: any) {
      lastError = err;
    }
  }

  console.warn("savePackagedLubricant Supabase upsert notice:", lastError);
  return { 
    success: false, 
    error: lastError?.message || lastError?.details || (typeof lastError === 'string' ? lastError : 'Supabase insertion failed') 
  };
}

/**
 * 3. DELETE PACKAGED LUBRICANT
 */
export async function deletePackagedLubricant(itemId: string): Promise<boolean> {
  if (!itemId) return false;
  try {
    await supabase.from('packaged_lubricants').delete().eq('id', itemId);
    await supabase.from('packaged_oil_items').delete().eq('id', itemId);
    return true;
  } catch (err) {
    console.warn("deletePackagedLubricant error:", err);
    return false;
  }
}

/**
 * 4. FETCH BULK LUBRICANTS / OIL TANKS
 */
export async function fetchBulkLubricants(): Promise<OilTank[]> {
  try {
    // Primary: bulk_lubricants
    let { data, error } = await supabase.from('bulk_lubricants').select('*');
    
    // Fallback: oil_tanks
    if (error || !data || data.length === 0) {
      const fallback = await supabase.from('oil_tanks').select('*');
      if (!fallback.error && fallback.data) {
        data = fallback.data;
      }
    }

    if (data && Array.isArray(data)) {
      return data.map(mapBulkLubricant).sort((a, b) => 
        (a.name || a.id).localeCompare(b.name || b.id, undefined, { numeric: true, sensitivity: 'base' })
      );
    }
  } catch (err) {
    console.warn("fetchBulkLubricants notice:", err);
  }
  return [];
}

/**
 * 5. SAVE BULK LUBRICANT (Chamber / Drum Tank)
 */
export async function saveBulkLubricant(tank: OilTank): Promise<{ success: boolean; data?: OilTank; error?: any }> {
  if (!tank || !tank.id) return { success: false, error: 'Invalid tank payload' };

  const snakePayload = {
    id: tank.id,
    name: tank.name,
    grade: tank.grade,
    capacity: tank.capacity,
    current_level: tank.currentLevel,
    price_per_liter: tank.pricePerLiter,
    type: tank.type || 'drum',
    chamber_number: tank.chamberNumber ?? null
  };

  const lowerPayload = {
    id: tank.id,
    name: tank.name,
    grade: tank.grade,
    capacity: tank.capacity,
    currentlevel: tank.currentLevel,
    priceperliter: tank.pricePerLiter,
    type: tank.type || 'drum',
    chambernumber: tank.chamberNumber ?? null
  };

  try {
    // Try bulk_lubricants
    let res = await supabase.from('bulk_lubricants').upsert([snakePayload]);
    if (res.error) {
      res = await supabase.from('bulk_lubricants').upsert([lowerPayload]);
    }

    // Also sync to oil_tanks table for backward compatibility
    try {
      let otRes = await supabase.from('oil_tanks').upsert([lowerPayload]);
      if (otRes.error) {
        await supabase.from('oil_tanks').upsert([snakePayload]);
      }
    } catch (_) {}

    return { success: true, data: tank };
  } catch (err) {
    console.warn("saveBulkLubricant error:", err);
    return { success: false, error: err };
  }
}

/**
 * 6. DELETE BULK LUBRICANT
 */
export async function deleteBulkLubricant(tankId: string): Promise<boolean> {
  if (!tankId) return false;
  try {
    await supabase.from('bulk_lubricants').delete().eq('id', tankId);
    await supabase.from('oil_tanks').delete().eq('id', tankId);
    return true;
  } catch (err) {
    console.warn("deleteBulkLubricant error:", err);
    return false;
  }
}

/**
 * 7. FETCH LUBRICANT GRN RECEIPTS
 */
export async function fetchLubricantGRNReceipts(): Promise<OilGRNRecord[]> {
  try {
    // 1. Fetch Receipts
    let { data: receiptsData, error: rError } = await supabase
      .from('lubricant_grn_receipts')
      .select('*')
      .order('date', { ascending: false });

    // Fallback table: oil_grn_records
    if (rError || !receiptsData) {
      const fallback = await supabase
        .from('oil_grn_records')
        .select('*')
        .order('date', { ascending: false });
      if (!fallback.error && fallback.data) {
        receiptsData = fallback.data;
      }
    }

    if (!receiptsData || !Array.isArray(receiptsData)) {
      return [];
    }

    // 2. Fetch line items if lubricant_grn_items table exists
    let itemsByGrnId: Record<string, any[]> = {};
    try {
      const { data: itemsData } = await supabase.from('lubricant_grn_items').select('*');
      if (itemsData && Array.isArray(itemsData)) {
        for (const item of itemsData) {
          const grnKey = item.grn_id || item.grnid;
          if (grnKey) {
            if (!itemsByGrnId[grnKey]) itemsByGrnId[grnKey] = [];
            itemsByGrnId[grnKey].push(item);
          }
        }
      }
    } catch (_) {}

    return receiptsData.map(r => mapGRNReceipt(r, itemsByGrnId[r.id] || []));
  } catch (err) {
    console.warn("fetchLubricantGRNReceipts notice:", err);
    return [];
  }
}

/**
 * 8. SAVE LUBRICANT GRN RECEIPT (With automatic stock increment)
 */
export async function saveLubricantGRN(grn: OilGRNRecord): Promise<{ success: boolean; data?: OilGRNRecord; error?: any }> {
  if (!grn || !grn.id) return { success: false, error: 'Invalid GRN payload' };

  const snakeReceipt = {
    id: grn.id,
    grn_number: grn.grnNumber,
    date: grn.date,
    supplier: grn.supplier,
    invoice_number: grn.invoiceNumber,
    type: grn.type,
    tank_id: grn.tankId || null,
    tank_name: grn.tankName || null,
    liters_received: grn.litersReceived || 0,
    total_amount: grn.totalAmount,
    received_by: grn.receivedBy,
    notes: grn.notes || '',
    items: JSON.stringify(grn.items || [])
  };

  const lowerReceipt = {
    id: grn.id,
    grnnumber: grn.grnNumber,
    date: grn.date,
    supplier: grn.supplier,
    invoicenumber: grn.invoiceNumber,
    type: grn.type,
    tankid: grn.tankId || null,
    tankname: grn.tankName || null,
    litersreceived: grn.litersReceived || 0,
    totalamount: grn.totalAmount,
    receivedby: grn.receivedBy,
    notes: grn.notes || '',
    items: JSON.stringify(grn.items || [])
  };

  try {
    // 1. Insert Receipt
    let res = await supabase.from('lubricant_grn_receipts').upsert([snakeReceipt]);
    if (res.error) {
      res = await supabase.from('lubricant_grn_receipts').upsert([lowerReceipt]);
    }
    if (res.error) {
      // Fallback table oil_grn_records
      await supabase.from('oil_grn_records').upsert([snakeReceipt]);
    }

    // 2. Insert Line items if packaged
    if (grn.type === 'packaged' && grn.items && grn.items.length > 0) {
      const lineItemsPayload = grn.items.map((it, idx) => ({
        id: `${grn.id}-item-${idx + 1}`,
        grn_id: grn.id,
        item_id: it.itemId,
        item_name: it.itemName,
        package_size: it.packageSize,
        quantity: it.quantity,
        unit_cost: it.unitCost,
        total_cost: it.totalCost
      }));

      try {
        await supabase.from('lubricant_grn_items').upsert(lineItemsPayload);
      } catch (_) {}

      // 3. Increment Packaged Product Stock & update cost in DB
      for (const item of grn.items) {
        if (item.itemId && item.quantity > 0) {
          await incrementPackagedStock(item.itemId, item.quantity, item.unitCost);
        }
      }
    }

    // 4. Increment Bulk Tank Level if bulk
    if (grn.type === 'bulk' && grn.tankId && (grn.litersReceived || 0) > 0) {
      const costPerL = grn.totalAmount && grn.litersReceived ? Math.round(grn.totalAmount / grn.litersReceived) : undefined;
      await incrementBulkStock(grn.tankId, grn.litersReceived, costPerL);
    }

    return { success: true, data: grn };
  } catch (err) {
    console.warn("saveLubricantGRN error:", err);
    return { success: false, error: err };
  }
}

/**
 * 9. INCREMENT PACKAGED STOCK (Direct helper with multi-schema columns)
 */
export async function incrementPackagedStock(
  itemId: string, 
  qtyReceived: number, 
  newUnitCost?: number
): Promise<{ success: boolean; newStock: number; error?: any }> {
  if (!itemId || qtyReceived <= 0) return { success: false, newStock: 0, error: 'Invalid parameters' };

  try {
    // 1. Fetch current item
    let { data: item } = await supabase.from('packaged_lubricants').select('*').eq('id', itemId).maybeSingle();
    if (!item) {
      const fallback = await supabase.from('packaged_oil_items').select('*').eq('id', itemId).maybeSingle();
      if (fallback.data) item = fallback.data;
    }

    const curStock = Number(item?.current_stock ?? item?.currentstock ?? item?.currentStock ?? 0);
    const newStock = curStock + qtyReceived;
    const costVal = (newUnitCost !== undefined && newUnitCost > 0) ? newUnitCost : Number(item?.cost_price ?? item?.unit_cost ?? item?.unitcost ?? 0);

    const updateVariants = [
      { current_stock: newStock, cost_price: costVal, unit_cost: costVal },
      { current_stock: newStock, unit_cost: costVal },
      { currentstock: newStock, unitcost: costVal },
      { current_stock: newStock }
    ];

    for (const v of updateVariants) {
      try {
        const res = await supabase.from('packaged_lubricants').update(v).eq('id', itemId);
        if (!res.error) break;
      } catch (_) {}
    }

    for (const v of updateVariants) {
      try {
        const alt = await supabase.from('packaged_oil_items').update(v).eq('id', itemId);
        if (!alt.error) break;
      } catch (_) {}
    }

    return { success: true, newStock };
  } catch (err: any) {
    console.warn("incrementPackagedStock notice:", err);
    return { success: false, newStock: 0, error: err };
  }
}

/**
 * 10. INCREMENT BULK STOCK (Direct helper with multi-schema columns)
 */
export async function incrementBulkStock(
  tankId: string, 
  litersReceived: number, 
  newPricePerLiter?: number
): Promise<{ success: boolean; newLevel: number; error?: any }> {
  if (!tankId || litersReceived <= 0) return { success: false, newLevel: 0, error: 'Invalid parameters' };

  try {
    let { data: tank } = await supabase.from('bulk_lubricants').select('*').eq('id', tankId).maybeSingle();
    if (!tank) {
      const fallback = await supabase.from('oil_tanks').select('*').eq('id', tankId).maybeSingle();
      if (fallback.data) tank = fallback.data;
    }

    const curLevel = Number(tank?.current_level ?? tank?.currentlevel ?? 0);
    const capacity = Number(tank?.capacity) || 1000;
    const newLevel = Math.min(capacity, curLevel + litersReceived);
    const rate = (newPricePerLiter !== undefined && newPricePerLiter > 0) ? newPricePerLiter : Number(tank?.price_per_liter ?? tank?.priceperliter ?? 0);

    const updateVariants = [
      { current_level: newLevel, price_per_liter: rate },
      { currentlevel: newLevel, priceperliter: rate },
      { current_level: newLevel },
      { currentlevel: newLevel }
    ];

    for (const v of updateVariants) {
      try {
        const res = await supabase.from('bulk_lubricants').update(v).eq('id', tankId);
        if (!res.error) break;
      } catch (_) {}
    }

    for (const v of updateVariants) {
      try {
        const alt = await supabase.from('oil_tanks').update(v).eq('id', tankId);
        if (!alt.error) break;
      } catch (_) {}
    }

    return { success: true, newLevel };
  } catch (err: any) {
    console.warn("incrementBulkStock notice:", err);
    return { success: false, newLevel: 0, error: err };
  }
}

/**
 * 9. DEDUCT RETAIL SALE STOCK
 */
export async function deductPackagedStock(itemId: string, qtySold: number): Promise<boolean> {
  if (!itemId || qtySold <= 0) return false;
  try {
    const { data: item } = await supabase
      .from('packaged_lubricants')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (item) {
      const curStock = Number(item.current_stock ?? item.currentstock ?? 0);
      const newStock = Math.max(0, curStock - qtySold);
      await supabase.from('packaged_lubricants').update({ current_stock: newStock }).eq('id', itemId);
      try {
        await supabase.from('packaged_oil_items').update({ currentstock: newStock, current_stock: newStock }).eq('id', itemId);
      } catch (_) {}
      return true;
    }
  } catch (err) {
    console.warn("deductPackagedStock error:", err);
  }
  return false;
}
