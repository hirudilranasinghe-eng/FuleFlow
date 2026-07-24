/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, UserCheck, ShieldAlert, Phone, 
  Trash2, User, X, Check, Edit, AlertCircle, RefreshCcw
} from 'lucide-react';
import { Employee } from '../types';
import { supabase } from '../lib/supabase';

interface EmployeesTabProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

export default function EmployeesTab({ employees, setEmployees }: EmployeesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'Supervisor' | 'Pumper'>('Pumper');
  const [newPhone, setNewPhone] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Status modify states
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  // Available random avatar background colors
  const avatarColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-pink-500', 
    'bg-purple-500', 'bg-indigo-500', 'bg-amber-500', 
    'bg-teal-500', 'bg-orange-500'
  ];

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query) ||
      emp.phone.toLowerCase().includes(query) ||
      emp.status.toLowerCase().includes(query)
    );
  });

  // Handle adding new employee
  const handleAddEmployeeSubmit = async () => {
    if (!newName.trim()) {
      setModalError('Employee name is required.');
      return;
    }
    if (!newPhone.trim()) {
      setModalError('Employee contact number is required.');
      return;
    }

    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const newEmp: Employee = {
      id: `emp-${Date.now().toString().slice(-4)}`,
      name: newName,
      role: newRole,
      phone: newPhone,
      status: 'Active',
      avatarColor: randomColor
    };
    
    const dbPayload = {
      id: newEmp.id,
      name: newEmp.name,
      role: newEmp.role,
      phone: newEmp.phone,
      status: newEmp.status,
      avatarcolor: newEmp.avatarColor
    };

    try {
      const { data, error } = await supabase.from('employees').insert([dbPayload]).select();
      if (error) {
        if (
          error.message?.toLowerCase().includes('row-level security') ||
          error.message?.toLowerCase().includes('policy') ||
          error.code === '42501'
        ) {
          console.warn("Supabase RLS active. Saving employee locally.");
        } else {
          console.error("Supabase Error:", error.message, error.details, error.hint);
          setModalError(error.message || 'Failed to insert employee into database.');
          return;
        }
      }
      setEmployees([...employees, newEmp]);
      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setModalError(null);
    } catch (err: any) {
      console.error("Supabase Error:", err);
      setModalError(err.message || 'An unexpected error occurred.');
    }
  };

  // Toggle Employee Status (Active, Off-duty, Suspended)
  const handleChangeStatus = (id: string, currentStatus: Employee['status']) => {
    let nextStatus: Employee['status'] = 'Active';
    if (currentStatus === 'Active') nextStatus = 'Off-duty';
    else if (currentStatus === 'Off-duty') nextStatus = 'Suspended';
    else if (currentStatus === 'Suspended') nextStatus = 'Active';
    else if (currentStatus === 'On Shift') {
      // Don't let users change status of someone actively on shift without closing shift first!
      alert("This employee is currently assigned to an active shift. Close the active shift first before updating their duty status.");
      return;
    }

    const updated = employees.map(e => {
      if (e.id === id) {
        return {
          ...e,
          status: nextStatus
        };
      }
      return e;
    });

    setEmployees(updated);
  };

  // Remove Employee
  const handleRemoveEmployee = async (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp && emp.status === 'On Shift') {
      alert("Cannot remove an employee currently on active shift!");
      return;
    }
    if (confirm("Are you sure you want to remove this employee? This will delete them from the roster.")) {
      const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      if (isConfigured) {
        try {
          const { error } = await supabase.from('employees').delete().eq('id', id);
          if (error) console.warn("Supabase employee delete error:", error.message);
        } catch (err) {
          console.warn("Employee delete error:", err);
        }
      }
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      localStorage.setItem('fms_employees', JSON.stringify(updated));
    }
  };

  return (
    <div id="employees-tab-root" className="space-y-4">
      {/* Page Header */}
      <div id="emp-header-section" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight font-sans">
            Staff & Employee Roster
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage station supervisors, active pumpers, duty shifts, and contact profiles
          </p>
        </div>

        <button
          id="btn-add-employee"
          onClick={() => {
            setModalError(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-[#1C1C1C] font-bold text-sm rounded-xl hover:brightness-110 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {/* Roster Container Card */}
      <div id="emp-table-card" className="glass-panel rounded-2xl overflow-hidden">
        {/* Controls */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50">
          <span className="text-sm font-bold text-[#1C1C1C] uppercase tracking-wider">Registered Staff</span>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, role or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[#1C1C1C] text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Employees Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map((emp) => {
              const initials = emp.name.split(' ').map(n => n[0]).join('');
              
              return (
                <div 
                  key={emp.id} 
                  className="glass-panel rounded-2xl p-5 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(0,123,255,0.15)] transition-all duration-300 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    {/* Role badge */}
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      emp.role === 'Supervisor' 
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                        : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}>
                      {emp.role}
                    </span>

                    {/* Status indicator */}
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      emp.status === 'On Shift' 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                        : emp.status === 'Active'
                        ? 'bg-blue-500/15 text-blue-600 border-blue-500/20'
                        : emp.status === 'Off-duty'
                        ? 'bg-gray-100 text-gray-500 border-gray-100'
                        : 'bg-red-500/15 text-red-400 border-red-500/20'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        emp.status === 'On Shift' 
                          ? 'bg-emerald-500 animate-pulse' 
                          : emp.status === 'Active'
                          ? 'bg-blue-500'
                          : emp.status === 'Off-duty'
                          ? 'bg-gray-400'
                          : 'bg-red-500'
                      }`} />
                      {emp.status}
                    </span>
                  </div>

                  {/* Employee Info Block */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${emp.avatarColor} text-[#1C1C1C] flex items-center justify-center font-bold text-base shadow-sm shadow-black/20`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#1C1C1C] text-base leading-snug">{emp.name}</h3>
                      <span className="text-[10px] text-gray-500 tabular-nums font-semibold mt-0.5 block">{emp.id}</span>
                    </div>
                  </div>

                  {/* Phone contact */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                    <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="tabular-nums font-semibold">{emp.phone}</span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <button
                      onClick={() => handleChangeStatus(emp.id, emp.status)}
                      className="text-xs text-gray-500 hover:text-blue-600 hover:underline font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      <span>Rotate Status</span>
                    </button>

                    <button
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500 text-sm">
              No staff members found matching search query.
            </div>
          )}
        </div>
      </div>

      {/* --- ADD NEW EMPLOYEE MODAL --- */}
      {isAddModalOpen && (
        <div id="add-emp-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div id="add-emp-card" className="bg-gray-50 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-[#1C1C1C] text-lg">Add New Employee Profile</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-[#1C1C1C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs flex items-start gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Employee Name */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Assigned Station Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewRole('Pumper')}
                    className={`p-3 border rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
                      newRole === 'Pumper' 
                        ? 'border-[#00BFFF] bg-[#00BFFF]/10 text-blue-600 shadow-xs' 
                        : 'border-gray-200 text-gray-500 bg-transparent hover:bg-gray-100'
                    }`}
                  >
                    Fuel Pumper
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('Supervisor')}
                    className={`p-3 border rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
                      newRole === 'Supervisor' 
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400 shadow-xs' 
                        : 'border-gray-200 text-gray-500 bg-transparent hover:bg-gray-100'
                    }`}
                  >
                    Station Supervisor
                  </button>
                </div>
              </div>

              {/* Phone contact */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Contact Number (Phone)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +94 77 123 4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 text-[#1C1C1C] rounded-xl text-sm tabular-nums font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-transparent border border-gray-200 text-gray-600 font-medium text-xs rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEmployeeSubmit}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-[#00BFFF] text-[#1C1C1C] font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Register Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
