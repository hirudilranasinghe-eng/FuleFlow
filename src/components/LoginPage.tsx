/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, LogIn, Fuel, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AuthUser, resolveUserRole } from '../types';
import { supabase } from '../lib/supabase';

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
    <div id="login-page-root" className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-900 to-slate-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Glow & Shapes */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center space-y-3 mb-6">
          <div className="flex justify-center">
            <svg viewBox="0 0 230 65" className="w-48 h-auto drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="loginFGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#111827" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
              </defs>
              <path d="M 12 62 L 12 16 C 12 7.2 19.2 0 28 0 L 50 0 L 36 14 L 26 14 L 26 24 L 42 24 L 28 38 L 26 38 L 26 48 Z" fill="url(#loginFGradient)" />
              <text x="62" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-0.5">
                <tspan fill="#111827">Fuel</tspan>
                <tspan fill="#3B82F6">Flow</tspan>
              </text>
            </svg>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-tight">
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
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-[#1C1C1C] outline-none transition-all"
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
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-2xl text-sm font-medium text-[#1C1C1C] outline-none transition-all"
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
            className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400 font-medium">
            FuelFlow Station Operating System • Version 1.4.2
          </p>
        </div>
      </motion.div>
    </div>
  );
}
