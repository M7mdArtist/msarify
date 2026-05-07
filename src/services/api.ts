import { Transaction, Subscription, Snapshot, UserProfile } from "../types";

const API_BASE = "/api";

export const api = {
  // Auth
  async signup(profile: any): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async login(credentials: any): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // User Profile
  async getUser(uid: string): Promise<UserProfile | null> {
    const res = await fetch(`${API_BASE}/users/${uid}`);
    return res.json();
  },
  
  async saveUser(uid: string, profile: Partial<UserProfile>): Promise<void> {
    await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: uid, ...profile }),
    });
  },

  async convertCurrency(uid: string, ratio: number): Promise<void> {
    await fetch(`${API_BASE}/users/${uid}/convert-currency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratio }),
    });
  },

  // Transactions
  async getTransactions(uid: string): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE}/transactions/${uid}`);
    return res.json();
  },

  async addTransaction(t: Transaction): Promise<void> {
    await fetch(`${API_BASE}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    });
  },

  async deleteTransaction(id: string): Promise<void> {
    await fetch(`${API_BASE}/transactions/${id}`, { method: "DELETE" });
  },

  async clearTransactions(uid: string): Promise<void> {
    await fetch(`${API_BASE}/transactions/user/${uid}`, { method: "DELETE" });
  },

  // Subscriptions
  async getSubscriptions(uid: string): Promise<Subscription[]> {
    const res = await fetch(`${API_BASE}/subscriptions/${uid}`);
    return res.json();
  },

  async saveSubscription(s: Subscription): Promise<void> {
    await fetch(`${API_BASE}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
  },

  async deleteSubscription(id: string): Promise<void> {
    await fetch(`${API_BASE}/subscriptions/${id}`, { method: "DELETE" });
  },

  // Snapshots
  async getSnapshots(uid: string): Promise<Snapshot[]> {
    const res = await fetch(`${API_BASE}/snapshots/${uid}`);
    return res.json();
  },

  async addSnapshot(s: Snapshot): Promise<void> {
    await fetch(`${API_BASE}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
  },

  // Notifications
  async getNotifications(uid: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/notifications/${uid}`);
    return res.json();
  },

  async addNotification(n: any): Promise<void> {
    await fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n),
    });
  },

  async markAllNotificationsRead(uid: string): Promise<void> {
    await fetch(`${API_BASE}/notifications/read-all/${uid}`, { method: "POST" });
  },

  async deleteNotification(id: string): Promise<void> {
    await fetch(`${API_BASE}/notifications/${id}`, { method: "DELETE" });
  },
  
  // Admin
  async getAdminUsers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` }
    });
    return res.json();
  },

  async broadcastNotification(title: string, message: string): Promise<void> {
    await fetch(`${API_BASE}/admin/broadcast`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ title, message }),
    });
  },

  async resetUserPassword(uid: string, newPassword: string): Promise<void> {
    await fetch(`${API_BASE}/admin/users/${uid}/reset-password`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ newPassword }),
    });
  },

  async deleteUser(uid: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/users/${uid}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete user");
    }
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/users/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  },

  async getExchangeRates(base: string = 'SAR'): Promise<any> {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      const data = await res.json();
      return data.rates;
    } catch (err) {
      console.error("Failed to fetch exchange rates", err);
      // Fallback
      return { "USD": 0.27, "SAR": 1, "KWD": 0.082, "AED": 0.98 };
    }
  }
};
