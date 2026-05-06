/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransactionCategory, NecessityType } from './types';
import {
  Utensils,
  Car,
  Gamepad2,
  ShoppingBag,
  Stethoscope,
  Receipt,
  MoreHorizontal,
  Coins,
  Home,
  TrendingUp,
  Gift,
  GraduationCap,
  ArrowRightLeft,
} from 'lucide-react';

export const CURRENCY = 'SAR'; // Default to Saudi Riyal, can be dynamic later

export const CATEGORIES: Record<TransactionCategory, { label: string; icon: any; color: string }> = {
  salary: { label: 'راتب', icon: Coins, color: 'bg-emerald-100 text-emerald-600' },
  living: { label: 'سكن وتحسينات', icon: Home, color: 'bg-slate-100 text-slate-600' },
  bills: { label: 'فواتير والتزامات', icon: Receipt, color: 'bg-amber-100 text-amber-600' },
  food: { label: 'طعام', icon: Utensils, color: 'bg-orange-100 text-orange-600' },
  transport: { label: 'مواصلات وبنزين', icon: Car, color: 'bg-blue-100 text-blue-600' },
  health: { label: 'صحة وعافية', icon: Stethoscope, color: 'bg-rose-100 text-rose-600' },
  shopping: { label: 'تسوق ومستلزمات', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
  entertainment: { label: 'ترفيه وطلعات', icon: Gamepad2, color: 'bg-indigo-100 text-indigo-600' },
  investment: { label: 'استثمار', icon: TrendingUp, color: 'bg-teal-100 text-teal-600' },
  gift: { label: 'هدايا', icon: Gift, color: 'bg-red-100 text-red-600' },
  other: { label: 'أخرى', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
  transfer: { label: 'تحويل', icon: ArrowRightLeft, color: 'bg-amber-100 text-amber-600' },
};

export const NECESSITY_LABELS: Record<NecessityType, string> = {
  necessity: 'ضروريات',
  luxury: 'كماليات',
};

export const WALLET_LABELS: Record<string, string> = {
  cash: 'كاش',
  bank: 'صرافة',
  emergency: 'الطوارئ',
  savings: 'الادخار',
};

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];
