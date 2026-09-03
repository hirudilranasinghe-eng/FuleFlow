import React, { useState, useEffect } from 'react';
import { 
  Flame, Package, RefreshCw, Plus, ArrowDownLeft, ArrowUpRight, 
  Search, ShieldAlert, CheckCircle2, TrendingUp, DollarSign, 
  Layers, Edit2, AlertTriangle, X, ShoppingCart, UserCheck, 
  Receipt, ArrowRight, Truck, Filter
} from 'lucide-react';
import { 
  GasInventoryItem, GasPurchaseRecord, GasSaleRecord, 
  GasBrand, GasCylinderSize, Customer, Employee, AuthUser 
} from '../types';
import { 
  fetchGasInventory, saveGasInventoryItem, 
  fetchGasSales, saveGasSale, 
  fetchGasPurchases, formatRs, formatRsPlain,
  DEFAULT_GAS_INVENTORY 
} from '../lib/gasClient';
import { supabase } from '../lib/supabase';

interface GasStorageTabProps {
  setActiveTab?: (tab: string, subTab?: string) => void;
  customers?: Customer[];
  employees?: Employee[];
  user?: AuthUser | null;
}

export default function GasStorageTab({ setActiveTab, customers = [], employees = [], user }: GasStorageTabProps) {
  // Inventory state
  const [inventory, setInventory] = useState<GasInventoryItem[]>(DEFAULT_GAS_INVENTORY);
  const [sales, setSales] = useState<GasSaleRecord[]>([]);
  const [purchases, setPurchases] = useState<GasPurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [brandFilter, setBrandFilter] = useState<'All' | 'Litro' | 'Laugfs'>('All');
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'sales-log' | 'purchases-log'>('cards');

  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GasInventoryItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Counter Sale Form State
  const [saleBrand, setSaleBrand] = useState<GasBrand>('Litro');
  const [saleSize, setSaleSize] = useState<GasCylinderSize>('12.5 kg Regular');
  const [saleType, setSaleType] = useState<'Refill Exchange' | 'New Package' | 'Empty Return'>('Refill Exchange');
  const [saleQty, setSaleQty] = useState<number>(1);
  const [saleEmptyQty, setSaleEmptyQty] = useState<number>(1);
  const [saleUnitPrice, setSaleUnitPrice] = useState<number>(3690);
  const [saleCustomerType, setSaleCustomerType] = useState<'Walk-in' | 'Credit'>('Walk-in');
  const [saleCustomerId, setSaleCustomerId] = useState<string>('');
  const [saleCustomerName, setSaleCustomerName] = useState<string>('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<'Cash' | 'Card' | 'Credit'>('Cash');
  const [saleSoldBy, setSaleSoldBy] = useState<string>('');
  const [saleVehicleNo, setSaleVehicleNo] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Edit Stock / Price Form State
  const [editStockFull, setEditStockFull] = useState<number>(0);
  const [editStockEmpty, setEditStockEmpty] = useState<number>(0);
  const [editRefillPrice, setEditRefillPrice] = useState<number>(0);
  const [editPackagePrice, setEditPackagePrice] = useState<number>(0);
  const [editBuyingPrice, setEditBuyingPrice] = useState<number>(0);
  const [editMinThreshold, setEditMinThreshold] = useState<number>(5);

  // Search filter for logs
  const [searchQuery, setSearchQuery] = useState('');

  // Load data from live Supabase and local storage
  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, salesData, purchData] = await Promise.all([
        fetchGasInventory(),
        fetchGasSales(),
        fetchGasPurchases()
      ]);
      setInventory(invData);
      setSales(salesData);
      setPurchases(purchData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error loading gas data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time changes if available
    const invChannel = supabase
      .channel('gas_inventory_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gas_inventory' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gas_sales' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gas_purchases' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync unit price when brand, size, or sale type changes
  useEffect(() => {
    const item = inventory.find(i => 
      i.brand.toLowerCase() === saleBrand.toLowerCase() && 
      i.cylinderSize.toLowerCase() === saleSize.toLowerCase()
    );
    if (item) {
      if (saleType === 'Refill Exchange') {
        setSaleUnitPrice(item.refillSellingPrice);
        setSaleEmptyQty(saleQty);
      } else if (saleType === 'New Package') {
        setSaleUnitPrice(item.packageSellingPrice);
        setSaleEmptyQty(0);
      } else {
        setSaleUnitPrice(0);
        setSaleEmptyQty(saleQty);
      }
    }
  }, [saleBrand, saleSize, saleType, saleQty, inventory]);

  // Handle open sale modal with pre-selected card
  const handleOpenSaleModal = (brand?: GasBrand, size?: GasCylinderSize) => {
    if (brand) setSaleBrand(brand);
    if (size) setSaleSize(size);
    setSaleType('Refill Exchange');
    setSaleQty(1);
    setSaleCustomerType('Walk-in');
    setSaleCustomerId('');
    setSaleCustomerName('');
    setSalePaymentMethod('Cash');
    setSaleSoldBy(user?.name || (employees.length > 0 ? employees[0].name : 'Counter Cashier'));
    setSaleVehicleNo('');
    setSaleNotes('');
    setSaleError(null);
    setIsSaleModalOpen(true);
  };

  // Handle submit Counter Sale / Refill Exchange
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);

    const targetItem = inventory.find(i => 
      i.brand.toLowerCase() === saleBrand.toLowerCase() && 
      i.cylinderSize.toLowerCase() === saleSize.toLowerCase()
    );

    if (saleType !== 'Empty Return' && targetItem && targetItem.stockFull < saleQty) {
      setSaleError(`Insufficient full cylinders in stock! Current stock: ${targetItem.stockFull}, requested: ${saleQty}`);
      return;
    }

    if (saleCustomerType === 'Credit' && !saleCustomerName.trim() && !saleCustomerId) {
      setSaleError('Please select or specify a credit customer account.');
      return;
    }

    setSaleSubmitting(true);
    try {
      const calculatedTotal = saleQty * saleUnitPrice;
      const saleRecord: GasSaleRecord = {
        id: `GAS-S-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        brand: saleBrand,
        cylinderSize: saleSize,
        saleType: saleType,
        quantity: Number(saleQty),
        emptyReceivedQty: Number(saleEmptyQty),
        unitPrice: Number(saleUnitPrice),
        totalAmount: calculatedTotal,
        customerType: saleCustomerType,
        customerName: saleCustomerType === 'Credit' 
          ? (customers.find(c => c.id === saleCustomerId)?.name || saleCustomerName) 
          : (saleCustomerName || 'Walk-in Customer'),
        customerId: saleCustomerId || undefined,
        paymentMethod: salePaymentMethod,
        soldBy: saleSoldBy || user?.name || 'Counter Cashier',
        vehicleNo: saleVehicleNo,
        notes: saleNotes,
        createdAt: new Date().toISOString()
      };

      const result = await saveGasSale(saleRecord);
      if (result.success) {
        showToast(`✓ Sale Recorded: ${saleQty} × ${saleBrand} ${saleSize} (${saleType})`);
        setIsSaleModalOpen(false);
        await loadData();
      } else {
        setSaleError('Failed to record sale to database. Please check connection.');
      }
    } catch (err: any) {
      setSaleError(err?.message || 'Error recording gas sale.');
    } finally {
      setSaleSubmitting(false);
    }
  };

  // Handle open edit/calibrate modal
  const handleOpenEditModal = (item: GasInventoryItem) => {
    setEditingItem(item);
    setEditStockFull(item.stockFull);
    setEditStockEmpty(item.stockEmpty);
    setEditRefillPrice(item.refillSellingPrice);
    setEditPackagePrice(item.packageSellingPrice);
    setEditBuyingPrice(item.buyingPrice);
    setEditMinThreshold(item.minAlertThreshold);
    setIsEditModalOpen(true);
  };

  // Handle save edit/calibrate
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const updated: GasInventoryItem = {
      ...editingItem,
      stockFull: Number(editStockFull),
      stockEmpty: Number(editStockEmpty),
      refillSellingPrice: Number(editRefillPrice),
      packageSellingPrice: Number(editPackagePrice),
      buyingPrice: Number(editBuyingPrice),
      minAlertThreshold: Number(editMinThreshold),
      updatedAt: new Date().toISOString()
    };

    const res = await saveGasInventoryItem(updated);
    if (res.success) {
      showToast(`✓ Updated stock & rates for ${editingItem.brand} ${editingItem.cylinderSize}`);
      setIsEditModalOpen(false);
      await loadData();
    }
  };

  // Filtered inventory list
  const filteredInventory = inventory.filter(item => {
    if (brandFilter === 'All') return true;
    return item.brand === brandFilter;
  });

  // Calculate summary metrics
  const totalFullCylinders = inventory.reduce((sum, item) => sum + (item.stockFull || 0), 0);
  const totalEmptyCylinders = inventory.reduce((sum, item) => sum + (item.stockEmpty || 0), 0);
  const totalInventoryValue = inventory.reduce((sum, item) => sum + ((item.stockFull || 0) * (item.buyingPrice || 0)), 0);
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const litroFullCount = inventory.filter(i => i.brand === 'Litro').reduce((s, i) => s + i.stockFull, 0);
  const laugfsFullCount = inventory.filter(i => i.brand === 'Laugfs').reduce((s, i) => s + i.stockFull, 0);

  return (
    <div id="gas-storage-tab-root" className="space-y-6 pb-12 animate-fade-in font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slide-in text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                LP Gas Storage &amp; Inventory Control
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800 uppercase tracking-wider">
                Live Stock
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Litro &amp; Laugfs cylinder custody, refill exchanges, and purchase restock balance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            id="btn-refresh-gas-data"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-slate-700 rounded-xl text-xs font-bold border border-gray-200 transition-all cursor-pointer"
            title="Refresh live Supabase stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="btn-goto-gas-purchases"
            onClick={() => setActiveTab ? setActiveTab('purchases') : null}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4 text-slate-600" />
            <span>Purchases Register</span>
          </button>

          <button
            id="btn-open-gas-counter-sale"
            onClick={() => handleOpenSaleModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-orange-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Gas Counter Sale / Refill Exchange</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Full Cylinders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Full Cylinders in Hand</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
            {totalFullCylinders.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span className="text-blue-600">Litro: {litroFullCount}</span>
            <span className="text-amber-600">Laugfs: {laugfsFullCount}</span>
          </div>
        </div>

        {/* Metric 2: Total Empty Cylinders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Empty Cylinders in Hand</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
            {totalEmptyCylinders.toLocaleString()}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 font-medium">
            Ready for exchange with distributor
          </p>
        </div>

        {/* Metric 3: Total Stock Valuation */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Inventory Asset Value</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums truncate">
            {formatRsPlain(totalInventoryValue)}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 font-medium">
            Based on current buying cost
          </p>
        </div>

        {/* Metric 4: Total Counter Sales Recorded */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Counter Sales ({sales.length})</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums truncate">
            {formatRsPlain(totalSalesRevenue)}
          </div>
          <p className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span>Refills &amp; New Packages</span>
          </p>
        </div>
      </div>

      {/* 3. Navigation Controls & Brand Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('cards')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'cards' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-gray-500 hover:text-slate-900'
            }`}
          >
            Cylinder Stock Cards
          </button>
          <button
            onClick={() => setActiveSubTab('sales-log')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'sales-log' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-gray-500 hover:text-slate-900'
            }`}
          >
            Sales &amp; Refill History ({sales.length})
          </button>
          <button
            onClick={() => setActiveSubTab('purchases-log')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'purchases-log' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-gray-500 hover:text-slate-900'
            }`}
          >
            Restock Deliveries ({purchases.length})
          </button>
        </div>

        {activeSubTab === 'cards' ? (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs font-bold text-gray-500 hidden sm:inline mr-1">Brand:</span>
            {(['All', 'Litro', 'Laugfs'] as const).map(brand => (
              <button
                key={brand}
                onClick={() => setBrandFilter(brand)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  brandFilter === brand 
                    ? brand === 'Litro' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : brand === 'Laugfs' 
                      ? 'bg-amber-500 text-slate-900 shadow-xs' 
                      : 'bg-slate-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {brand === 'All' ? 'All Brands' : `${brand} Gas`}
              </button>
            ))}
          </div>
        ) : (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-orange-500"
            />
          </div>
        )}
      </div>

      {/* 4. Main Content Area */}
      {activeSubTab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredInventory.map(item => {
            const isLitro = item.brand === 'Litro';
            const isLowStock = item.stockFull <= item.minAlertThreshold;
            const isOutOfStock = item.stockFull === 0;

            return (
              <div 
                key={item.id}
                id={`cylinder-card-${item.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group"
              >
                {/* Brand Header Stripe */}
                <div className={`px-4 py-3 flex items-center justify-between text-white ${
                  isLitro 
                    ? 'bg-gradient-to-r from-blue-700 to-blue-600' 
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <Flame className={`w-4 h-4 ${isLitro ? 'text-cyan-300' : 'text-slate-900'}`} />
                    <span className="font-extrabold text-xs tracking-wider uppercase">
                      {item.brand} Gas
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isLitro ? 'bg-blue-800/60 text-blue-100' : 'bg-amber-700/20 text-slate-900'
                  }`}>
                    {item.sizeKg} KG
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Cylinder Name & Alert Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {item.cylinderSize}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        LP Gas Cylinder • {item.brand}
                      </p>
                    </div>

                    {isOutOfStock ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Healthy
                      </span>
                    )}
                  </div>

                  {/* Stock Counters Grid: Full vs Empty */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    {/* Full Stock Counter */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Full in Hand</span>
                      </div>
                      <div className="text-2xl font-black text-slate-900 tabular-nums">
                        {item.stockFull}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Available to sell
                      </p>
                    </div>

                    {/* Empty Stock Counter */}
                    <div className="space-y-1 border-l border-slate-200 pl-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>Empty in Hand</span>
                      </div>
                      <div className="text-2xl font-black text-slate-700 tabular-nums">
                        {item.stockEmpty}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Returned by buyers
                      </p>
                    </div>
                  </div>

                  {/* Price Schedule */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-[11px]">Refill Exchange Price:</span>
                      <span className="font-bold text-slate-900 tabular-nums text-sm">
                        {formatRsPlain(item.refillSellingPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>New Package Selling:</span>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {formatRsPlain(item.packageSellingPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[10px] pt-1 border-t border-dashed border-gray-200">
                      <span>Dealer Buying Price:</span>
                      <span className="tabular-nums">
                        {formatRsPlain(item.buyingPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenSaleModal(item.brand, item.cylinderSize)}
                      disabled={item.stockFull === 0}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        item.stockFull === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Sell / Refill</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 bg-gray-50 hover:bg-gray-100 text-slate-600 rounded-xl border border-gray-200 transition-colors cursor-pointer"
                      title="Adjust Stock or Price"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Sales & Refill History Table */}
      {activeSubTab === 'sales-log' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-600" />
              <span>Gas Counter Sales &amp; Refill Exchange Log</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {sales.length} records found
            </span>
          </div>

          {sales.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Flame className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
              <p className="font-bold text-slate-700">No counter sales recorded yet</p>
              <p className="text-xs">Click "+ Record Gas Counter Sale / Refill Exchange" to record your first sale.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date / Ref</th>
                    <th className="py-3 px-4">Brand &amp; Size</th>
                    <th className="py-3 px-4">Sale Type</th>
                    <th className="py-3 px-4 text-center">Full Given</th>
                    <th className="py-3 px-4 text-center">Empty Received</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sales
                    .filter(s => 
                      !searchQuery || 
                      s.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      s.cylinderSize.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.id.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{sale.date}</div>
                          <div className="text-[10px] text-slate-400">{sale.id}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              sale.brand === 'Litro' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sale.brand}
                            </span>
                            <span className="font-bold text-slate-800">{sale.cylinderSize}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.saleType === 'Refill Exchange' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : sale.saleType === 'New Package'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {sale.saleType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900 tabular-nums">
                          {sale.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-600 tabular-nums">
                          {sale.emptyReceivedQty}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{sale.customerName || 'Walk-in'}</div>
                          <div className="text-[10px] text-slate-400">{sale.customerType}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-700">{sale.paymentMethod}</span>
                          {sale.soldBy && (
                            <div className="text-[10px] text-slate-400">By {sale.soldBy}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 tabular-nums">
                          {formatRs(sale.totalAmount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Inward Restock Deliveries Table */}
      {activeSubTab === 'purchases-log' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Gas Purchases &amp; Distributor Inward Restocks</span>
            </h3>
            <button
              onClick={() => setActiveTab ? setActiveTab('purchases') : null}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Go to Full Purchases Module</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {purchases.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Truck className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
              <p className="font-bold text-slate-700">No gas purchase deliveries logged yet</p>
              <p className="text-xs">Record gas purchases in the Purchases Tab to automatically increase full stock and reduce empty stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date / Invoice</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Brand &amp; Size</th>
                    <th className="py-3 px-4">Delivery Type</th>
                    <th className="py-3 px-4 text-center">Full Received</th>
                    <th className="py-3 px-4 text-center">Empty Handed Over</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Invoice Cost (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {purchases
                    .filter(p => 
                      !searchQuery || 
                      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.supplier.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.date}</div>
                          <div className="text-[10px] text-slate-400">DO/INV: {item.invoiceNo}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {item.supplier}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              item.brand === 'Litro' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.brand}
                            </span>
                            <span className="font-bold text-slate-800">{item.cylinderSize}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.purchaseType === 'Refill Restock' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {item.purchaseType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-emerald-700 tabular-nums">
                          +{item.fullQtyReceived}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-600 tabular-nums">
                          -{item.emptyQtyHandedOver}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-slate-700">
                          {formatRs(item.unitBuyingPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 tabular-nums">
                          {formatRs(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD GAS COUNTER SALE / REFILL EXCHANGE */}
      {/* ========================================================================= */}
      {isSaleModalOpen && (
        <div 
          id="modal-gas-counter-sale" 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    Record Gas Counter Sale / Refill Exchange
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dispatches full cylinder and accepts customer empty cylinder
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSaleModalOpen(false)}
                className="text-gray-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitSale} className="p-6 space-y-4 text-xs">
              {saleError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold">{saleError}</span>
                </div>
              )}

              {/* 1. Brand & Size Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Gas Brand
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSaleBrand('Litro')}
                      className={`py-2 px-3 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                        saleBrand === 'Litro' 
                          ? 'bg-blue-50 border-blue-500 text-blue-800' 
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Litro Gas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleBrand('Laugfs')}
                      className={`py-2 px-3 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                        saleBrand === 'Laugfs' 
                          ? 'bg-amber-50 border-amber-500 text-amber-800' 
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Laugfs Gas
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Cylinder Size
                  </label>
                  <select
                    value={saleSize}
                    onChange={(e) => setSaleSize(e.target.value as GasCylinderSize)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="12.5 kg Regular">12.5 kg Regular (Domestic)</option>
                    <option value="5 kg Baby">5 kg Baby (Portable)</option>
                    <option value="2.3 kg Mini">2.3 kg Mini (Budget)</option>
                    <option value="37.5 kg Industrial">37.5 kg Industrial</option>
                  </select>
                </div>
              </div>

              {/* 2. Sale Type Selector */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Transaction Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaleType('Refill Exchange')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      saleType === 'Refill Exchange' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-black">Refill Exchange</div>
                    <div className="text-[10px] font-normal text-slate-500">Empty in, Full out</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaleType('New Package')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      saleType === 'New Package' 
                        ? 'bg-blue-50 border-blue-500 text-blue-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-black">New Package</div>
                    <div className="text-[10px] font-normal text-slate-500">Cylinder + Gas</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaleType('Empty Return')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      saleType === 'Empty Return' 
                        ? 'bg-purple-50 border-purple-500 text-purple-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-black">Empty Return</div>
                    <div className="text-[10px] font-normal text-slate-500">Empty in only</div>
                  </button>
                </div>
              </div>

              {/* 3. Quantity & Pricing */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    {saleType === 'Empty Return' ? 'Empty Qty' : 'Full Qty Sold'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={saleQty}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value) || 1);
                      setSaleQty(v);
                      if (saleType === 'Refill Exchange') setSaleEmptyQty(v);
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Empty Taken In
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={saleEmptyQty}
                    onChange={(e) => setSaleEmptyQty(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={saleType === 'New Package'}
                    className={`w-full px-3 py-2 border rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500 ${
                      saleType === 'New Package' ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-gray-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Unit Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={saleUnitPrice}
                    onChange={(e) => setSaleUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* 4. Customer Selection (Walk-in vs Credit) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-600 uppercase tracking-wider">
                    Customer Account
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSaleCustomerType('Walk-in')}
                      className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                        saleCustomerType === 'Walk-in' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      Walk-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleCustomerType('Credit')}
                      className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                        saleCustomerType === 'Credit' ? 'bg-orange-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      Credit Account
                    </button>
                  </div>
                </div>

                {saleCustomerType === 'Credit' ? (
                  <div>
                    <select
                      value={saleCustomerId}
                      onChange={(e) => {
                        setSaleCustomerId(e.target.value);
                        const c = customers.find(cust => cust.id === e.target.value);
                        if (c) setSaleCustomerName(c.name);
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="">-- Select Registered Credit Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name (Optional)"
                      value={saleCustomerName}
                      onChange={(e) => setSaleCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Vehicle No (e.g. WP-CA-4491)"
                      value={saleVehicleNo}
                      onChange={(e) => setSaleVehicleNo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 5. Payment Method & Cashier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Cash">Physical Cash</option>
                    <option value="Card">Card / POS Terminal</option>
                    <option value="Credit">Credit / Account Chitty</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Handled By
                  </label>
                  <input
                    type="text"
                    value={saleSoldBy}
                    onChange={(e) => setSaleSoldBy(e.target.value)}
                    placeholder="Cashier Name"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Total Calculation Banner */}
              <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-orange-900 uppercase tracking-wider block">
                    Total Sale Value
                  </span>
                  <span className="text-[10px] text-orange-700">
                    {saleQty} × {formatRsPlain(saleUnitPrice)}
                  </span>
                </div>
                <span className="text-lg font-black text-orange-900 tabular-nums">
                  {formatRs(saleQty * saleUnitPrice)}
                </span>
              </div>

              {/* Form Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saleSubmitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saleSubmitting ? (
                    <span>Recording...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Counter Sale</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CALIBRATE STOCK & EDIT PRICES */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-orange-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Calibrate Stock &amp; Rates ({editingItem.brand} {editingItem.cylinderSize})
                </h3>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Full Cylinders in Hand
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStockFull}
                    onChange={(e) => setEditStockFull(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Empty Cylinders in Hand
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStockEmpty}
                    onChange={(e) => setEditStockEmpty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Refill Selling Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editRefillPrice}
                    onChange={(e) => setEditRefillPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    New Package Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPackagePrice}
                    onChange={(e) => setEditPackagePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Dealer Buying Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editBuyingPrice}
                    onChange={(e) => setEditBuyingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editMinThreshold}
                    onChange={(e) => setEditMinThreshold(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl shadow-md shadow-orange-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
