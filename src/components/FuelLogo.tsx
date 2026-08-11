/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface FuelLogoProps {
  variant?: 'full' | 'mark' | 'badge';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FuelFMarkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fMarkGradGlobal" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#111827" />
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

export default function FuelLogo({ variant = 'full', size = 'md', className = '' }: FuelLogoProps) {
  if (variant === 'badge') {
    const sizeClasses = size === 'sm' ? 'w-8 h-8 p-1.5' : size === 'lg' ? 'w-12 h-12 p-2.5' : 'w-10 h-10 p-2';
    return (
      <div className={`${sizeClasses} rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0 ${className}`}>
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
    return <FuelFMarkIcon className={className || "w-6 h-6"} />;
  }

  const maxWidth = size === 'sm' ? 'max-w-[130px]' : size === 'lg' ? 'max-w-[200px]' : 'max-w-[160px]';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 230 65" className={`w-full ${maxWidth} h-auto drop-shadow-sm mix-blend-multiply`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fGradientComp" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#111827" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path d="M 12 62 L 12 16 C 12 7.2 19.2 0 28 0 L 50 0 L 36 14 L 26 14 L 26 24 L 42 24 L 28 38 L 26 38 L 26 48 Z" fill="url(#fGradientComp)" />
        <text x="62" y="42" fontFamily="Inter, system-ui, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-0.5">
          <tspan fill="#111827">Fuel</tspan>
          <tspan fill="#3B82F6">Flow</tspan>
        </text>
      </svg>
    </div>
  );
}
