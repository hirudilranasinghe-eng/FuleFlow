/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, Clock, Fuel, BarChart3, Users, Settings, Droplet, Tag } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'shift', name: 'Shift Management', icon: Clock },
    { id: 'stock', name: 'Fuel Stock', icon: Fuel },
    { id: 'sales', name: 'Daily Sales', icon: BarChart3 },
    { id: 'price', name: 'Price Management', icon: Tag },
    { id: 'employees', name: 'Employees', icon: Users },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div id="sidebar-container" className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-20">
      {/* Brand Logo */}
      <div id="brand-logo" className="p-6 pb-2 w-full flex justify-center">
        <svg viewBox="0 0 230 65" className="w-full max-w-[160px] h-auto drop-shadow-sm mix-blend-multiply" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="fGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#111827" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <path d="M 12 62 L 12 16 C 12 7.2 19.2 0 28 0 L 50 0 L 36 14 L 26 14 L 26 24 L 42 24 L 28 38 L 26 38 L 26 48 Z" fill="url(#fGradient)" />
          <text x="62" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-0.5">
            <tspan fill="#111827">Fuel</tspan>
            <tspan fill="#3B82F6">Flow</tspan>
          </text>
        </svg>
      </div>

      {/* Navigation Menu Links */}
      <div id="sidebar-menu" className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`tab-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 border border-transparent ${
                isActive
                  ? 'bg-gray-100/80 text-[#1C1C1C]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-105 text-[#1C1C1C]' : 'text-gray-500 group-hover:text-gray-500'}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* Footer/User session info */}
      <div id="sidebar-footer" className="p-6">
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm">
            FF
          </div>
          <div className="overflow-hidden">
            <span className="text-sm font-semibold text-[#1C1C1C] block truncate">Station Admin</span>
            <span className="text-xs text-gray-500 block truncate">V1.4.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
