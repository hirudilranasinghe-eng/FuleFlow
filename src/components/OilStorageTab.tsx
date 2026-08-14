/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Droplets, Package, Truck, Users, Plus, Search, 
  AlertTriangle, CheckCircle2, DollarSign, Calendar, 
  ArrowDownRight, ArrowUpRight, Filter, Edit2, Trash2, 
  RefreshCw, Layers, ShieldAlert, ShoppingCart, FileText,
  Clock, Check, X, Tag, BarChart3, AlertCircle
} from 'lucide-react';
import { OilTank, PackagedOilItem, OilGRNRecord, PumperOilAllocation, Employee } from '../types';
import { supabase } from '../lib/supabase';
import { saveOilTank } from '../lib/supabaseClient';

interface OilStorageTabProps {
  oilTanks: OilTank[];
  setOilTanks: React.Dispatch<React.SetStateAction<OilTank[]>>;
  employees?: Employee[];
}

export default function OilStorageTab({
  oilTanks,
  setOilTanks,
  employees = []
}: OilStorageTabProps) {
  // Sub-tabs: 'bulk' | 'packaged' | 'grn' | 'allocation'
  const [activeSubTab, setActiveSubTab] = useState<'bulk' | 'packaged' | 'grn' | 'allocation'>('bulk');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Currency Formatter (Sri Lankan Rupees)
  const formatCurrency = (val: number) => {
    return `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // -------------------------------------------------------------
  // 1. PACKAGED BOTTLES INVENTORY STATE
  // -------------------------------------------------------------
  const [packagedItems, setPackagedItems] = useState<PackagedOilItem[]>(() => {
    try {
      const stored = localStorage.getItem('fms_packaged_oil_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      { id: 'pkg-01', name: 'Caltex Havoline Super 4T 20W-40', category: 'Engine Oil', grade: '20W-40', packageSize: '1L Bottle', currentStock: 48, minReorderLevel: 15, unitCost: 1950, retailPrice: 2350, location: 'Bay A1' },
      { id: 'pkg-02', name: 'Lanka 2T Super Two Stroke Oil', category: '2T/4T Oil', grade: '2T Super', packageSize: '500ml Bottle', currentStock: 82, minReorderLevel: 25, unitCost: 780, retailPrice: 950, location: 'Bay A2' },
      { id: 'pkg-03', name: 'Castrol GTX 20W-50 Engine Oil', category: 'Engine Oil', grade: '20W-50', packageSize: '4L Can', currentStock: 14, minReorderLevel: 8, unitCost: 7600, retailPrice: 8900, location: 'Shelf B1' },
      { id: 'pkg-04', name: 'Mobil 1 Fully Synthetic 5W-30', category: 'Engine Oil', grade: '5W-30', packageSize: '4L Can', currentStock: 6, minReorderLevel: 10, unitCost: 14200, retailPrice: 16800, location: 'Shelf B2' },
      { id: 'pkg-05', name: 'Caltex Brake Fluid Heavy Duty DOT 4', category: 'Brake Fluid', grade: 'DOT 4', packageSize: '500ml Can', currentStock: 28, minReorderLevel: 12, unitCost: 850, retailPrice: 1100, location: 'Bay C1' },
      { id: 'pkg-06', name: 'Prestone Radiator Coolant 50/50 Premix', category: 'Coolant', grade: 'Premix 50/50', packageSize: '1L Bottle', currentStock: 34, minReorderLevel: 15, unitCost: 1100, retailPrice: 1450, location: 'Bay C2' },
      { id: 'pkg-07', name: 'Lanka Auto Gear EP 90', category: 'Gear Oil', grade: 'EP 90', packageSize: '1L Bottle', currentStock: 19, minReorderLevel: 10, unitCost: 1650, retailPrice: 2050, location: 'Shelf D1' },
      { id: 'pkg-08', name: 'Lanka 2T Pouch Mini Pack', category: '2T/4T Oil', grade: '2T Super', packageSize: '200ml Pouch', currentStock: 110, minReorderLevel: 40, unitCost: 320, retailPrice: 420, location: 'Front Counter' },
    ];
  });

  // Save Packaged Items whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('fms_packaged_oil_items', JSON.stringify(packagedItems));
    } catch (_) {}
  }, [packagedItems]);

  // -------------------------------------------------------------
  // 2. GOODS RECEIVED NOTE (GRN) RECORDS
  // -------------------------------------------------------------
  const [grnRecords, setGrnRecords] = useState<OilGRNRecord[]>(() => {
    try {
      const stored = localStorage.getItem('fms_oil_grn_records');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: 'grn-01',
        grnNumber: 'GRN-OIL-2026-042',
        date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        supplier: 'Chevron Lubricants Lanka PLC',
        invoiceNumber: 'INV-CHEV-8891',
        type: 'packaged',
        items: [
          { itemId: 'pkg-01', itemName: 'Caltex Havoline Super 4T 20W-40', packageSize: '1L Bottle', quantity: 36, unitCost: 1950, totalCost: 70200 },
          { itemId: 'pkg-05', itemName: 'Caltex Brake Fluid Heavy Duty DOT 4', packageSize: '500ml Can', quantity: 24, unitCost: 850, totalCost: 20400 }
        ],
        totalAmount: 90600,
        receivedBy: 'Supervisor S. Perera',
        notes: 'Monthly standard retail batch received in intact condition.'
      },
      {
        id: 'grn-02',
        grnNumber: 'GRN-OIL-2026-041',
        date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        supplier: 'Ceylon Petroleum Corporation (Lanka IOC/CPC)',
        invoiceNumber: 'CPC-BULK-3419',
        type: 'bulk',
        tankId: 'oil-tank-01',
        tankName: 'Oil Tank 01 (Caltex 20W-50)',
        litersReceived: 500,
        totalAmount: 1100000,
        receivedBy: 'Manager R. Anjana',
        notes: 'Bulk oil barrel refill into Main Underground Oil Tank 01.'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('fms_oil_grn_records', JSON.stringify(grnRecords));
    } catch (_) {}
  }, [grnRecords]);

  // -------------------------------------------------------------
  // 3. PUMPER OIL ALLOCATIONS STATE
  // -------------------------------------------------------------
  const [allocations, setAllocations] = useState<PumperOilAllocation[]>(() => {
    try {
      const stored = localStorage.getItem('fms_oil_pumper_allocations');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: 'alloc-01',
        date: new Date().toISOString().split('T')[0],
        shiftName: 'Morning Shift (06:00 - 14:00)',
        pumperId: employees[0]?.id || 'emp-01',
        pumperName: employees[0]?.name || 'Nimal Bandara',
        itemId: 'pkg-02',
        itemName: 'Lanka 2T Super Two Stroke Oil',
        packageSize: '500ml Bottle',
        unitPrice: 950,
        issuedQty: 10,
        returnedQty: 3,
        soldQty: 7,
        totalAmount: 6650,
        status: 'Reconciled',
        notes: 'Morning shift cash handed over with shift sales.'
      },
      {
        id: 'alloc-02',
        date: new Date().toISOString().split('T')[0],
        shiftName: 'Evening Shift (14:00 - 22:00)',
        pumperId: employees[1]?.id || 'emp-02',
        pumperName: employees[1]?.name || 'Kamal Silva',
        itemId: 'pkg-08',
        itemName: 'Lanka 2T Pouch Mini Pack',
        packageSize: '200ml Pouch',
        unitPrice: 420,
        issuedQty: 20,
        returnedQty: 0,
        soldQty: 0,
        totalAmount: 0,
        status: 'Issued',
        notes: 'Active shift allocation on dispenser island.'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('fms_oil_pumper_allocations', JSON.stringify(allocations));
    } catch (_) {}
  }, [allocations]);

  // -------------------------------------------------------------
  // COMPUTED KPI METRICS
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    // Bulk tanks stats
    const totalBulkLiters = oilTanks.reduce((sum, t) => sum + (t.currentLevel || 0), 0);
    const totalBulkCapacity = oilTanks.reduce((sum, t) => sum + (t.capacity || 0), 0);
    const totalBulkValue = oilTanks.reduce((sum, t) => sum + ((t.currentLevel || 0) * (t.pricePerLiter || 0)), 0);

    // Packaged bottles stats
    const totalBottles = packagedItems.reduce((sum, i) => sum + (i.currentStock || 0), 0);
    const totalPackagedValue = packagedItems.reduce((sum, i) => sum + ((i.currentStock || 0) * (i.retailPrice || 0)), 0);
    const lowStockItems = packagedItems.filter(i => i.currentStock <= i.minReorderLevel);

    // Active allocations
    const activeAllocationsCount = allocations.filter(a => a.status === 'Issued').length;
    const todaySalesAmount = allocations
      .filter(a => a.date === new Date().toISOString().split('T')[0])
      .reduce((sum, a) => sum + (a.totalAmount || 0), 0);

    return {
      totalBulkLiters,
      totalBulkCapacity,
      totalBulkValue,
      totalBottles,
      totalPackagedValue,
      lowStockCount: lowStockItems.length,
      activeAllocationsCount,
      todaySalesAmount,
      totalCombinedValue: totalBulkValue + totalPackagedValue
    };
  }, [oilTanks, packagedItems, allocations]);

  // -------------------------------------------------------------
  // MODAL STATES
  // -------------------------------------------------------------
  // 1. GRN Modal
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [grnType, setGrnType] = useState<'packaged' | 'bulk'>('packaged');
  const [grnSupplier, setGrnSupplier] = useState('Chevron Lubricants Lanka PLC');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnNotes, setGrnNotes] = useState('');
  const [grnReceivedBy, setGrnReceivedBy] = useState('Manager');
  // GRN Bulk fields
  const [grnBulkTankId, setGrnBulkTankId] = useState(oilTanks[0]?.id || '');
  const [grnBulkLiters, setGrnBulkLiters] = useState<number>(200);
  const [grnBulkCostPerLiter, setGrnBulkCostPerLiter] = useState<number>(2200);
  // GRN Packaged fields
  const [grnSelectedItemId, setGrnSelectedItemId] = useState(packagedItems[0]?.id || '');
  const [grnItemQty, setGrnItemQty] = useState<number>(24);
  const [grnItemCost, setGrnItemCost] = useState<number>(1950);

  // 2. Quick Retail Sale Modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleItemId, setSaleItemId] = useState(packagedItems[0]?.id || '');
  const [saleQty, setSaleQty] = useState<number>(1);
  const [saleCustomerName, setSaleCustomerName] = useState('Walk-in Customer');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'Cash' | 'Card' | 'Credit'>('Cash');
  const [saleNotes, setSaleNotes] = useState('');

  // 3. Add / Edit Packaged Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagedOilItem | null>(null);
  const [itemFormName, setItemFormName] = useState('');
  const [itemFormCategory, setItemFormCategory] = useState<PackagedOilItem['category']>('Engine Oil');
  const [itemFormGrade, setItemFormGrade] = useState('20W-40');
  const [itemFormSize, setItemFormSize] = useState('1L Bottle');
  const [itemFormStock, setItemFormStock] = useState<number>(20);
  const [itemFormMinStock, setItemFormMinStock] = useState<number>(10);
  const [itemFormCost, setItemFormCost] = useState<number>(1800);
  const [itemFormPrice, setItemFormPrice] = useState<number>(2200);
  const [itemFormLocation, setItemFormLocation] = useState('Bay A1');

  // 4. Pumper Allocation Modal
  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);
  const [allocPumperId, setAllocPumperId] = useState(employees[0]?.id || 'emp-01');
  const [allocShiftName, setAllocShiftName] = useState('Morning Shift (06:00 - 14:00)');
  const [allocItemId, setAllocItemId] = useState(packagedItems[0]?.id || '');
  const [allocIssuedQty, setAllocIssuedQty] = useState<number>(10);
  const [allocNotes, setAllocNotes] = useState('');

  // 5. Reconcile Allocation Modal
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [reconcilingAlloc, setReconcilingAlloc] = useState<PumperOilAllocation | null>(null);
  const [reconcileReturnedQty, setReconcileReturnedQty] = useState<number>(0);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleOpenGRNModal = () => {
    if (oilTanks.length > 0 && !grnBulkTankId) setGrnBulkTankId(oilTanks[0].id);
    if (packagedItems.length > 0 && !grnSelectedItemId) setGrnSelectedItemId(packagedItems[0].id);
    setGrnInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsGRNModalOpen(true);
  };

  const handleOpenSaleModal = () => {
    if (packagedItems.length > 0 && !saleItemId) setSaleItemId(packagedItems[0].id);
    setSaleQty(1);
    setIsSaleModalOpen(true);
  };

  const handleOpenAddItemModal = () => {
    setEditingItem(null);
    setItemFormName('');
    setItemFormCategory('Engine Oil');
    setItemFormGrade('20W-40');
    setItemFormSize('1L Bottle');
    setItemFormStock(20);
    setItemFormMinStock(10);
    setItemFormCost(1800);
    setItemFormPrice(2200);
    setItemFormLocation('Bay A1');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItemModal = (item: PackagedOilItem) => {
    setEditingItem(item);
    setItemFormName(item.name);
    setItemFormCategory(item.category);
    setItemFormGrade(item.grade);
    setItemFormSize(item.packageSize);
    setItemFormStock(item.currentStock);
    setItemFormMinStock(item.minReorderLevel);
    setItemFormCost(item.unitCost);
    setItemFormPrice(item.retailPrice);
    setItemFormLocation(item.location || 'Bay A1');
    setIsItemModalOpen(true);
  };

  // Submit GRN
  const handleSaveGRNSubmit = async () => {
    if (!grnSupplier.trim()) {
      alert('Supplier name is required.');
      return;
    }
    if (!grnInvoiceNo.trim()) {
      alert('Invoice number is required.');
      return;
    }

    const grnId = `grn-${Date.now().toString().slice(-6)}`;
    const grnNum = `GRN-OIL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    if (grnType === 'bulk') {
      const targetTank = oilTanks.find(t => t.id === grnBulkTankId);
      if (!targetTank) {
        alert('Please select a valid Oil Storage Tank.');
        return;
      }
      if (grnBulkLiters <= 0) {
        alert('Received volume must be greater than 0 liters.');
        return;
      }

      const newLevel = Math.min(targetTank.capacity, targetTank.currentLevel + grnBulkLiters);
      const updatedTank: OilTank = {
        ...targetTank,
        currentLevel: newLevel
      };

      const nextTanks = oilTanks.map(t => t.id === targetTank.id ? updatedTank : t);
      setOilTanks(nextTanks);
      try { localStorage.setItem('fms_oil_tanks', JSON.stringify(nextTanks)); } catch (_) {}
      await saveOilTank(supabase, updatedTank);

      const totalVal = grnBulkLiters * (grnBulkCostPerLiter || updatedTank.pricePerLiter);
      const newGRN: OilGRNRecord = {
        id: grnId,
        grnNumber: grnNum,
        date: grnDate,
        supplier: grnSupplier,
        invoiceNumber: grnInvoiceNo,
        type: 'bulk',
        tankId: targetTank.id,
        tankName: `${targetTank.name} (${targetTank.grade})`,
        litersReceived: grnBulkLiters,
        totalAmount: totalVal,
        receivedBy: grnReceivedBy,
        notes: grnNotes || `Received ${grnBulkLiters}L into ${targetTank.name}.`
      };

      setGrnRecords([newGRN, ...grnRecords]);
      setIsGRNModalOpen(false);
      showToast(`GRN created: Added ${grnBulkLiters}L bulk oil to ${targetTank.name}`);
    } else {
      const targetItem = packagedItems.find(i => i.id === grnSelectedItemId);
      if (!targetItem) {
        alert('Please select an inventory item.');
        return;
      }
      if (grnItemQty <= 0) {
        alert('Received quantity must be greater than 0.');
        return;
      }

      const updatedItem: PackagedOilItem = {
        ...targetItem,
        currentStock: targetItem.currentStock + grnItemQty,
        unitCost: grnItemCost > 0 ? grnItemCost : targetItem.unitCost
      };

      const nextItems = packagedItems.map(i => i.id === targetItem.id ? updatedItem : i);
      setPackagedItems(nextItems);

      const totalVal = grnItemQty * grnItemCost;
      const newGRN: OilGRNRecord = {
        id: grnId,
        grnNumber: grnNum,
        date: grnDate,
        supplier: grnSupplier,
        invoiceNumber: grnInvoiceNo,
        type: 'packaged',
        items: [
          {
            itemId: targetItem.id,
            itemName: targetItem.name,
            packageSize: targetItem.packageSize,
            quantity: grnItemQty,
            unitCost: grnItemCost,
            totalCost: totalVal
          }
        ],
        totalAmount: totalVal,
        receivedBy: grnReceivedBy,
        notes: grnNotes || `Received ${grnItemQty} units of ${targetItem.name}.`
      };

      setGrnRecords([newGRN, ...grnRecords]);
      setIsGRNModalOpen(false);
      showToast(`GRN created: Added +${grnItemQty} bottles to ${targetItem.name}`);
    }
  };

  // Submit Retail Sale
  const handleSaveSaleSubmit = () => {
    const targetItem = packagedItems.find(i => i.id === saleItemId);
    if (!targetItem) {
      alert('Please select an item.');
      return;
    }
    if (saleQty <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }
    if (targetItem.currentStock < saleQty) {
      alert(`Insufficient stock! Available stock is only ${targetItem.currentStock} units.`);
      return;
    }

    const updatedItem: PackagedOilItem = {
      ...targetItem,
      currentStock: targetItem.currentStock - saleQty
    };

    const nextItems = packagedItems.map(i => i.id === targetItem.id ? updatedItem : i);
    setPackagedItems(nextItems);

    const saleAmount = saleQty * targetItem.retailPrice;
    setIsSaleModalOpen(false);
    showToast(`Sale completed: ${saleQty}x ${targetItem.name} (${formatCurrency(saleAmount)})`);
  };

  // Save Packaged Item (Add or Edit)
  const handleSaveItemSubmit = () => {
    if (!itemFormName.trim()) {
      alert('Item name is required.');
      return;
    }
    if (itemFormStock < 0 || itemFormPrice < 0) {
      alert('Stock and price cannot be negative.');
      return;
    }

    if (editingItem) {
      const updated: PackagedOilItem = {
        ...editingItem,
        name: itemFormName.trim(),
        category: itemFormCategory,
        grade: itemFormGrade.trim(),
        packageSize: itemFormSize.trim(),
        currentStock: Number(itemFormStock) || 0,
        minReorderLevel: Number(itemFormMinStock) || 0,
        unitCost: Number(itemFormCost) || 0,
        retailPrice: Number(itemFormPrice) || 0,
        location: itemFormLocation.trim()
      };

      setPackagedItems(packagedItems.map(i => i.id === editingItem.id ? updated : i));
      setIsItemModalOpen(false);
      showToast(`Updated product "${updated.name}"`);
    } else {
      const newItem: PackagedOilItem = {
        id: `pkg-${Date.now().toString().slice(-6)}`,
        name: itemFormName.trim(),
        category: itemFormCategory,
        grade: itemFormGrade.trim(),
        packageSize: itemFormSize.trim(),
        currentStock: Number(itemFormStock) || 0,
        minReorderLevel: Number(itemFormMinStock) || 0,
        unitCost: Number(itemFormCost) || 0,
        retailPrice: Number(itemFormPrice) || 0,
        location: itemFormLocation.trim()
      };

      setPackagedItems([...packagedItems, newItem]);
      setIsItemModalOpen(false);
      showToast(`Added product "${newItem.name}" to catalog`);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const target = packagedItems.find(i => i.id === itemId);
    if (!target) return;
    if (confirm(`Are you sure you want to delete "${target.name}"?`)) {
      setPackagedItems(packagedItems.filter(i => i.id !== itemId));
      showToast(`Deleted "${target.name}"`);
    }
  };

  // Submit Pumper Issue Allocation
  const handleSaveAllocSubmit = () => {
    const targetItem = packagedItems.find(i => i.id === allocItemId);
    const targetPumper = employees.find(e => e.id === allocPumperId) || { name: 'Pumper' };

    if (!targetItem) {
      alert('Please select an item.');
      return;
    }
    if (allocIssuedQty <= 0) {
      alert('Issued quantity must be greater than 0.');
      return;
    }
    if (targetItem.currentStock < allocIssuedQty) {
      alert(`Insufficient stock! Current stock is only ${targetItem.currentStock} units.`);
      return;
    }

    // Deduct stock immediately upon issue
    const updatedItem: PackagedOilItem = {
      ...targetItem,
      currentStock: targetItem.currentStock - allocIssuedQty
    };
    setPackagedItems(packagedItems.map(i => i.id === targetItem.id ? updatedItem : i));

    const newAlloc: PumperOilAllocation = {
      id: `alloc-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      shiftName: allocShiftName,
      pumperId: allocPumperId,
      pumperName: targetPumper.name,
      itemId: targetItem.id,
      itemName: targetItem.name,
      packageSize: targetItem.packageSize,
      unitPrice: targetItem.retailPrice,
      issuedQty: allocIssuedQty,
      returnedQty: 0,
      soldQty: 0,
      totalAmount: 0,
      status: 'Issued',
      notes: allocNotes
    };

    setAllocations([newAlloc, ...allocations]);
    setIsAllocModalOpen(false);
    showToast(`Issued ${allocIssuedQty}x ${targetItem.name} to ${targetPumper.name}`);
  };

  // Submit Reconcile
  const handleReconcileSubmit = () => {
    if (!reconcilingAlloc) return;
    if (reconcileReturnedQty < 0 || reconcileReturnedQty > reconcilingAlloc.issuedQty) {
      alert(`Returned count must be between 0 and ${reconcilingAlloc.issuedQty}.`);
      return;
    }

    const soldQty = reconcilingAlloc.issuedQty - reconcileReturnedQty;
    const totalAmount = soldQty * reconcilingAlloc.unitPrice;

    // Put returned items back into stock
    if (reconcileReturnedQty > 0) {
      const targetItem = packagedItems.find(i => i.id === reconcilingAlloc.itemId);
      if (targetItem) {
        const updatedItem: PackagedOilItem = {
          ...targetItem,
          currentStock: targetItem.currentStock + reconcileReturnedQty
        };
        setPackagedItems(packagedItems.map(i => i.id === targetItem.id ? updatedItem : i));
      }
    }

    const updatedAlloc: PumperOilAllocation = {
      ...reconcilingAlloc,
      returnedQty: reconcileReturnedQty,
      soldQty,
      totalAmount,
      status: 'Reconciled'
    };

    setAllocations(allocations.map(a => a.id === reconcilingAlloc.id ? updatedAlloc : a));
    setIsReconcileModalOpen(false);
    setReconcilingAlloc(null);
    showToast(`Reconciled: ${soldQty} sold (${formatCurrency(totalAmount)}), ${reconcileReturnedQty} returned.`);
  };

  // Filtered Packaged Items
  const filteredPackagedItems = useMemo(() => {
    return packagedItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.grade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [packagedItems, searchQuery, selectedCategory]);

  return (
    <div id="oil-storage-container" className="space-y-5 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1C1C1C] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-scale-up border border-gray-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & QUICK ACTION BUTTONS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Oil & Lubricant Storage</h1>
              <p className="text-xs text-gray-500">
                Bulk storage tanks, packaged bottle catalog, Goods Received Notes (GRN), and pumper shift allocations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenSaleModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>+ Quick Retail Sale</span>
          </button>

          <button
            onClick={handleOpenGRNModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>+ Receive Stock (GRN)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATS STRIP / KPI SUMMARY CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Bulk Tanks Stock */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Bulk Oil Tanks</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Droplets className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[#1C1C1C] font-mono tabular-nums">
              {metrics.totalBulkLiters.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 font-bold">/ {metrics.totalBulkCapacity.toLocaleString()} L</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between pt-1 border-t border-gray-50">
            <span>Valuation:</span>
            <strong className="text-slate-800 font-mono tabular-nums">{formatCurrency(metrics.totalBulkValue)}</strong>
          </div>
        </div>

        {/* Packaged Bottles Stock */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Packaged Bottles</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[#1C1C1C] font-mono tabular-nums">
              {metrics.totalBottles.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 font-bold">Units in stock</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between pt-1 border-t border-gray-50">
            <span>Valuation:</span>
            <strong className="text-emerald-700 font-mono tabular-nums">{formatCurrency(metrics.totalPackagedValue)}</strong>
          </div>
        </div>

        {/* Reorder Alerts */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reorder Alerts</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              metrics.lowStockCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-lg font-extrabold font-mono tabular-nums ${
              metrics.lowStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {metrics.lowStockCount}
            </span>
            <span className="text-xs text-gray-400 font-bold">
              {metrics.lowStockCount === 1 ? 'Product low' : 'Products low'}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between pt-1 border-t border-gray-50">
            <span>Status:</span>
            <span className={`font-bold text-[10px] px-1.5 py-0.2 rounded-full ${
              metrics.lowStockCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {metrics.lowStockCount > 0 ? 'Action Needed' : 'Healthy'}
            </span>
          </div>
        </div>

        {/* Shift Allocations */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pumper Shift Flow</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[#1C1C1C] font-mono tabular-nums">
              {metrics.activeAllocationsCount}
            </span>
            <span className="text-xs text-gray-400 font-bold">Active issues</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between pt-1 border-t border-gray-50">
            <span>Today Sales:</span>
            <strong className="text-purple-700 font-mono tabular-nums">{formatCurrency(metrics.todaySalesAmount)}</strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-TABS NAVIGATION */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveSubTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'bulk'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Droplets className="w-4 h-4 text-amber-500" />
          <span>Bulk Oil & Barrels ({oilTanks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('packaged')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'packaged'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Package className="w-4 h-4 text-blue-500" />
          <span>Packaged Bottles Inventory ({packagedItems.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('grn')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'grn'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Truck className="w-4 h-4 text-emerald-500" />
          <span>Receive Stock (GRN) ({grnRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('allocation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'allocation'
              ? 'bg-[#1C1C1C] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/60'
          }`}
        >
          <Users className="w-4 h-4 text-purple-500" />
          <span>Pumper Allocation ({allocations.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: BULK OIL & BARRELS (LIVE METERS) */}
      {/* ========================================================================= */}
      {activeSubTab === 'bulk' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Bulk Storage Tanks & Drum Bays</h2>
            <span className="text-xs text-gray-500 font-medium">Configured in Admin Control</span>
          </div>

          {oilTanks.length === 0 ? (
            <div className="bg-white p-10 text-center rounded-2xl border border-gray-100 space-y-3">
              <Droplets className="w-10 h-10 text-amber-500 mx-auto opacity-70" />
              <h3 className="text-sm font-bold text-slate-800">No Bulk Oil Tanks Configured</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Go to Admin Control &gt; Oil Storage to add and configure bulk lubricant tanks or barrels.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {oilTanks.map((tank) => {
                const pct = tank.capacity > 0 ? Math.round((tank.currentLevel / tank.capacity) * 100) : 0;
                const totalStockVal = tank.currentLevel * (tank.pricePerLiter || 0);

                return (
                  <div key={tank.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm hover:border-gray-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            {tank.grade}
                          </span>
                          <h3 className="text-base font-extrabold text-[#1C1C1C] mt-0.5">{tank.name}</h3>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <span className={`text-sm font-extrabold ${pct < 25 ? 'text-rose-600' : pct < 45 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {pct}% Full
                        </span>
                      </div>
                    </div>

                    {/* Progress Level Bar */}
                    <div className="space-y-1.5">
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct < 25 ? 'bg-rose-500' : pct < 45 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 font-medium">
                        <span>Current: <strong className="text-slate-900 font-mono tabular-nums">{tank.currentLevel.toLocaleString()} L</strong></span>
                        <span>Capacity: <strong className="text-slate-900 font-mono tabular-nums">{tank.capacity.toLocaleString()} L</strong></span>
                      </div>
                    </div>

                    {/* Footer Metrics */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 text-xs">
                      <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Rate / Liter</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(tank.pricePerLiter || 0)}
                        </span>
                      </div>
                      <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 text-right">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Total Stock Value</span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          {formatCurrency(totalStockVal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PACKAGED BOTTLES INVENTORY */}
      {/* ========================================================================= */}
      {activeSubTab === 'packaged' && (
        <div className="space-y-4">
          {/* Controls: Search, Category Filter, and Add Product */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by oil name, grade, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="Engine Oil">Engine Oil</option>
                <option value="2T/4T Oil">2T/4T Oil</option>
                <option value="Brake Fluid">Brake Fluid</option>
                <option value="Coolant">Coolant</option>
                <option value="Gear Oil">Gear Oil</option>
                <option value="Hydraulic">Hydraulic</option>
              </select>
            </div>

            <button
              onClick={handleOpenAddItemModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Bottle Product</span>
            </button>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Product Name & Grade</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Pack Size</th>
                    <th className="py-3 px-4 text-center">In Stock</th>
                    <th className="py-3 px-4 text-right">Cost (Rs.)</th>
                    <th className="py-3 px-4 text-right">Retail Price</th>
                    <th className="py-3 px-4 text-right">Stock Value</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPackagedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 font-medium">
                        No packaged products match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPackagedItems.map((item) => {
                      const isLow = item.currentStock <= item.minReorderLevel;
                      const stockVal = item.currentStock * item.retailPrice;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{item.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              Grade: <span className="font-semibold text-gray-600">{item.grade}</span> &bull; Loc: {item.location || 'N/A'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-medium">{item.packageSize}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-mono font-extrabold text-sm tabular-nums ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                              {item.currentStock}
                            </span>
                            <span className="text-[10px] text-gray-400 block">Min: {item.minReorderLevel}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-500">
                            {formatCurrency(item.unitCost)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                            {formatCurrency(item.retailPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-700">
                            {formatCurrency(stockVal)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Reorder
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditItemModal(item)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: GOODS RECEIVED NOTE (GRN) HISTORY */}
      {/* ========================================================================= */}
      {activeSubTab === 'grn' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Lubricants Goods Received Notes (GRN)</h2>
              <p className="text-xs text-gray-500">Inward batch delivery log for bulk tank deliveries and packaged carton receipts</p>
            </div>

            <button
              onClick={handleOpenGRNModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record New GRN</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">GRN No & Date</th>
                    <th className="py-3 px-4">Supplier & Invoice</th>
                    <th className="py-3 px-4">Delivery Type</th>
                    <th className="py-3 px-4">Items / Tanks Received</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grnRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                        No GRN records saved yet.
                      </td>
                    </tr>
                  ) : (
                    grnRecords.map((grn) => (
                      <tr key={grn.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>{grn.grnNumber}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{grn.date}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{grn.supplier}</div>
                          <div className="text-[10px] text-gray-400 font-mono">Inv: {grn.invoiceNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            grn.type === 'bulk' 
                              ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {grn.type === 'bulk' ? 'Bulk Tank / Barrel' : 'Packaged Bottles'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {grn.type === 'bulk' ? (
                            <div>
                              <strong className="text-slate-900 font-mono tabular-nums">{grn.litersReceived} L</strong> into {grn.tankName}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {grn.items?.map((it, idx) => (
                                <div key={idx} className="text-[11px]">
                                  <strong className="text-slate-900 font-mono tabular-nums">+{it.quantity}</strong> {it.itemName} ({it.packageSize})
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {formatCurrency(grn.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-medium">
                          {grn.receivedBy}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: PUMPER SHIFT ALLOCATIONS */}
      {/* ========================================================================= */}
      {activeSubTab === 'allocation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Pumper Lubricant Allocation & Shift Reconcile</h2>
              <p className="text-xs text-gray-500">Track 2T pouches, 1L bottles, and coolants issued to pumpers per shift</p>
            </div>

            <button
              onClick={() => {
                if (packagedItems.length > 0) setAllocItemId(packagedItems[0].id);
                setIsAllocModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Issue Oil to Pumper</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Shift</th>
                    <th className="py-3 px-4">Pumper</th>
                    <th className="py-3 px-4">Product Issued</th>
                    <th className="py-3 px-4 text-center">Issued Qty</th>
                    <th className="py-3 px-4 text-center">Returned</th>
                    <th className="py-3 px-4 text-center">Sold Qty</th>
                    <th className="py-3 px-4 text-right">Cash Expected</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 font-medium">
                        No pumper allocations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>{alloc.shiftName || 'Standard Shift'}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{alloc.date}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {alloc.pumperName}
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-medium">
                          <div>{alloc.itemName}</div>
                          <div className="text-[10px] text-gray-400">Rate: {formatCurrency(alloc.unitPrice)}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold tabular-nums text-slate-900">
                          {alloc.issuedQty}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-gray-500">
                          {alloc.returnedQty}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold tabular-nums text-emerald-600">
                          {alloc.status === 'Reconciled' ? alloc.soldQty : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                          {alloc.status === 'Reconciled' ? formatCurrency(alloc.totalAmount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            alloc.status === 'Reconciled'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {alloc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {alloc.status === 'Issued' ? (
                            <button
                              onClick={() => {
                                setReconcilingAlloc(alloc);
                                setReconcileReturnedQty(0);
                                setIsReconcileModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reconcile
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECEIVE STOCK (GRN) */}
      {/* ========================================================================= */}
      {isGRNModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span>Receive New Oil Stock (GRN)</span>
              </h3>
              <button 
                onClick={() => setIsGRNModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector: Packaged vs Bulk */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setGrnType('packaged')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  grnType === 'packaged' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-500 hover:text-slate-800'
                }`}
              >
                Packaged Bottles / Cartons
              </button>
              <button
                type="button"
                onClick={() => setGrnType('bulk')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  grnType === 'bulk' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-500 hover:text-slate-800'
                }`}
              >
                Bulk Oil Tank Refill
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Supplier</label>
                  <input
                    type="text"
                    value={grnSupplier}
                    onChange={(e) => setGrnSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. Chevron Lubricants Lanka"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Invoice / PO Number</label>
                  <input
                    type="text"
                    value={grnInvoiceNo}
                    onChange={(e) => setGrnInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. INV-8891"
                  />
                </div>
              </div>

              {grnType === 'packaged' ? (
                <>
                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Select Product</label>
                    <select
                      value={grnSelectedItemId}
                      onChange={(e) => {
                        setGrnSelectedItemId(e.target.value);
                        const it = packagedItems.find(i => i.id === e.target.value);
                        if (it) setGrnItemCost(it.unitCost);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {packagedItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.packageSize}) - Current: {item.currentStock}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Received Quantity (Units)</label>
                      <input
                        type="number"
                        min="1"
                        value={grnItemQty}
                        onChange={(e) => setGrnItemQty(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Unit Purchase Cost (Rs.)</label>
                      <input
                        type="number"
                        min="0"
                        value={grnItemCost}
                        onChange={(e) => setGrnItemCost(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-blue-50 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-blue-900">Total Purchase Value:</span>
                    <strong className="text-blue-900 font-mono tabular-nums text-sm">
                      {formatCurrency(grnItemQty * grnItemCost)}
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Select Oil Storage Tank / Barrel</label>
                    <select
                      value={grnBulkTankId}
                      onChange={(e) => setGrnBulkTankId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                    >
                      {oilTanks.map(tank => (
                        <option key={tank.id} value={tank.id}>
                          {tank.name} ({tank.grade}) - Current: {tank.currentLevel} / {tank.capacity} L
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Liters Received (L)</label>
                      <input
                        type="number"
                        min="1"
                        value={grnBulkLiters}
                        onChange={(e) => setGrnBulkLiters(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Cost Per Liter (Rs.)</label>
                      <input
                        type="number"
                        min="0"
                        value={grnBulkCostPerLiter}
                        onChange={(e) => setGrnBulkCostPerLiter(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-900">Total Bulk Cost:</span>
                    <strong className="text-amber-900 font-mono tabular-nums text-sm">
                      {formatCurrency(grnBulkLiters * grnBulkCostPerLiter)}
                    </strong>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Received By</label>
                  <input
                    type="text"
                    value={grnReceivedBy}
                    onChange={(e) => setGrnReceivedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setIsGRNModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGRNSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Confirm & Receive Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK RETAIL SALE */}
      {/* ========================================================================= */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <span>Quick Retail Oil Sale</span>
              </h3>
              <button 
                onClick={() => setIsSaleModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Product</label>
                <select
                  value={saleItemId}
                  onChange={(e) => setSaleItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {packagedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.packageSize}) - {formatCurrency(item.retailPrice)} (Stock: {item.currentStock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={saleQty}
                    onChange={(e) => setSaleQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Payment Method</label>
                  <select
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card / POS</option>
                    <option value="Credit">Credit Customer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Customer / Vehicle No</label>
                <input
                  type="text"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. WP-CA-8891 / Walk-in"
                />
              </div>

              {/* Total Calculation */}
              {(() => {
                const item = packagedItems.find(i => i.id === saleItemId);
                const total = item ? saleQty * item.retailPrice : 0;
                return (
                  <div className="p-3 bg-emerald-50 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-900">Total Sale Amount:</span>
                    <strong className="text-emerald-900 font-mono tabular-nums text-base">
                      {formatCurrency(total)}
                    </strong>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSaleSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Complete Sale & Deduct
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD / EDIT PACKAGED ITEM */}
      {/* ========================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>{editingItem ? 'Edit Product Item' : 'Add Packaged Product'}</span>
              </h3>
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Product Name</label>
                <input
                  type="text"
                  value={itemFormName}
                  onChange={(e) => setItemFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. Caltex Havoline Super 4T 20W-40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Category</label>
                  <select
                    value={itemFormCategory}
                    onChange={(e) => setItemFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                  >
                    <option value="Engine Oil">Engine Oil</option>
                    <option value="2T/4T Oil">2T/4T Oil</option>
                    <option value="Brake Fluid">Brake Fluid</option>
                    <option value="Coolant">Coolant</option>
                    <option value="Gear Oil">Gear Oil</option>
                    <option value="Hydraulic">Hydraulic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Grade / Specification</label>
                  <input
                    type="text"
                    value={itemFormGrade}
                    onChange={(e) => setItemFormGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. 20W-40 / DOT 4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Package Size</label>
                  <input
                    type="text"
                    value={itemFormSize}
                    onChange={(e) => setItemFormSize(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. 1L Bottle, 500ml, 4L Can"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Shelf Location</label>
                  <input
                    type="text"
                    value={itemFormLocation}
                    onChange={(e) => setItemFormLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                    placeholder="e.g. Bay A1, Rack 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Current Stock (Units)</label>
                  <input
                    type="number"
                    value={itemFormStock}
                    onChange={(e) => setItemFormStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Min Reorder Alert Level</label>
                  <input
                    type="number"
                    value={itemFormMinStock}
                    onChange={(e) => setItemFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Unit Cost (Rs.)</label>
                  <input
                    type="number"
                    value={itemFormCost}
                    onChange={(e) => setItemFormCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Retail Selling Price (Rs.)</label>
                  <input
                    type="number"
                    value={itemFormPrice}
                    onChange={(e) => setItemFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItemSubmit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                {editingItem ? 'Save Changes' : 'Add to Catalog'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ISSUE OIL TO PUMPER */}
      {/* ========================================================================= */}
      {isAllocModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Issue Lubricants to Pumper</span>
              </h3>
              <button 
                onClick={() => setIsAllocModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Select Pumper</label>
                <select
                  value={allocPumperId}
                  onChange={(e) => setAllocPumperId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {employees.length > 0 ? (
                    employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))
                  ) : (
                    <option value="emp-01">Station Pumper 01</option>
                  )}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Shift</label>
                <select
                  value={allocShiftName}
                  onChange={(e) => setAllocShiftName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="Morning Shift (06:00 - 14:00)">Morning Shift (06:00 - 14:00)</option>
                  <option value="Evening Shift (14:00 - 22:00)">Evening Shift (14:00 - 22:00)</option>
                  <option value="Night Shift (22:00 - 06:00)">Night Shift (22:00 - 06:00)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Product</label>
                <select
                  value={allocItemId}
                  onChange={(e) => setAllocItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-semibold"
                >
                  {packagedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.packageSize}) - Available: {item.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Quantity to Issue</label>
                <input
                  type="number"
                  min="1"
                  value={allocIssuedQty}
                  onChange={(e) => setAllocIssuedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-medium"
                  placeholder="e.g. Island 1 dispenser tray"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAllocModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAllocSubmit}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Issue to Pumper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RECONCILE PUMPER ALLOCATION */}
      {/* ========================================================================= */}
      {isReconcileModalOpen && reconcilingAlloc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-[#1C1C1C] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Reconcile Shift Lubricants</span>
              </h3>
              <button 
                onClick={() => setIsReconcileModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">Pumper:</span>
                  <span className="text-slate-900">{reconcilingAlloc.pumperName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Product:</span>
                  <span className="font-semibold text-slate-900">{reconcilingAlloc.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Issued Quantity:</span>
                  <strong className="font-mono tabular-nums text-slate-900">{reconcilingAlloc.issuedQty} Units</strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Returned Unsold Count</label>
                <input
                  type="number"
                  min="0"
                  max={reconcilingAlloc.issuedQty}
                  value={reconcileReturnedQty}
                  onChange={(e) => setReconcileReturnedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-slate-900 font-bold tabular-nums"
                />
              </div>

              {/* Settlement Summary */}
              {(() => {
                const sold = Math.max(0, reconcilingAlloc.issuedQty - reconcileReturnedQty);
                const cashDue = sold * reconcilingAlloc.unitPrice;
                return (
                  <div className="p-3 bg-emerald-50 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-800 font-medium">Sold Quantity:</span>
                      <strong className="font-mono tabular-nums text-emerald-900">{sold} Units</strong>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200/60 pt-1">
                      <span className="text-emerald-900 font-extrabold">Cash to Collect:</span>
                      <strong className="font-mono tabular-nums text-sm text-emerald-900">
                        {formatCurrency(cashDue)}
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReconcileModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReconcileSubmit}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                Confirm Reconciliation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
