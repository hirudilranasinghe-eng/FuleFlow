/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, LogIn, Fuel, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AuthUser, resolveUserRole } from '../types';
import { supabase } from '../lib/supabase';
import FuelLogo from './FuelLogo';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error || !data?.user) {
        setErrorMessage('Invalid email or password. Please verify your Supabase Auth account.');
        setIsLoading(false);
        return;
      }

      const u = data.user;
      const userEmail = u.email || email.trim();
      const { roleTitle } = resolveUserRole(userEmail, u.user_metadata?.role);

      const authUser: AuthUser = {
        id: u.id,
        email: userEmail,
        name: u.user_metadata?.full_name || u.user_metadata?.name || (roleTitle === 'System Admin' ? 'System Admin' : 'Station User'),
        role: roleTitle,
        avatarColor: roleTitle === 'System Admin' ? 'bg-blue-600' : 'bg-purple-600',
      };
      onLoginSuccess(authUser);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage('Invalid email or password. Please verify your Supabase Auth account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login-page-root" className="min-h-screen w-full bg-slate-950 flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* LEFT PANEL: 50% Width High-Tech Fuel Station Vector & Branding Banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 xl:p-14 flex-col items-center justify-between text-center overflow-hidden border-r border-slate-800/60">
        {/* Background Ambient Glows & Grid */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Header Branding (Centered & Enlarged) */}
        <div className="relative z-10 w-full flex justify-center pt-2">
          <FuelLogo variant="full" size="xl" theme="dark" className="transform scale-110 xl:scale-125 transition-transform" />
        </div>

        {/* Middle Vector Graphic Illustration & Hero Copy (Vertically & Horizontally Centered) */}
        <div className="relative z-10 my-auto py-6 max-w-lg mx-auto w-full flex flex-col items-center text-center">
          <div className="relative w-full aspect-video flex items-center justify-center">
            {/* Custom High-Tech Station & Smart Telemetry SVG Vector Illustration */}
            <svg 
              className="w-full h-full drop-shadow-[0_15px_30px_rgba(37,99,235,0.3)]" 
              viewBox="0 0 600 400" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="stationGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="pumpBody" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1E293B" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
                <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284C7" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
              </defs>

              {/* Station Canopy Structure */}
              <path d="M 40 60 L 560 60 L 520 100 L 80 100 Z" fill="url(#stationGlow)" opacity="0.6" />
              <line x1="40" y1="60" x2="560" y2="60" stroke="#60A5FA" strokeWidth="2" strokeDasharray="6 6" />
              <line x1="80" y1="100" x2="520" y2="100" stroke="#38BDF8" strokeWidth="3" />

              {/* Pillars */}
              <rect x="140" y="100" width="16" height="220" fill="#334155" />
              <rect x="440" y="100" width="16" height="220" fill="#334155" />

              {/* Ground Platform */}
              <line x1="20" y1="320" x2="580" y2="320" stroke="#475569" strokeWidth="2" />
              <polygon points="60,320 540,320 500,360 100,360" fill="#0F172A" opacity="0.8" />

              {/* Central Smart Fuel Dispenser */}
              <g transform="translate(230, 140)">
                <rect x="-10" y="170" width="160" height="15" rx="4" fill="#334155" />
                <rect x="0" y="0" width="140" height="170" rx="12" fill="url(#pumpBody)" stroke="#3B82F6" strokeWidth="2" />
                {/* Screen / Telemetry Display */}
                <rect x="20" y="20" width="100" height="55" rx="8" fill="#030712" stroke="#0284C7" strokeWidth="1.5" />
                <line x1="30" y1="38" x2="110" y2="38" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                <line x1="30" y1="52" x2="85" y2="52" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                {/* Fuel Nozzle & Hose */}
                <path d="M 140 80 Q 180 120 140 150" fill="none" stroke="#64748B" strokeWidth="6" strokeLinecap="round" />
                <rect x="135" y="140" width="14" height="24" rx="4" fill="#2563EB" />
                {/* Keypad */}
                <circle cx="45" cy="110" r="4" fill="#64748B" />
                <circle cx="70" cy="110" r="4" fill="#64748B" />
                <circle cx="95" cy="110" r="4" fill="#64748B" />
                <circle cx="45" cy="130" r="4" fill="#64748B" />
                <circle cx="70" cy="130" r="4" fill="#64748B" />
                <circle cx="95" cy="130" r="4" fill="#2563EB" />
              </g>

              {/* Glowing Digital Telemetry Ring */}
              <circle cx="120" cy="200" r="45" fill="none" stroke="#0284C7" strokeWidth="2" strokeDasharray="180 30" opacity="0.8" />
              <circle cx="120" cy="200" r="35" fill="none" stroke="#3B82F6" strokeWidth="1" strokeDasharray="100 20" opacity="0.6" />
              <text x="120" y="204" textAnchor="middle" fill="#38BDF8" fontSize="11" fontWeight="700" fontFamily="sans-serif">98.4%</text>

              {/* Data Streams */}
              <path d="M 120 155 Q 180 120 230 160" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
              <path d="M 370 180 Q 430 140 480 180" fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />

              {/* Right Gauge Widget */}
              <rect x="450" y="180" width="90" height="70" rx="10" fill="#020617" stroke="#10B981" strokeWidth="1.5" opacity="0.9" />
              <text x="495" y="208" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="800">FLOW OK</text>
              <text x="495" y="232" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="700">12,450 L</text>
            </svg>
          </div>

          <div className="mt-8 space-y-3 text-center">
            <h1 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Smart Fuel Station Management & Automation
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Real-time pump telemetry, automated stock reconciliation, and instant shift audit intelligence engineered for modern fuel stations.
            </p>
          </div>

          {/* Feature Badges (Centered) */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-2.5">
            <div className="px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Real-Time Meters</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shift Reconciliation</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" />
              <span>Automated Stock Monitoring</span>
            </div>
          </div>
        </div>

        {/* Bottom Banner Footer (Centered) */}
        <div className="relative z-10 w-full pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} FuelFlow Systems</span>
          <span className="font-mono">Enterprise v1.4.2</span>
        </div>
      </div>

      {/* RIGHT PANEL: 50% Width Centered Minimalist Login Form */}
      <div className="w-full lg:w-1/2 min-h-screen bg-slate-900 lg:bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative">
        {/* Subtle Ambient Background Lighting for Right Panel */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8 sm:p-10 relative z-10"
        >
          {/* Brand Header for Mobile / Desktop */}
          <div className="text-center space-y-3 mb-8">
            <div className="flex justify-center">
              <FuelLogo variant="full" size="lg" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#1C1C1C] tracking-tight">
                Station Management Portal
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Sign in with your station credentials to access active meters & shift ledgers
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@fuelflow.lk"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-[#1C1C1C] outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-[#1C1C1C] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 hover:scale-[1.01] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to FuelFlow</span>
                </>
              )}
            </button>
          </form>

          {/* Footer info */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 font-medium">
              FuelFlow Station Operating System • Version 1.4.2
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
