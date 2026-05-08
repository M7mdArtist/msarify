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
  ArrowRightLeft
} from 'lucide-react';

export const CURRENCY = 'SAR'; // Default to Saudi Riyal, can be dynamic later

export const CATEGORIES: Record<TransactionCategory, { label: string; icon: any; color: string }> = {
  salary: { label: 'cat_salary', icon: Coins, color: 'bg-emerald-100 text-emerald-600' },
  living: { label: 'cat_living', icon: Home, color: 'bg-slate-100 text-slate-600' },
  bills: { label: 'cat_bills', icon: Receipt, color: 'bg-amber-100 text-amber-600' },
  food: { label: 'cat_food', icon: Utensils, color: 'bg-orange-100 text-orange-600' },
  transport: { label: 'cat_transport', icon: Car, color: 'bg-blue-100 text-blue-600' },
  health: { label: 'cat_health', icon: Stethoscope, color: 'bg-rose-100 text-rose-600' },
  shopping: { label: 'cat_shopping', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
  entertainment: { label: 'cat_entertainment', icon: Gamepad2, color: 'bg-indigo-100 text-indigo-600' },
  investment: { label: 'cat_investment', icon: TrendingUp, color: 'bg-teal-100 text-teal-600' },
  gift: { label: 'cat_gift', icon: Gift, color: 'bg-red-100 text-red-600' },
  other: { label: 'cat_other', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
  transfer: { label: 'cat_transfer', icon: ArrowRightLeft, color: 'bg-amber-100 text-amber-600' },
};

export const NECESSITY_LABELS: Record<NecessityType, string> = {
  necessity: 'necessity',
  luxury: 'luxury',
};

export const WALLET_LABELS: Record<string, string> = {
  cash: 'wallet_cash',
  bank: 'wallet_bank',
  emergency: 'wallet_emergency',
  savings: 'wallet_savings',
};

export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];
