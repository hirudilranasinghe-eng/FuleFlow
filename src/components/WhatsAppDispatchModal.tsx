/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, Copy, Check, X, Smartphone, MessageCircle, 
  ExternalLink, Fuel, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { Shift, Employee, FuelTank, OilTank } from '../types';
import { 
  generateWhatsAppShiftReport, 
  getWhatsAppDispatchUrl, 
  getSavedWhatsAppRecipientPhone, 
  saveWhatsAppRecipientPhone,
  cleanPhoneNumberForWhatsApp
} from '../lib/whatsappService';

interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  employees: Employee[];
  tanks: FuelTank[];
  oilTanks?: OilTank[];
  isJustClosed?: boolean;
}

export default function WhatsAppDispatchModal({
  isOpen,
  onClose,
  shift,
  employees,
  tanks,
  oilTanks = [],
  isJustClosed = false
}: WhatsAppDispatchModalProps) {
  const [recipientPhone, setRecipientPhone] = useState<string>(() => getSavedWhatsAppRecipientPhone());
  const [copied, setCopied] = useState<boolean>(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<boolean>(false);

  // Sync phone on open
  useEffect(() => {
    if (isOpen) {
      setRecipientPhone(getSavedWhatsAppRecipientPhone());
      setCopied(false);
      setDispatchSuccess(false);
    }
  }, [isOpen]);

  // Generate WhatsApp Message
  const messageText = useMemo(() => {
    if (!shift) return '';
    return generateWhatsAppShiftReport(shift, employees, tanks, oilTanks);
  }, [shift, employees, tanks, oilTanks]);

  const cleanDigits = useMemo(() => {
    return cleanPhoneNumberForWhatsApp(recipientPhone);
  }, [recipientPhone]);

  const waUrl = useMemo(() => {
    return getWhatsAppDispatchUrl(recipientPhone, messageText);
  }, [recipientPhone, messageText]);

  if (!isOpen || !shift) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRecipientPhone(val);
    saveWhatsAppRecipientPhone(val);
  };

  const handleCopy = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    if (!messageText) return;
    saveWhatsAppRecipientPhone(recipientPhone);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 4000);
  };

  const supervisorName = employees.find(e => e.id === shift.supervisorId || (shift as any).supervisorid === e.id)?.name || (shift as any).supervisorName || 'Supervisor';

  return (
    <div id="whatsapp-modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <div id="whatsapp-modal-card" className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-inner">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                  {isJustClosed ? 'Shift Closed • WhatsApp Summary' : 'WhatsApp Shift Summary Digest'}
                </h3>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums">
                  {shift.id}
                </span>
              </div>
              <p className="text-emerald-100 text-xs mt-0.5">
                {shift.name} • Supervisor: {supervisorName}
              </p>
            </div>
          </div>
          <button
            id="btn-close-whatsapp-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-sans text-xs">
          
          {/* Confirmation Notice if Just Closed */}
          {isJustClosed && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Shift successfully closed and ledger locked.</span> Ready for 1-click dispatch to station owner/manager.
              </div>
            </div>
          )}

          {/* Recipient Phone Configuration */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="whatsapp-phone-input" className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Owner / Manager WhatsApp Number</span>
              </label>
              {cleanDigits && (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-md tabular-nums">
                  Target: +{cleanDigits}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="whatsapp-phone-input"
                type="text"
                value={recipientPhone}
                onChange={handlePhoneChange}
                placeholder="e.g. 077 123 4567 or +94 77 123 4567"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#1C1C1C] tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-[10px] text-gray-500">
              Number is saved automatically. If left empty, WhatsApp will open contact picker.
            </p>
          </div>

          {/* Formatted Message Live Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                Live WhatsApp Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-gray-600 hover:text-[#1C1C1C] flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-extrabold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-gray-500" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-[#D1D7DB] text-slate-800 shadow-inner font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all max-h-60 overflow-y-auto">
              {messageText}
            </div>
          </div>

          {/* Quick status alert after click */}
          {dispatchSuccess && (
            <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>WhatsApp Web/App opened in new tab!</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
          >
            Done / Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              id="btn-send-whatsapp-digest"
              type="button"
              onClick={handleSendWhatsApp}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>📲 Send WhatsApp Summary to Owner/Manager</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
