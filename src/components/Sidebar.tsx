/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, Clock, Fuel, BarChart3, FileText, Users, Tag, ShieldCheck, LogOut } from 'lucide-react';
import { AuthUser, resolveUserRole } from '../types';
import FuelLogo from './FuelLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

function getInitials(name?: string): string {
  if (!name) return 'FF';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Sidebar({ activeTab, setActiveTab, user, onLogout }: SidebarProps) {
  const { role, roleTitle } = resolveUserRole(user?.email, user?.role);
  const isAdmin = role === 'admin';

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'shift', name: 'Shift Management', icon: Clock },
    { id: 'stock', name: 'Fuel Stock', icon: Fuel },
    { id: 'sales', name: 'Daily Sales', icon: BarChart3 },
    { id: 'reports', name: 'Reports', icon: FileText },
    { id: 'customers', name: 'Customers & Credit', icon: Users },
    ...(isAdmin ? [{ id: 'admin', name: 'Admin Control', icon: ShieldCheck }] : []),
  ];


  const userName = user?.name || (isAdmin ? 'Rumesh Anjana' : 'Station User');
  const userRoleDisplay = isAdmin ? 'System Admin' : 'User';
  const initials = getInitials(userName);

  return (
    <div id="sidebar-container" className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-20">
      {/* Brand Logo */}
      <div id="brand-logo" className="p-6 pb-2 w-full flex justify-center">
        <FuelLogo variant="full" size="md" />
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
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 border border-transparent cursor-pointer ${
                isActive
                  ? 'bg-gray-100/80 text-[#1C1C1C] font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-105 text-[#1C1C1C]' : 'text-gray-500 group-hover:text-gray-500'}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* Modern Dynamic User Profile Badge */}
      <div id="sidebar-footer" className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 hover:bg-gray-50 transition-colors shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className={`w-9 h-9 rounded-full ${user?.avatarColor || 'bg-gradient-to-tr from-blue-600 to-indigo-600'} text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm`}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="Online" />
            </div>

            <div className="min-w-0 overflow-hidden">
              <span className="text-xs font-bold text-[#1C1C1C] block truncate leading-snug">
                {userName}
              </span>
              <span className="text-[11px] text-gray-500 block truncate font-medium">
                {userRoleDisplay}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer flex-shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
