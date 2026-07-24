/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (supabaseUrl) {
  // Fix duplicate protocols e.g. "https:https://" or "https://https://"
  supabaseUrl = supabaseUrl.replace(/^(https?:)+/i, 'https://');
  // Fix multiple slashes after the protocol
  supabaseUrl = supabaseUrl.replace(/^https:\/+/i, 'https://');
  // Remove trailing /rest/v1/ or extra slashes
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '');
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

let resolvedTanksTableName = 'fuel_tanks';

export function getTanksTableName(): string {
  return resolvedTanksTableName;
}

export function setTanksTableName(name: 'fuel_tanks' | 'fuel_tank') {
  resolvedTanksTableName = name;
}


