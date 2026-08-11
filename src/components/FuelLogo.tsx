/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface FuelLogoProps {
  variant?: 'full' | 'mark' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark'; // 'dark' = for dark backgrounds (white "Fuel" text)
  className?: string;
}

export function FuelFMarkIcon({ className = "w-6 h-6", isDark = false }: { className?: string; isDark?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fMarkGradGlobal" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isDark ? "#FFFFFF" : "#111827"} />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path
        d="M 12 58 L 12 14 C 12 6.2 18.2 0 26 0 L 48 0 L 34 14 L 24 14 L 24 24 L 40 24 L 26 38 L 24 38 L 24 58 Z"
        fill="url(#fMarkGradGlobal)"
      />
    </svg>
  );
}

export default function FuelLogo({ variant = 'full', size = 'md', theme = 'light', className = '' }: FuelLogoProps) {
  const isDarkBg = theme === 'dark';

  if (variant === 'badge') {
    const sizeClasses = 
      size === 'sm' ? 'w-8 h-8 p-1.5' : 
      size === 'xl' ? 'w-16 h-16 p-3.5' : 
      size === 'lg' ? 'w-12 h-12 p-2.5' : 'w-10 h-10 p-2';
    return (
      <div className={`${sizeClasses} rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-600 flex items-center justify-center text-white shadow-lg flex-shrink-0 ${className}`}>
        <svg viewBox="0 0 64 64" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 12 58 L 12 14 C 12 6.2 18.2 0 26 0 L 48 0 L 34 14 L 24 14 L 24 24 L 40 24 L 26 38 L 24 38 L 24 58 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'mark') {
    const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'xl' ? 'w-10 h-10' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
    return <FuelFMarkIcon className={`${sizeClass} ${className}`} isDark={isDarkBg} />;
  }

  const maxWidth = 
    size === 'sm' ? 'max-w-[130px]' : 
    size === 'xl' ? 'max-w-[280px]' : 
    size === 'lg' ? 'max-w-[210px]' : 'max-w-[160px]';

  const gradId = isDarkBg ? "fGradientCompDark" : "fGradientCompLight";
  const textColor = isDarkBg ? "#FFFFFF" : "#111827";
  const startColor = isDarkBg ? "#60A5FA" : "#111827";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 230 65" className={`w-full ${maxWidth} h-auto drop-shadow-md`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <path d="M 12 62 L 12 16 C 12 7.2 19.2 0 28 0 L 50 0 L 36 14 L 26 14 L 26 24 L 42 24 L 28 38 L 26 38 L 26 48 Z" fill={`url(#${gradId})`} />
        <text x="62" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-0.5">
          <tspan fill={textColor}>Fuel</tspan>
          <tspan fill="#3B82F6">Flow</tspan>
        </text>
      </svg>
    </div>
  );
}
