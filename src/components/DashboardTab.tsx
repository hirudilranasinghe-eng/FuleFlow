/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  Fuel, TrendingUp, AlertTriangle, Users, ArrowUpRight, 
  Calendar, CheckCircle2, ShoppingBag, Droplet, Clock, Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts';
import { Employee, FuelTank, Pump, Shift } from '../types';

interface DashboardTabProps {
  employees: Employee[];
  tanks: FuelTank[];
  pumps?: Pump[];
  activeShift: Shift | null;
  shiftHistory: Shift[];
  setActiveTab: (tab: string) => void;
}

export default function DashboardTab({
  employees,
  tanks,
  activeShift,
  shiftHistory,
  setActiveTab,
}: DashboardTabProps) {

  // Computations
  const totalStockLitres = useMemo(() => tanks.reduce((acc, t) => acc + t.currentLevel, 0), [tanks]);
  const totalStockCapacity = useMemo(() => tanks.reduce((acc, t) => acc + t.capacity, 0), [tanks]);
  const stockPercentage = Math.round((totalStockLitres / totalStockCapacity) * 100);

  const lowStockTanks = useMemo(() => {
    return tanks.filter(t => (t.currentLevel / t.capacity) < 0.40);
  }, [tanks]);

  const activePumpersCount = useMemo(() => {
    return employees.filter(e => e.role === 'Pumper' && e.status === 'On Shift').length;
  }, [employees]);

  const todayRevenue = useMemo(() => {
    let rev = activeShift ? activeShift.totalNetSales : 0;
    // Add shifts from today in history
    const todayStr = new Date().toISOString().slice(0, 10);
    shiftHistory.forEach(s => {
      if (s.startTime.startsWith(todayStr)) {
        rev += s.totalNetSales;
      }
    });
    return rev;
  }, [activeShift, shiftHistory]);

  const todayFuelSold = useMemo(() => {
    let sold = activeShift ? activeShift.totalNetSold : 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    shiftHistory.forEach(s => {
      if (s.startTime.startsWith(todayStr)) {
        sold += s.totalNetSold;
      }
    });
    return sold;
  }, [activeShift, shiftHistory]);

  // Recharts Chart Data Computations (Last 6 completed shifts)
  const chartData = useMemo(() => {
    // Generate past 6 shifts sales for comparison
    const list = [...shiftHistory].slice(0, 6).reverse();
    if (activeShift && list.length < 6 && !list.some(s => s.id === activeShift.id)) {
      list.push(activeShift);
    }
    return list.map(s => {
      const dateStr = s.startTime 
        ? new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Shift';
      const fullDateStr = s.startTime 
        ? new Date(s.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      return {
        shiftId: s.id,
        shiftName: s.name,
        name: `${s.name.replace(/Shift\s*/i, '')} (${dateStr})`,
        shortName: s.name,
        date: dateStr,
        fullDate: fullDateStr,
        sales: s.totalNetSales || 0,
        liters: s.totalNetSold || 0,
      };
    });
  }, [activeShift, shiftHistory]);

  const maxSaleValue = useMemo(() => {
    const vals = chartData.map(d => d.sales);
    return vals.length > 0 ? Math.max(...vals, 1000) : 1000;
  }, [chartData]);

  // Product sales mix (Petrol vs Diesel)
  const productMix = useMemo(() => {
    let petrolLiters = 0;
    let dieselLiters = 0;
    
    // Combine active shift and history
    const allShifts = activeShift ? [activeShift, ...shiftHistory] : shiftHistory;
    allShifts.forEach(s => {
      s.pumpReadings.forEach(r => {
        const sold = Math.max(0, r.endMeter - r.startMeter - r.testingQty);
        if (r.fuelType.toLowerCase().includes('petrol')) {
          petrolLiters += sold;
        } else {
          dieselLiters += sold;
        }
      });
    });

    const total = petrolLiters + dieselLiters || 1;
    return {
      petrol: Math.round((petrolLiters / total) * 100),
      diesel: Math.round((dieselLiters / total) * 100),
      petrolLiters,
      dieselLiters
    };
  }, [activeShift, shiftHistory]);

  const formatCurrency = (val: number) => {
    return `Rs. ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  const formatLiters = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val) + ' L';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3.5 border border-gray-200/90 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[210px] pointer-events-none">
          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5 gap-2">
            <span className="font-extrabold text-[#1C1C1C]">{data.shiftName}</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md tabular-nums">{data.shiftId}</span>
          </div>
          {data.fullDate && (
            <div className="text-[10px] text-gray-500 font-medium">
              {data.fullDate}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-gray-500 font-medium">Fuel Dispensed:</span>
            <span className="font-bold text-gray-800 tabular-nums">{formatLiters(data.liters)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">Net Sales Revenue:</span>
            <span className="font-extrabold text-blue-600 tabular-nums text-sm">{formatCurrency(data.sales)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="dashboard-tab-root" className="space-y-4">
      {/* Welcome Banner */}
      <div id="db-welcome-banner" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            FuelFlow Station Dashboard
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Real-time visual summary of current sales, stocks, and team operations
          </p>
        </div>
        
        {/* Date visual */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm text-sm text-[#1C1C1C] font-medium">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main Stats Row */}
      <div id="db-stats-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Today's Net Revenue - Gradient Accent Card matching image_0.png */}
        <div className="bg-[#E8F1F5] p-5 rounded-2xl border border-[#D0E2EB] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Today's Sales Revenue</span>
              <span className="text-3xl tabular-nums font-extrabold text-[#1C1C1C] mt-2 block tracking-tight">
                {formatCurrency(todayRevenue)}
              </span>
            </div>
            <div className="p-3 bg-white shadow-sm rounded-xl text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              +12.4%
            </span>
            <span>vs yesterday</span>
          </div>
        </div>

        {/* Total Litres Sold */}
        <div className="bg-[#E8F1F5] p-5 rounded-2xl border border-[#D0E2EB] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Today's Fuel Dispensed</span>
              <span className="text-2xl tabular-nums font-extrabold text-[#1C1C1C] mt-2 block tracking-tight">
                {formatLiters(todayFuelSold)}
              </span>
            </div>
            <div className="p-3 bg-white shadow-sm rounded-xl text-blue-600">
              <Droplet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-semibold text-blue-600">Liters</span>
            <span>computed automatically</span>
          </div>
        </div>

        {/* Total Underground Stock */}
        <div className="bg-[#E8F1F5] p-5 rounded-2xl border border-[#D0E2EB] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Underground Stock</span>
              <span className="text-2xl tabular-nums font-extrabold text-[#1C1C1C] mt-2 block tracking-tight">
                {formatLiters(totalStockLitres)}
              </span>
            </div>
            <div className="p-3 bg-white shadow-sm rounded-xl text-emerald-600">
              <Fuel className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5 text-xs text-gray-500">
            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${stockPercentage < 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
            <span className="font-bold text-[#1C1C1C]">{stockPercentage}%</span>
          </div>
        </div>

        {/* Active Pumpers */}
        <div className="bg-[#E8F1F5] p-5 rounded-2xl border border-[#D0E2EB] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Pumpers On Duty</span>
              <span className="text-2xl tabular-nums font-extrabold text-[#1C1C1C] mt-2 block tracking-tight">
                {activePumpersCount} Active
              </span>
            </div>
            <div className="p-3 bg-white shadow-sm rounded-xl text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Active Shift:</span>
            <span>{activeShift ? 'Yes' : 'No Active Shift'}</span>
          </div>
        </div>
      </div>

      {/* Alert Banner for Low Stock (Only displays if low stock exists!) */}
      {lowStockTanks.length > 0 && (
        <div id="db-low-stock-alert" className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-amber-200 text-sm">Low Stock Alert!</h4>
              <p className="text-amber-300/90 text-xs mt-0.5">
                The following tanks are below the 40% safety reserve threshold. Prepare to trigger supplier orders:
                <span className="font-semibold text-[#1C1C1C]"> {lowStockTanks.map(t => `${t.name} (${Math.round((t.currentLevel/t.capacity)*100)}%)`).join(', ')}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('stock')}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-[#1C1C1C] font-bold text-xs rounded-lg transition-all cursor-pointer self-start sm:self-center"
          >
            Manage Stock
          </button>
        </div>
      )}

      {/* Graphs / Main Analytics Grid */}
      <div id="db-analytics-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts Bar Chart (Liters/Sales Revenue trends) */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#1C1C1C] text-base">Shift Sales Performance</h3>
              <p className="text-xs text-gray-500 mt-0.5">Revenue tracking over the past 6 shifts</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-100/80 px-2.5 py-1 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-blue-900 font-bold">Sales Net (Rs.)</span>
              </div>
            </div>
          </div>

          {/* Recharts Bar Chart Container with Explicit Height */}
          <div className="w-full h-[300px] min-h-[300px] pt-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 15, right: 10, left: 15, bottom: 25 }}>
                  <defs>
                    <linearGradient id="salesBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    dy={8}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val >= 1000 ? `Rs. ${(val / 1000).toFixed(0)}k` : `Rs. ${val}`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                  <Bar 
                    dataKey="sales" 
                    name="Sales Net (Rs.)" 
                    fill="url(#salesBarGrad)" 
                    radius={[8, 8, 0, 0]} 
                    maxBarSize={52} 
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-medium">
                Insufficient sales history to populate performance chart.
              </div>
            )}
          </div>
        </div>

        {/* Product Mix Donut & Tank Overview */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#1C1C1C] text-base">Fuel Mix Ratio</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ratio breakdown of Petrol vs Diesel sales</p>
          </div>

          <div className="my-6 flex justify-center relative items-center">
            {/* Simple visual SVG Pie/Donut Chart */}
            <svg viewBox="0 0 100 100" className="w-36 h-36">
              {/* Petrol Arc */}
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="transparent"
                stroke="#3B82F6"
                strokeWidth="15"
                strokeDasharray={`${productMix.petrol * 2.2} 220`}
                className="transform -rotate-90 origin-center transition-all duration-500"
              />
              {/* Diesel Arc */}
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="15"
                strokeDasharray={`${productMix.diesel * 2.2} 220`}
                strokeDashoffset={`-${productMix.petrol * 2.2}`}
                className="transform -rotate-90 origin-center transition-all duration-500"
              />
              {/* Matching glass panel bg to form beautiful donut */}
              <circle cx="50" cy="50" r="27" fill="#FFFFFF" />
            </svg>
            <div className="absolute text-center">
              <span className="text-lg font-bold text-[#1C1C1C] font-sans">{productMix.petrol}%</span>
              <span className="text-[9px] text-blue-600 block font-bold uppercase">Petrol</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600 font-medium">Petrol Products</span>
              </div>
              <span className="tabular-nums font-bold text-[#1C1C1C]">{formatLiters(productMix.petrolLiters)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-gray-600 font-medium">Diesel Products</span>
              </div>
              <span className="tabular-nums font-bold text-[#1C1C1C]">{formatLiters(productMix.dieselLiters)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Recent Shifts and Quick Navigation Actions */}
      <div id="db-bottom-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Completed Shifts Table */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#1C1C1C] text-base">Recent Shift Closures</h3>
              <p className="text-xs text-gray-500 mt-0.5">Summary of the last completed shifts</p>
            </div>
            <button 
              onClick={() => setActiveTab('sales')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              See All History
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="pb-3">Shift ID</th>
                  <th className="pb-3">Shift Name</th>
                  <th className="pb-3 text-right">Fuel Sold</th>
                  <th className="pb-3 text-right">Revenue</th>
                  <th className="pb-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {shiftHistory.slice(0, 3).map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 tabular-nums font-bold text-blue-600">{s.id}</td>
                    <td className="py-3 text-gray-700">{s.name}</td>
                    <td className="py-3 text-right tabular-nums font-semibold text-gray-600">{s.totalNetSold.toFixed(2)} L</td>
                    <td className="py-3 text-right tabular-nums font-bold text-[#1C1C1C]">{formatCurrency(s.totalNetSales)}</td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                        Closed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Center Widget */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-[#1C1C1C] text-base">Quick Action Center</h3>
            <p className="text-xs text-gray-500 mt-0.5">Automated workflows for fast control</p>
          </div>

          <div className="space-y-2.5 my-4">
            <button
              onClick={() => setActiveTab('shift')}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50 text-left transition-all duration-200 group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1C1C1C] block">Manage Active Shift</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Enter live meters & assignments</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
            </button>

            <button
              onClick={() => setActiveTab('stock')}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50 text-left transition-all duration-200 group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Fuel className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1C1C1C] block">Log Tanker Delivery</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Add wholesale stock deliveries</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-600 transition-colors" />
            </button>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] text-gray-500 flex gap-2">
            <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <span>Underground storage levels are dynamically linked with shift meter closures to prevent inventory leaks.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
