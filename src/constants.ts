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
  MoreHorizontal 
} from 'lucide-react';

export const CURRENCY = 'SAR'; // Default to Saudi Riyal, can be dynamic later

export const CATEGORIES: Record<TransactionCategory, { label: string; icon: any; color: string }> = {
  food: { label: 'طعام', icon: Utensils, color: 'bg-orange-100 text-orange-600' },
  transport: { label: 'مواصلات', icon: Car, color: 'bg-blue-100 text-blue-600' },
  entertainment: { label: 'ترفيه', icon: Gamepad2, color: 'bg-purple-100 text-purple-600' },
  shopping: { label: 'تسوق', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
  health: { label: 'صحة', icon: Stethoscope, color: 'bg-green-100 text-green-600' },
  bills: { label: 'فواتير', icon: Receipt, color: 'bg-yellow-100 text-yellow-600' },
  other: { label: 'أخرى', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
};

export const NECESSITY_LABELS: Record<NecessityType, string> = {
  necessity: 'ضروريات',
  luxury: 'كماليات',
};

export const WALLET_LABELS: Record<string, string> = {
  cash: 'كاش',
  bank: 'صرافة',
};

export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];
