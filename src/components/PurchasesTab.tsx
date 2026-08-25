/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Truck, ShoppingBag, Droplets, Fuel, Package, FileText, 
  Calendar, Search, Filter, Plus, Trash2, AlertTriangle, 
  CheckCircle2, Download, X, ArrowDownRight, Layers,
  Database, RefreshCw, ChevronRight, Info, Building2, Tag, DollarSign,
  Printer, Eye
} from 'lucide-react';
import { FuelTank, OilTank, StockDelivery, FuelType, Employee, PackagedOilItem, OilGRNRecord, ReceiptDesignerConfig, DEFAULT_RECEIPT_CONFIG } from '../types';
import { supabase, getTanksTableName } from '../lib/supabase';
import { saveOilTank } from '../lib/supabaseClient';
import { 
  fetchPackagedLubricants, 
  fetchBulkLubricants, 
  fetchLubricantGRNReceipts, 
  saveLubricantGRN, 
  incrementPackagedStock, 
  incrementBulkStock 
} from '../lib/lubricantsClient';

export interface UnifiedPurchaseEntry {
  id: string;
  date: string;
  category: 'Fuel Bowser' | 'Packaged Lubricant' | 'Bulk Oil';
  supplier: string;
  invoiceNo: string;
  description: string;
  destination: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  totalAmount: number;
  receivedBy?: string;
  rawType: 'fuel' | 'lube_grn';
}

interface PurchasesTabProps {
  tanks: FuelTank[];
  setTanks: React.Dispatch<React.SetStateAction<FuelTank[]>>;
  oilTanks: OilTank[];
  setOilTanks: React.Dispatch<React.SetStateAction<OilTank[]>>;
  deliveries: StockDelivery[];
  setDeliveries: React.Dispatch<React.SetStateAction<StockDelivery[]>>;
  employees?: Employee[];
}

export default function PurchasesTab({
  tanks,
  setTanks,
  oilTanks,
  setOilTanks,
  deliveries,
  setDeliveries,
  employees = []
}: PurchasesTabProps) {
  // Sub-tabs: 'fuel-bowser' | 'lubricants'
  const [activeSubTab, setActiveSubTab] = useState<'fuel-bowser' | 'lubricants'>('fuel-bowser');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Selected Purchase for Receipt Modal
  const [selectedReceiptPurchase, setSelectedReceiptPurchase] = useState<UnifiedPurchaseEntry | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Load Receipt Designer Configuration from LocalStorage
  const [receiptConfig, setReceiptConfig] = useState<ReceiptDesignerConfig>(() => {
    try {
      const saved = localStorage.getItem('fms_receipt_designer_config');
      if (saved) {
        return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_RECEIPT_CONFIG;
  });

  // Re-sync receipt configuration whenever modal opens or storage updates
  useEffect(() => {
    const loadConfig = () => {
      try {
        const saved = localStorage.getItem('fms_receipt_designer_config');
        if (saved) {
          setReceiptConfig({ ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(saved) });
        }
      } catch {
        // Fallback
      }
    };

    loadConfig();
    window.addEventListener('storage', loadConfig);
    return () => window.removeEventListener('storage', loadConfig);
  }, []);

  const handlePrintReceipt = () => {
    window.print();
  };

  const openReceiptModal = (entry: UnifiedPurchaseEntry) => {
    try {
      const saved = localStorage.getItem('fms_receipt_designer_config');
      if (saved) {
        setReceiptConfig({ ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(saved) });
      }
    } catch {
      // Fallback
    }
    setSelectedReceiptPurchase(entry);
    setIsReceiptModalOpen(true);
  };

  // Currency & Volume formatters (Sri Lankan Rupees)
  const formatCurrency = (val: number) => {
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(val) + ' L';
  };

  // -------------------------------------------------------------
  // 1. FUEL PURCHASE MODAL STATE (Exact existing form structure)
  // -------------------------------------------------------------
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [selectedTankId, setSelectedTankId] = useState<string>('');
  const [deliveryFuelType, setDeliveryFuelType] = useState<FuelType>('Petrol 92');
  const [deliveryQty, setDeliveryQty] = useState<number | ''>('');
  const [deliverySupplier, setDeliverySupplier] = useState('Ceylon Petroleum Corporation');
  const [deliveryInvoiceNo, setDeliveryInvoiceNo] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [fuelModalError, setFuelModalError] = useState<string | null>(null);

  // Sorted tanks
  const sortedTanks = useMemo(() => {
    return [...tanks].sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [tanks]);

  // Handle Fuel Delivery Submit (Exact logic from FuelStockTab)
  const handleAddFuelDeliverySubmit = async () => {
    const numQty = typeof deliveryQty === 'number' ? deliveryQty : parseFloat(deliveryQty) || 0;
    if (numQty <= 0) {
      setFuelModalError('Delivery volume must be a positive number.');
      return;
    }
    
    // Find selected target tank
    const targetTank = tanks.find(t => t.id === selectedTankId) || tanks.find(t => t.fuelType === deliveryFuelType) || sortedTanks[0];
    if (!targetTank) {
      setFuelModalError('Please select a target storage tank.');
      return;
    }

    const freeSpace = targetTank.capacity - targetTank.currentLevel;
    if (numQty > freeSpace) {
      setFuelModalError(`Delivery volume (${numQty.toLocaleString()} L) exceeds target tank free space (${freeSpace.toFixed(1)} L) for ${targetTank.name}! Max volume you can add is ${freeSpace.toFixed(1)} L.`);
      return;
    }

    const updatedLevel = Math.min(targetTank.capacity, targetTank.currentLevel + numQty);

    // Update target tank current level locally
    const updatedTanks = tanks.map(t => {
      if (t.id === targetTank.id) {
        return {
          ...t,
          currentLevel: updatedLevel
        };
      }
      return t;
    });

    setTanks(updatedTanks);
    try {
      localStorage.setItem('fms_tanks', JSON.stringify(updatedTanks));
    } catch (_) {}

    const autoCost = Math.round(numQty * (targetTank.pricePerLiter || 0));
    const deliveryId = deliveryInvoiceNo.trim() || `DEL-${Date.now().toString().slice(-6)}`;
    const deliveryIsoDate = deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString();
    const supplierName = deliverySupplier.trim() || 'Ceylon Petroleum Corporation';

    // Create delivery record with target tank details locally
    const newDelivery: StockDelivery = {
      id: deliveryId,
      date: deliveryIsoDate,
      fuelType: targetTank.fuelType,
      tankId: targetTank.id,
      tankName: targetTank.name,
      quantity: numQty,
      supplier: supplierName,
      cost: autoCost
    };

    const newDeliveriesList = [newDelivery, ...deliveries];
    setDeliveries(newDeliveriesList);
    try {
      localStorage.setItem('fms_deliveries', JSON.stringify(newDeliveriesList));
    } catch (_) {}

    // Persist changes directly to Supabase tables
    try {
      // 1. Save purchase row to stock_deliveries strictly with valid columns
      const deliveryPayload = {
        id: deliveryId,
        date: deliveryIsoDate,
        fueltype: targetTank.fuelType,
        quantity: numQty,
        supplier: supplierName
      };

      const { error: delErr } = await supabase.from('stock_deliveries').upsert([deliveryPayload]).select();
      if (delErr) {
        console.warn('Purchase Save Notice:', delErr.message || delErr);
      }

      // 2. Auto-increment tank level in fuel_tanks table in Supabase
      const tankPayload = {
        id: targetTank.id,
        name: targetTank.name,
        fueltype: targetTank.fuelType,
        capacity: targetTank.capacity,
        currentlevel: updatedLevel,
        priceperliter: targetTank.pricePerLiter
      };

      const { error: tankErr } = await supabase.from(getTanksTableName()).upsert([tankPayload]);
      if (tankErr) {
        console.warn("Supabase fuel_tanks level auto-increment notice:", tankErr.message || tankErr);
      }
    } catch (err: any) {
      console.warn("Supabase purchase persistence notice:", err?.message || err);
    }

    setIsFuelModalOpen(false);
    setDeliveryQty('');
    setDeliveryInvoiceNo('');
    setDeliverySupplier('Ceylon Petroleum Corporation');
    setFuelModalError(null);
    showToast(`Fuel Bowser Delivery received successfully: ${numQty.toLocaleString()} L of ${targetTank.fuelType} into ${targetTank.name}.`);
  };

  // -------------------------------------------------------------
  // 2. OIL / LUBRICANT INVENTORY & GRN STATE (DYNAMIC SUPABASE SYNC)
  // -------------------------------------------------------------
  const [packagedItems, setPackagedItems] = useState<PackagedOilItem[]>(() => {
    try {
      const stored = localStorage.getItem('fms_packaged_oil_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && !parsed.some((p: any) => p.id === 'pkg-01' || p.id === 'pkg-02')) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [grnRecords, setGrnRecords] = useState<OilGRNRecord[]>(() => {
    try {
      const stored = localStorage.getItem('fms_oil_grn_records');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((g: any) => 
            g.id !== 'grn-01' && 
            g.id !== 'grn-02' && 
            g.invoiceNumber !== 'INV-164639' && 
            g.invoiceNumber !== 'INV-CHEV-8891' && 
            g.invoiceNumber !== 'CPC-BULK-3419' &&
            g.grnNumber !== 'GRN-OIL-2026-042' && 
            g.grnNumber !== 'GRN-OIL-2026-041'
          );
          return clean;
        }
      }
    } catch (_) {}
    return [];
  });

  // Purge legacy mock data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('fms_oil_grn_records');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((g: any) => 
            g.id !== 'grn-01' && 
            g.id !== 'grn-02' && 
            g.invoiceNumber !== 'INV-164639' && 
            g.invoiceNumber !== 'INV-CHEV-8891' && 
            g.invoiceNumber !== 'CPC-BULK-3419' &&
            g.grnNumber !== 'GRN-OIL-2026-042' && 
            g.grnNumber !== 'GRN-OIL-2026-041'
          );
          if (clean.length !== parsed.length) {
            localStorage.setItem('fms_oil_grn_records', JSON.stringify(clean));
            setGrnRecords(clean);
          }
        }
      }
    } catch (_) {}
  }, []);

  // Fetch dynamic catalog items and GRN records from Supabase on mount
  const loadDynamicLubricantData = useCallback(async () => {
    try {
      const [fetchedPackaged, fetchedBulk, fetchedGRN] = await Promise.all([
        fetchPackagedLubricants(),
        fetchBulkLubricants(),
        fetchLubricantGRNReceipts()
      ]);
      if (Array.isArray(fetchedPackaged)) {
        setPackagedItems(fetchedPackaged);
      }
      if (Array.isArray(fetchedBulk)) {
        setOilTanks(fetchedBulk);
      }
      if (Array.isArray(fetchedGRN)) {
        setGrnRecords(fetchedGRN);
      }
    } catch (err) {
      console.warn("Notice: Lubricant dynamic load error", err);
    }
  }, [setOilTanks]);

  useEffect(() => {
    loadDynamicLubricantData();
  }, [loadDynamicLubricantData]);

  // Real-time synchronization with Supabase for instant inventory reflection
  useEffect(() => {
    const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!isConfigured) return;

    const channel = supabase.channel('purchases-lubricant-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packaged_lubricants' }, async () => {
        const updated = await fetchPackagedLubricants();
        if (Array.isArray(updated)) setPackagedItems(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bulk_lubricants' }, async () => {
        const updated = await fetchBulkLubricants();
        if (Array.isArray(updated)) setOilTanks(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oil_tanks' }, async () => {
        const updated = await fetchBulkLubricants();
        if (Array.isArray(updated)) setOilTanks(updated);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lubricant_grn_receipts' }, async () => {
        const updated = await fetchLubricantGRNReceipts();
        if (Array.isArray(updated)) setGrnRecords(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setOilTanks]);

  // Sync Packaged items & GRN records to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('fms_packaged_oil_items', JSON.stringify(packagedItems));
    } catch (_) {}
  }, [packagedItems]);

  useEffect(() => {
    try {
      localStorage.setItem('fms_oil_grn_records', JSON.stringify(grnRecords));
    } catch (_) {}
  }, [grnRecords]);

  // -------------------------------------------------------------
  // 3. OIL / LUBRICANT PURCHASE MODAL STATE
  // -------------------------------------------------------------
  const [isLubeModalOpen, setIsLubeModalOpen] = useState(false);
  const [lubePurchaseType, setLubePurchaseType] = useState<'packaged' | 'bulk'>('packaged');
  const [selectedPackagedItemId, setSelectedPackagedItemId] = useState<string>('');
  const [lubeQuantity, setLubeQuantity] = useState<number | ''>('');
  const [lubeUnitCost, setLubeUnitCost] = useState<number | ''>('');
  const [lubeSupplier, setLubeSupplier] = useState('');
  const [lubeInvoiceNo, setLubeInvoiceNo] = useState('');
  const [lubeDeliveryDate, setLubeDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lubeReceivedBy, setLubeReceivedBy] = useState('Station Supervisor');
  const [lubeTargetOilTankId, setLubeTargetOilTankId] = useState<string>('');
  const [lubeModalError, setLubeModalError] = useState<string | null>(null);

  // Helper to open the lubricant purchase modal with pre-selected item and unit cost
  const handleOpenLubePurchaseModal = (initialType: 'packaged' | 'bulk' = 'packaged') => {
    setLubePurchaseType(initialType);
    setLubeModalError(null);
    setLubeQuantity('');
    setLubeInvoiceNo('');
    setLubeDeliveryDate(new Date().toISOString().split('T')[0]);

    if (initialType === 'packaged') {
      const activeItem = packagedItems.find(p => p.id === selectedPackagedItemId) || packagedItems[0];
      if (activeItem) {
        setSelectedPackagedItemId(activeItem.id);
        setLubeUnitCost(activeItem.unitCost || '');
      }
    } else {
      const activeTank = oilTanks.find(t => t.id === lubeTargetOilTankId) || oilTanks[0];
      if (activeTank) {
        setLubeTargetOilTankId(activeTank.id);
        setLubeUnitCost(activeTank.pricePerLiter || '');
      }
    }
    setIsLubeModalOpen(true);
  };

  // Switch type and auto-fill unit cost
  const handleSwitchLubeType = (type: 'packaged' | 'bulk') => {
    setLubePurchaseType(type);
    if (type === 'packaged') {
      const activeItem = packagedItems.find(p => p.id === selectedPackagedItemId) || packagedItems[0];
      if (activeItem) {
        setSelectedPackagedItemId(activeItem.id);
        setLubeUnitCost(activeItem.unitCost || '');
      }
    } else {
      const activeTank = oilTanks.find(t => t.id === lubeTargetOilTankId) || oilTanks[0];
      if (activeTank) {
        setLubeTargetOilTankId(activeTank.id);
        setLubeUnitCost(activeTank.pricePerLiter || '');
      }
    }
  };

  // Auto-populate unit cost when packaged item is changed
  useEffect(() => {
    if (lubePurchaseType === 'packaged' && selectedPackagedItemId) {
      const it = packagedItems.find(p => p.id === selectedPackagedItemId);
      if (it && it.unitCost) {
        setLubeUnitCost(it.unitCost);
      }
    }
  }, [selectedPackagedItemId, lubePurchaseType, packagedItems]);

  // Auto-populate unit cost when bulk tank is changed
  useEffect(() => {
    if (lubePurchaseType === 'bulk' && lubeTargetOilTankId) {
      const tank = oilTanks.find(t => t.id === lubeTargetOilTankId);
      if (tank && tank.pricePerLiter) {
        setLubeUnitCost(tank.pricePerLiter);
      }
    }
  }, [lubeTargetOilTankId, lubePurchaseType, oilTanks]);

  const handleAddLubePurchaseSubmit = async () => {
    const numQty = typeof lubeQuantity === 'number' ? lubeQuantity : parseFloat(lubeQuantity) || 0;
    const numUnitCost = typeof lubeUnitCost === 'number' ? lubeUnitCost : parseFloat(lubeUnitCost) || 0;

    if (numQty <= 0) {
      setLubeModalError('Please enter a valid quantity or volume received.');
      return;
    }
    if (numUnitCost < 0) {
      setLubeModalError('Unit cost cannot be negative.');
      return;
    }

    const grnId = `GRN-${Date.now().toString().slice(-6)}`;
    const invoiceNumber = lubeInvoiceNo.trim() || `INV-${Date.now().toString().slice(-6)}`;
    const supplierName = lubeSupplier.trim() || 'Supplier / Distributor';
    const totalCost = Math.round(numQty * numUnitCost);

    if (lubePurchaseType === 'packaged') {
      const selectedItem = packagedItems.find(p => p.id === selectedPackagedItemId) || packagedItems[0];
      if (!selectedItem) {
        setLubeModalError('Please select a packaged lubricant item from the catalog.');
        return;
      }

      const finalUnitCost = numUnitCost > 0 ? numUnitCost : (selectedItem.unitCost || 0);
      const newStockTotal = selectedItem.currentStock + numQty;

      // 1. Optimistic Local State Update for instant UI reflection
      const updatedPackaged = packagedItems.map(item => {
        if (item.id === selectedItem.id) {
          return {
            ...item,
            currentStock: newStockTotal,
            unitCost: finalUnitCost
          };
        }
        return item;
      });
      setPackagedItems(updatedPackaged);
      try {
        localStorage.setItem('fms_packaged_oil_items', JSON.stringify(updatedPackaged));
      } catch (_) {}

      // 2. Create new GRN record
      const newGRN: OilGRNRecord = {
        id: grnId,
        grnNumber: `GRN-OIL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        date: lubeDeliveryDate,
        supplier: supplierName,
        invoiceNumber: invoiceNumber,
        type: 'packaged',
        items: [
          {
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            packageSize: selectedItem.packageSize,
            quantity: numQty,
            unitCost: finalUnitCost,
            totalCost: totalCost
          }
        ],
        totalAmount: totalCost,
        receivedBy: lubeReceivedBy,
        notes: `Inward stock received for ${selectedItem.name} (${selectedItem.packageSize}).`
      };

      const updatedGRNList = [newGRN, ...grnRecords];
      setGrnRecords(updatedGRNList);
      try {
        localStorage.setItem('fms_oil_grn_records', JSON.stringify(updatedGRNList));
      } catch (_) {}

      // 3. Automated Supabase DB Stock Increment & GRN Receipt Logging
      try {
        await saveLubricantGRN(newGRN);
        await incrementPackagedStock(selectedItem.id, numQty, finalUnitCost);
      } catch (err) {
        console.warn("Supabase automated stock sync warning:", err);
      }

      showToast(`✓ Received +${numQty} units of ${selectedItem.name}. New Stock: ${newStockTotal} units.`);
    } else {
      // Bulk Oil Refill
      const targetOilTank = oilTanks.find(t => t.id === lubeTargetOilTankId) || oilTanks[0];
      if (!targetOilTank) {
        setLubeModalError('Please select a target bulk oil tank.');
        return;
      }

      const freeSpace = Math.max(0, targetOilTank.capacity - targetOilTank.currentLevel);
      if (numQty > freeSpace) {
        setLubeModalError(`Inward volume (${numQty} L) exceeds tank capacity. Free space is ${freeSpace} L.`);
        return;
      }

      const updatedLevel = Math.min(targetOilTank.capacity, targetOilTank.currentLevel + numQty);
      const updatedOilTanks = oilTanks.map(t => {
        if (t.id === targetOilTank.id) {
          return {
            ...t,
            currentLevel: updatedLevel
          };
        }
        return t;
      });

      // 1. Optimistic Local State Update
      setOilTanks(updatedOilTanks);
      try {
        localStorage.setItem('fms_oil_tanks', JSON.stringify(updatedOilTanks));
        await saveOilTank(supabase, {
          ...targetOilTank,
          currentLevel: updatedLevel
        });
      } catch (err) {
        console.warn("Oil tank save notice:", err);
      }

      // 2. Create new GRN record
      const newGRN: OilGRNRecord = {
        id: grnId,
        grnNumber: `GRN-BULK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        date: lubeDeliveryDate,
        supplier: supplierName,
        invoiceNumber: invoiceNumber,
        type: 'bulk',
        tankId: targetOilTank.id,
        tankName: `${targetOilTank.name} (${targetOilTank.grade})`,
        litersReceived: numQty,
        totalAmount: totalCost,
        receivedBy: lubeReceivedBy,
        notes: `Bulk barrel oil refill into ${targetOilTank.name}.`
      };

      const updatedGRNList = [newGRN, ...grnRecords];
      setGrnRecords(updatedGRNList);
      try {
        localStorage.setItem('fms_oil_grn_records', JSON.stringify(updatedGRNList));
      } catch (_) {}

      // 3. Automated Supabase DB Stock Increment & GRN Receipt Logging
      try {
        await saveLubricantGRN(newGRN);
        await incrementBulkStock(targetOilTank.id, numQty, numUnitCost);
      } catch (err) {
        console.warn("Supabase bulk stock increment warning:", err);
      }

      showToast(`✓ Bulk Oil Refill: Received +${numQty} L into ${targetOilTank.name}. New Level: ${updatedLevel} / ${targetOilTank.capacity} L.`);
    }

    setIsLubeModalOpen(false);
    setLubeQuantity('');
    setLubeInvoiceNo('');
    setLubeModalError(null);
  };

  // Delete Delivery from History
  const handleDeleteDelivery = async (delId: string) => {
    if (confirm("Are you sure you want to delete this delivery entry?")) {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          const { error } = await supabase.from('stock_deliveries').delete().eq('id', delId);
          if (error) console.warn("Supabase delivery delete error:", error.message);
        } catch (err) {
          console.warn("Delivery delete error:", err);
        }
      }
      const updated = deliveries.filter(d => d.id !== delId);
      setDeliveries(updated);
      localStorage.setItem('fms_deliveries', JSON.stringify(updated));
      showToast("Fuel delivery entry removed from audit records.");
    }
  };

  const handleDeleteGRN = (grnId: string) => {
    if (confirm("Are you sure you want to delete this Lubricant GRN record?")) {
      const updated = grnRecords.filter(g => g.id !== grnId);
      setGrnRecords(updated);
      showToast("Lubricant GRN record deleted.");
    }
  };

  // Aggregate Metrics
  const totalFuelLiters = useMemo(() => {
    return deliveries.reduce((acc, d) => acc + (d.quantity || 0), 0);
  }, [deliveries]);

  const totalFuelCost = useMemo(() => {
    return deliveries.reduce((acc, d) => {
      const matchedTank = tanks.find(t => t.id === d.tankId || t.fuelType === d.fuelType);
      return acc + (d.cost || Math.round(d.quantity * (matchedTank?.pricePerLiter || 0)));
    }, 0);
  }, [deliveries, tanks]);

  const totalLubeValue = useMemo(() => {
    return grnRecords.reduce((acc, g) => acc + (g.totalAmount || 0), 0);
  }, [grnRecords]);

  return (
    <div id="purchases-tab-root" className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs animate-fade-in border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Header (Clean standard layout matching other tabs) */}
      <div id="purchases-header-block" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight font-sans">
            Purchases
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage fuel bowser deliveries and lubricant stock replenishment
          </p>
        </div>

        {/* Quick Stats Summary */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
          <span>Total Fuel Volume: <strong className="text-slate-900 tabular-nums">{formatLiters(totalFuelLiters)}</strong></span>
          <span>&bull;</span>
          <span>Total Value: <strong className="text-emerald-700 tabular-nums">{formatCurrency(totalFuelCost + totalLubeValue)}</strong></span>
        </div>
      </div>

      {/* Top Category Filter Sub-Tabs with Action Button on Top Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('fuel-bowser')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'fuel-bowser'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/70'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>Fuel Tanker Purchases</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeSubTab === 'fuel-bowser' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {deliveries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('lubricants')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'lubricants'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/70'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Lubricants &amp; Oil Purchases</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeSubTab === 'lubricants' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {grnRecords.length}
            </span>
          </button>
        </div>

        {/* Top Right Context-Specific Action Button */}
        {activeSubTab === 'fuel-bowser' && (
          <button
            id="btn-add-fuel-purchase-top"
            onClick={() => {
              setFuelModalError(null);
              setDeliveryQty('');
              setDeliveryInvoiceNo('');
              setDeliverySupplier('Ceylon Petroleum Corporation');
              setIsFuelModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex-shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Purchase</span>
          </button>
        )}

        {activeSubTab === 'lubricants' && (
          <button
            id="btn-add-lube-purchase-top"
            onClick={() => handleOpenLubePurchaseModal('packaged')}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex-shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Purchase</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: FUEL TANKER PURCHASES */}
      {/* ========================================================================= */}
      {activeSubTab === 'fuel-bowser' && (
        <div className="space-y-4 animate-fade-in">
          {/* Fuel Purchases Records List Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Fuel Tanker Purchase Logs</h3>
              </div>
              <span className="text-xs text-gray-500 ">{deliveries.length} Records</span>
            </div>

            {deliveries.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <Fuel className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs">No fuel bowser purchases logged yet.</p>
                <button
                  onClick={() => {
                    setFuelModalError(null);
                    setDeliveryQty('');
                    setDeliveryInvoiceNo('');
                    setDeliverySupplier('Ceylon Petroleum Corporation');
                    setIsFuelModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Purchase</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Invoice / Delivery No</th>
                      <th className="py-3 px-4">Product &amp; Destination Tank</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4 text-right">Volume (L)</th>
                      <th className="py-3 px-4 text-right">Unit Rate (Rs.)</th>
                      <th className="py-3 px-4 text-right">Total Amount (Rs.)</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-800">
                    {deliveries.map(del => {
                      const matchedTank = tanks.find(t => t.id === del.tankId || t.fuelType === del.fuelType);
                      const unitRate = matchedTank?.pricePerLiter || 0;
                      const cost = del.cost || Math.round(del.quantity * unitRate);
                      const invoiceId = del.id.startsWith('DEL-') ? del.id : `INV-${del.id}`;

                      // Unified entry object for receipt modal
                      const unifiedObj: UnifiedPurchaseEntry = {
                        id: del.id,
                        date: del.date ? del.date.split('T')[0] : new Date().toISOString().split('T')[0],
                        category: 'Fuel Bowser',
                        supplier: del.supplier || 'Ceylon Petroleum Corporation',
                        invoiceNo: invoiceId,
                        description: `${del.fuelType} Bowser Delivery`,
                        destination: del.tankName || matchedTank?.name || 'Underground Storage Tank',
                        quantity: del.quantity,
                        unitLabel: 'L',
                        unitPrice: unitRate,
                        totalAmount: cost,
                        receivedBy: 'Bowser Receiving Team',
                        rawType: 'fuel'
                      };

                      return (
                        <tr 
                          key={del.id} 
                          onClick={() => openReceiptModal(unifiedObj)}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                            {del.date ? del.date.split('T')[0] : 'Today'}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {invoiceId}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/50">
                                {del.fuelType}
                              </span>
                              <span className="font-medium text-slate-700 text-[11px]">
                                {del.tankName || matchedTank?.name || 'Underground Tank'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{del.supplier || 'Ceylon Petroleum Corporation'}</td>
                          <td className="py-3 px-4 text-right font-extrabold tabular-nums text-slate-900 whitespace-nowrap">
                            {formatLiters(del.quantity)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600 tabular-nums whitespace-nowrap">
                            {formatCurrency(unitRate)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                            {formatCurrency(cost)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openReceiptModal(unifiedObj)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
                                title="Print / View Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDelivery(del.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: LUBRICANTS & OIL PURCHASES */}
      {/* ========================================================================= */}
      {activeSubTab === 'lubricants' && (
        <div className="space-y-4 animate-fade-in">
          {/* Lubricant Inward Stock List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Lubricant Purchase Logs</h3>
              </div>
              <span className="text-xs text-gray-500 ">{grnRecords.length} Records</span>
            </div>

            {grnRecords.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <Package className="w-8 h-8 mx-auto text-gray-300" />
                <p className="text-xs">No lubricant inward stock logged yet.</p>
                <button
                  onClick={() => handleOpenLubePurchaseModal('packaged')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Purchase</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Invoice / Ref No</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Items / Details</th>
                      <th className="py-3 px-4 text-right">Qty / Liters</th>
                      <th className="py-3 px-4 text-right">Total Amount (Rs.)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-800">
                    {grnRecords.map(grn => {
                      const isBulk = grn.type === 'bulk';
                      const details = isBulk 
                        ? (grn.tankName || 'Bulk Tank Refill')
                        : (grn.items || []).map(i => `${i.itemName} (${i.packageSize})`).join(', ');

                      const totalQty = isBulk 
                        ? (grn.litersReceived || 0)
                        : (grn.items || []).reduce((acc, i) => acc + i.quantity, 0);

                      const unitPrice = isBulk 
                        ? (grn.litersReceived ? Math.round(grn.totalAmount / grn.litersReceived) : 0)
                        : (totalQty ? Math.round(grn.totalAmount / totalQty) : 0);

                      const unifiedObj: UnifiedPurchaseEntry = {
                        id: grn.id,
                        date: grn.date,
                        category: isBulk ? 'Bulk Oil' : 'Packaged Lubricant',
                        supplier: grn.supplier,
                        invoiceNo: grn.invoiceNumber || grn.grnNumber,
                        description: details,
                        destination: isBulk ? (grn.tankName || 'Bulk Storage Tank') : 'Lubricant Retail Shelf / Store',
                        quantity: totalQty,
                        unitLabel: isBulk ? 'L' : 'units',
                        unitPrice: unitPrice,
                        totalAmount: grn.totalAmount,
                        receivedBy: grn.receivedBy,
                        rawType: 'lube_grn'
                      };

                      return (
                        <tr 
                          key={grn.id} 
                          onClick={() => openReceiptModal(unifiedObj)}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{grn.date}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block ">{grn.invoiceNumber || grn.grnNumber}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isBulk ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {isBulk ? 'Bulk Oil' : 'Packaged'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{grn.supplier}</td>
                          <td className="py-3 px-4 max-w-[240px] truncate text-slate-700 font-medium" title={details}>
                            {details}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900 whitespace-nowrap">
                            {totalQty} {isBulk ? 'L' : 'units'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                            {formatCurrency(grn.totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openReceiptModal(unifiedObj)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
                                title="Print / View Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteGRN(grn.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FUEL BOWSER PURCHASE MODAL (EXACT EXISTING FORM STRUCTURE) */}
      {/* ========================================================================= */}
      {isFuelModalOpen && (
        <div id="fuel-delivery-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="fuel-delivery-modal-card" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <span>New Fuel Bowser Delivery</span>
              </h3>
              <button onClick={() => setIsFuelModalOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {fuelModalError && (
                <div className="p-3 bg-red-500/10 text-red-600 rounded-xl text-xs flex items-start gap-2 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{fuelModalError}</span>
                </div>
              )}

              {/* Target Storage Tank Selector */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Target Storage Tank</span>
                  <span className="text-blue-600 text-[11px] font-bold">Required</span>
                </label>
                <select
                  id="purchase-target-tank"
                  value={selectedTankId || (sortedTanks[0]?.id || '')}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setSelectedTankId(tId);
                    const tank = sortedTanks.find(t => t.id === tId);
                    if (tank) setDeliveryFuelType(tank.fuelType);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {sortedTanks.map((t) => {
                    const freeSpace = Math.max(0, t.capacity - t.currentLevel);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.fuelType}) — Free Space: {formatLiters(freeSpace)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Volume Quantity to add */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Delivery Volume (Liters)
                </label>
                <input
                  id="purchase-delivery-qty"
                  type="number"
                  step="0.01"
                  value={deliveryQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDeliveryQty(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Supplier name */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Supplier Name
                </label>
                <input
                  id="purchase-supplier-name"
                  type="text"
                  value={deliverySupplier}
                  onChange={(e) => setDeliverySupplier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Ceylon Petroleum Corporation"
                />
              </div>

              {/* Invoice Number */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Invoice / Ref Number
                </label>
                <input
                  id="purchase-invoice-no"
                  type="text"
                  value={deliveryInvoiceNo}
                  onChange={(e) => setDeliveryInvoiceNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. INV-2026-8891"
                />
              </div>

              {/* Delivery Date */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Delivery Date
                </label>
                <input
                  id="purchase-delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsFuelModalOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFuelDeliverySubmit}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                Confirm Purchase &amp; Receive Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OIL & LUBRICANT PURCHASE / INWARD STOCK MODAL */}
      {/* ========================================================================= */}
      {isLubeModalOpen && (
        <div id="lube-delivery-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="lube-delivery-modal-card" className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg flex items-center gap-2">
                <Droplets className="w-5 h-5 text-emerald-600" />
                <span>Receive Oil / Lubricant Inward Stock</span>
              </h3>
              <button onClick={() => setIsLubeModalOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {lubeModalError && (
                <div className="p-3 bg-red-500/10 text-red-600 rounded-xl text-xs flex items-start gap-2 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{lubeModalError}</span>
                </div>
              )}

              {/* Purchase Type Selector */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Lubricant Category / Product Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchLubeType('packaged')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      lubePurchaseType === 'packaged'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Packaged Bottles &amp; Cans</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchLubeType('bulk')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      lubePurchaseType === 'bulk'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    <span>Bulk Oil Tank Refill</span>
                  </button>
                </div>
              </div>

              {/* Item Selector (If packaged) */}
              {lubePurchaseType === 'packaged' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Select Packaged Lubricant Product
                    </label>
                    <span className="text-[11px] text-gray-400">
                      {packagedItems.length} Products in Catalog
                    </span>
                  </div>
                  {packagedItems.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                      No packaged lubricants found in catalog.
                    </div>
                  ) : (
                    <select
                      id="select-packaged-lube-product"
                      value={selectedPackagedItemId}
                      onChange={(e) => {
                        setSelectedPackagedItemId(e.target.value);
                        const it = packagedItems.find(p => p.id === e.target.value);
                        if (it && it.unitCost) {
                          setLubeUnitCost(it.unitCost);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {packagedItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {item.grade} • {item.packageSize} | In Stock: {item.currentStock} units
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Select Target Bulk Oil Tank / Barrel
                    </label>
                    <span className="text-[11px] text-gray-400">
                      {oilTanks.length} Tanks / Drums Available
                    </span>
                  </div>
                  {oilTanks.length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                      No bulk oil tanks configured yet.
                    </div>
                  ) : (
                    <select
                      id="select-bulk-oil-tank-target"
                      value={lubeTargetOilTankId}
                      onChange={(e) => {
                        setLubeTargetOilTankId(e.target.value);
                        const tank = oilTanks.find(t => t.id === e.target.value);
                        if (tank && tank.pricePerLiter) {
                          setLubeUnitCost(tank.pricePerLiter);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {oilTanks.map(tank => (
                        <option key={tank.id} value={tank.id}>
                          {tank.name} ({tank.grade}) — Stock: {tank.currentLevel} / {tank.capacity} L (Free: {Math.max(0, tank.capacity - tank.currentLevel)} L)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Quantity & Unit Cost Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    {lubePurchaseType === 'packaged' ? 'Quantity (Units)' : 'Volume (Liters)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 24"
                    value={lubeQuantity}
                    onChange={(e) => setLubeQuantity(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Unit Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1950"
                    value={lubeUnitCost}
                    onChange={(e) => setLubeUnitCost(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Supplier & Invoice */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={lubeSupplier}
                    onChange={(e) => setLubeSupplier(e.target.value)}
                    placeholder="e.g. Chevron Lanka"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Invoice / Ref No
                  </label>
                  <input
                    type="text"
                    value={lubeInvoiceNo}
                    onChange={(e) => setLubeInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-CHEV-9901"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Date & Received By */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Inward Date
                  </label>
                  <input
                    type="date"
                    value={lubeDeliveryDate}
                    onChange={(e) => setLubeDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Received By
                  </label>
                  <input
                    type="text"
                    value={lubeReceivedBy}
                    onChange={(e) => setLubeReceivedBy(e.target.value)}
                    placeholder="Supervisor Name"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Calculated Total Cost Preview */}
              {lubeQuantity && lubeUnitCost ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Total Purchase Amount:</span>
                  <span className="text-sm font-extrabold text-emerald-800 tabular-nums">
                    {formatCurrency(Number(lubeQuantity) * Number(lubeUnitCost))}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsLubeModalOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLubePurchaseSubmit}
                className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-all cursor-pointer shadow-sm"
              >
                Confirm Inward Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PRINTABLE PURCHASE INVOICE / PURCHASE RECEIPT MODAL */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && selectedReceiptPurchase && (
        <div 
          id="purchase-invoice-modal-overlay" 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fade-in print:p-0 print:bg-transparent print:backdrop-blur-none print:static print:inset-auto"
        >
          <div 
            id="purchase-invoice-modal-card" 
            className="bg-white rounded-2xl max-w-[900px] w-full shadow-2xl border border-gray-200 overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none print:bg-transparent print:m-0"
          >
            {/* Modal Top Control Bar (Hidden when printing) */}
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                  {receiptConfig.documentTitle} Preview
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-blue-300 font-bold">
                  {selectedReceiptPurchase.invoiceNo}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-print-receipt-modal"
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs hover:opacity-90"
                  style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet (900px format) */}
            <div 
              id="printable-purchase-receipt"
              ref={receiptPrintRef}
              className="p-6 sm:p-10 bg-white text-slate-900 space-y-6 font-sans print:p-0 print:m-0"
              style={{ minHeight: '600px' }}
            >
              {/* 1. Exact Header & Branding Styling */}
              <div className="pb-4" style={{ borderBottom: `3px solid ${receiptConfig.primaryBrandColor}` }}>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {/* Left: Company Branding */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      {receiptConfig.logoUrl ? (
                        <img 
                          src={receiptConfig.logoUrl} 
                          alt="Logo" 
                          className="w-10 h-10 object-contain rounded-lg shadow-2xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-base shadow-xs"
                          style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                        >
                          {receiptConfig.companyName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h1 
                          className="text-xl sm:text-2xl font-black tracking-tight uppercase" 
                          style={{ color: receiptConfig.primaryBrandColor }}
                        >
                          {receiptConfig.companyName}
                        </h1>
                        <p className="text-xs font-medium italic text-slate-600">
                          {receiptConfig.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 pt-1 space-y-0.5">
                      <p>{receiptConfig.address}</p>
                      <p className="text-slate-500">
                        Tel: {receiptConfig.contactPhone} | Email: {receiptConfig.email}
                      </p>
                      <p className="text-[10px] text-slate-400 ">
                        CPC Dealer Code: {receiptConfig.dealerCode} • Business Reg: {receiptConfig.regNo}
                      </p>
                    </div>
                  </div>

                  {/* Right: Title & Receipt Meta */}
                  <div className="sm:text-right space-y-1">
                    <h2 
                      className="text-2xl font-black tracking-wider uppercase font-sans" 
                      style={{ color: receiptConfig.primaryBrandColor }}
                    >
                      {receiptConfig.documentTitle}
                    </h2>
                    <div className="text-xs font-bold">
                      <span className="text-slate-500 font-normal">Receipt No: </span>
                      <span style={{ color: receiptConfig.accentColor }} className="font-extrabold text-sm">
                        {selectedReceiptPurchase.invoiceNo.startsWith(receiptConfig.receiptNoPrefix) 
                          ? selectedReceiptPurchase.invoiceNo 
                          : `${receiptConfig.receiptNoPrefix}${selectedReceiptPurchase.invoiceNo.replace(/[^a-zA-Z0-9-]/g, '')}`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="text-slate-500 font-normal">Date &amp; Time: </span>
                      <span className="font-bold text-slate-800">{selectedReceiptPurchase.date} • 10:30 AM</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="text-slate-400">Payment Terms: </span>
                      <span className="font-semibold text-slate-700">Bank Transfer / Advance</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Dual Info Boxes Grid (info-grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box 1: SUPPLIER DETAILS */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div 
                    className="px-3.5 py-2 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between"
                    style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                  >
                    <span>SUPPLIER DETAILS</span>
                    <Building2 className="w-3.5 h-3.5 opacity-80" />
                  </div>
                  <div className="p-3.5 bg-slate-50/60 text-xs space-y-1.5 text-slate-700">
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Supplier Name:</span>
                      <span className="font-bold text-slate-900 text-right">{selectedReceiptPurchase.supplier}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Terminal / Address:</span>
                      <span className="font-medium text-slate-800 text-right">
                        {selectedReceiptPurchase.supplier.toLowerCase().includes('petroleum') 
                          ? 'Kolonnawa Terminal, CPSTL Installation, Colombo' 
                          : 'Industrial Zone, Retail Oil Depot, Colombo'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Contact No:</span>
                      <span className="text-slate-800 text-right">+94 11 257 2000 / +94 11 257 2001</span>
                    </div>
                  </div>
                </div>

                {/* Box 2: PURCHASE DETAILS */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div 
                    className="px-3.5 py-2 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-between"
                    style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                  >
                    <span>PURCHASE DETAILS</span>
                    <Truck className="w-3.5 h-3.5 opacity-80" />
                  </div>
                  <div className="p-3.5 bg-slate-50/60 text-xs space-y-1.5 text-slate-700">
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Purchase Type:</span>
                      <span className="font-bold text-slate-900 text-right">{selectedReceiptPurchase.category}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Reference / Invoice:</span>
                      <span className="font-bold text-slate-900 text-right">{selectedReceiptPurchase.invoiceNo}</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Delivery Note No:</span>
                      <span className="text-slate-800 text-right">
                        DN-{selectedReceiptPurchase.id.replace(/[^0-9]/g, '') || '884920'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-500 font-medium">Vehicle / Truck No:</span>
                      <span className="font-bold text-slate-900 text-right">
                        {selectedReceiptPurchase.rawType === 'fuel' ? 'WP-LI-8492 (Bowser Tanker)' : 'WP-NB-3391 (Delivery Van)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Items Table (purchase-table) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead 
                    className="text-white font-bold uppercase text-[10px] tracking-wider"
                    style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                  >
                    <tr>
                      <th className="py-2.5 px-3.5 text-center w-10">#</th>
                      <th className="py-2.5 px-3.5">Item Description</th>
                      <th className="py-2.5 px-3.5 text-center">Unit</th>
                      <th className="py-2.5 px-3.5 text-right">Quantity</th>
                      <th className="py-2.5 px-3.5 text-right">Unit Price (LKR)</th>
                      <th className="py-2.5 px-3.5 text-right">Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                    <tr>
                      <td className="py-3 px-3.5 text-center text-slate-500 font-bold">1</td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{selectedReceiptPurchase.description}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Destination: <span className="font-semibold text-slate-700">{selectedReceiptPurchase.destination}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center font-medium text-slate-600">
                        {selectedReceiptPurchase.unitLabel}
                      </td>
                      <td className="py-3 px-3.5 text-right font-bold tabular-nums text-slate-900">
                        {selectedReceiptPurchase.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-right tabular-nums text-slate-700">
                        {formatCurrency(selectedReceiptPurchase.unitPrice)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-extrabold tabular-nums text-slate-900">
                        {formatCurrency(selectedReceiptPurchase.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. Bottom Section & Calculations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Left: REMARKS box with border #d8dee8 */}
                <div 
                  className="rounded-xl p-3.5 bg-slate-50/70 text-xs space-y-1.5"
                  style={{ border: '1px solid #d8dee8' }}
                >
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>REMARKS &amp; VERIFICATION NOTES</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {receiptConfig.defaultRemarks}
                  </p>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                    <span>Decanting Bay: Pump Island #1</span>
                    <span>Density: 0.832 @ 15°C</span>
                  </div>
                </div>

                {/* Right: Totals Card */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
                  <div className="p-3 bg-slate-50 space-y-1.5 ">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Sub Total:</span>
                      <span className="font-bold tabular-nums text-slate-900">
                        {formatCurrency(selectedReceiptPurchase.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Discount (0.0%):</span>
                      <span className="tabular-nums">Rs. 0.00</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>VAT / Taxes (Included):</span>
                      <span className="tabular-nums">Rs. 0.00</span>
                    </div>
                  </div>

                  {/* Solid Grand Total banner */}
                  <div 
                    className="p-3.5 text-white flex items-center justify-between"
                    style={{ backgroundColor: receiptConfig.primaryBrandColor }}
                  >
                    <span className="font-extrabold uppercase tracking-wider text-xs">
                      GRAND TOTAL (LKR):
                    </span>
                    <span className="font-black text-base sm:text-lg tabular-nums">
                      {formatCurrency(selectedReceiptPurchase.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Signatures Section */}
              <div className="pt-6 border-t border-dashed border-slate-300">
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  {/* Prepared By */}
                  <div className="space-y-6">
                    <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1">
                      <span className="text-[10px] text-slate-400 italic ">
                        {selectedReceiptPurchase.receivedBy || 'Station Staff'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine1Title}</p>
                      <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine1Sub}</p>
                    </div>
                  </div>

                  {/* Received By */}
                  <div className="space-y-6">
                    <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1">
                      <span className="text-[10px] text-slate-400 italic ">CPC Bowser Driver</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine2Title}</p>
                      <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine2Sub}</p>
                    </div>
                  </div>

                  {/* Authorized By */}
                  <div className="space-y-6">
                    <div className="h-10 border-b border-slate-400 flex items-end justify-center pb-1">
                      <span className="text-[10px] text-slate-400 italic ">Station Manager</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[11px]">{receiptConfig.signatureLine3Title}</p>
                      <p className="text-[10px] text-slate-500">{receiptConfig.signatureLine3Sub}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Footer */}
              <div 
                className="pt-3 text-center text-[10px] text-slate-500 font-sans"
                style={{ borderTop: `1px solid ${receiptConfig.primaryBrandColor}` }}
              >
                <p className="font-medium text-slate-600">
                  {receiptConfig.footerNote}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 ">
                  {receiptConfig.footerDisclaimer}
                </p>
              </div>
            </div>

            {/* Modal Bottom Footer (Hidden when printing) */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between print:hidden">
              <span className="text-xs text-gray-500">
                Click <span className="font-semibold text-slate-700">Print Receipt</span> to print or save as PDF.
              </span>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
