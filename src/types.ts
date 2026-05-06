/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionCategory = 
  | 'food'        // طعام
  | 'transport'   // مواصلات
  | 'entertainment' // ترفيه
  | 'shopping'    // تسوق
  | 'health'      // صحة
  | 'bills'       // فواتير
  | 'other';      // أخرى

export type TransactionType = 'expense' | 'income' | 'transfer';

export type WalletType = 'cash' | 'bank';

export type NecessityType = 'necessity' | 'luxury'; // ضروريات vs كماليات

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: TransactionCategory;
  type: TransactionType;
  necessity?: NecessityType;
  wallet: WalletType;
  toWallet?: WalletType; // For transfers
  date: string; // ISO string
  userId: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  nextBillingDate: string;
  category: TransactionCategory;
  userId: string;
}

export interface Snapshot {
  id?: string;
  date: string;
  totalAmount: number;
  cashAmount: number;
  bankAmount: number;
  transactionCount: number;
  userId: string;
  transactions: Transaction[];
}

export interface UserProfile {
  displayName: string;
  email: string;
  budgetThreshold: number;
  initialCash?: number;
  initialBank?: number;
  currency?: string;
  emergencyFund?: number;
  savingsFund?: number;
  hasSeenTutorial?: boolean;
  isAdmin?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  userId: string;
}
