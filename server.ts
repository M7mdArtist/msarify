import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import morgan from "morgan";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import nodeCrypto from "node:crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_PATH = process.env.DB_PATH || "data.db";
const db = new Database(DB_PATH);
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-123";

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    displayName TEXT,
    email TEXT UNIQUE,
    password TEXT,
    budgetThreshold REAL DEFAULT 0,
    initialCash REAL DEFAULT 0,
    initialBank REAL DEFAULT 0,
    currency TEXT DEFAULT 'ر.س',
    emergencyFund REAL DEFAULT 0,
    savingsFund REAL DEFAULT 0,
    hasSeenTutorial INTEGER DEFAULT 0,
    isAdmin INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'ar'
  );
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN emergencyFund REAL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN savingsFund REAL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'ر.س'");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN hasSeenTutorial INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'ar'");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN siriToken TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN privacyMode INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      amount REAL,
      description TEXT,
      category TEXT,
      type TEXT,
      wallet TEXT,
      frequency TEXT,
      autoProcess INTEGER DEFAULT 0,
      lastProcessed TEXT,
      userId TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )
  `);
} catch (e) {}

try {
  db.exec("ALTER TABLE recurring_transactions ADD COLUMN autoProcess INTEGER DEFAULT 0");
} catch (e) {}

// Background task for auto-processing recurring transactions
function processRecurring() {
  try {
    const now = new Date();
    const recurringItems = db.prepare("SELECT * FROM recurring_transactions WHERE autoProcess = 1").all();

    for (const item of recurringItems as any[]) {
      const lastProcessed = item.lastProcessed ? new Date(item.lastProcessed) : null;
      let shouldProcess = false;

      if (!lastProcessed) {
        shouldProcess = true;
      } else {
        const diffDays = (now.getTime() - lastProcessed.getTime()) / (1000 * 60 * 60 * 24);
        if (item.frequency === 'daily' && diffDays >= 1) shouldProcess = true;
        if (item.frequency === 'weekly' && diffDays >= 7) shouldProcess = true;
        if (item.frequency === 'monthly') {
          // Check if it's the next month and same day (or last day of month if current day is > days in next month)
          const nextProcessDate = new Date(lastProcessed);
          nextProcessDate.setMonth(lastProcessed.getMonth() + 1);
          if (now >= nextProcessDate) shouldProcess = true;
        }
      }

      if (shouldProcess) {
        const txId = nodeCrypto.randomUUID();
        const dateStr = now.toISOString();

        db.transaction(() => {
          // Insert transaction
          db.prepare(`
            INSERT INTO transactions (id, amount, description, date, category, type, wallet, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(txId, item.amount, item.description, dateStr, item.category, item.type, item.wallet, item.userId);

          // Update lastProcessed
          db.prepare("UPDATE recurring_transactions SET lastProcessed = ? WHERE id = ?").run(dateStr, item.id);
        })();
        
        console.log(`Auto-processed recurring transaction: ${item.description} for user ${item.userId}`);
      }
    }
  } catch (err) {
    console.error("Error processing recurring transactions:", err);
  }
}

// Run every 10 minutes
setInterval(processRecurring, 10 * 60 * 1000);
// Also run on startup after a short delay
setTimeout(processRecurring, 5000);

try {
  db.exec("ALTER TABLE users ADD COLUMN password TEXT");
} catch (e) {
}

try {
  // Adding UNIQUE to existing column is hard in SQLite, usually needs a table recreate.
  // For simplicity since this is a dev/preview app, we'll just try to add the index.
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)");
} catch (e) {}

try {
  db.exec("ALTER TABLE transactions ADD COLUMN necessity TEXT DEFAULT 'necessity'");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL,
    description TEXT,
    date TEXT,
    category TEXT,
    type TEXT,
    necessity TEXT,
    wallet TEXT,
    toWallet TEXT,
    userId TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT,
    amount REAL,
    nextBillingDate TEXT,
    category TEXT,
    userId TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    date TEXT,
    totalAmount REAL,
    cashAmount REAL,
    bankAmount REAL,
    transactionCount INTEGER,
    userId TEXT,
    data TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT,
    message TEXT,
    date TEXT,
    isRead INTEGER DEFAULT 0,
    userId TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    amount REAL,
    remainingAmount REAL,
    personName TEXT,
    description TEXT,
    type TEXT,
    status TEXT,
    dueDate TEXT,
    startDate TEXT,
    wallet TEXT,
    userId TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    });
  };

  // API Routes
  
  // Siri / Quick Add API
  app.post("/api/quick-add", async (req, res) => {
    const token = req.headers["x-api-key"] || req.query.token;
    const { text } = req.body;

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    try {
      // Find user by their unique Siri token
      const user: any = db.prepare("SELECT id, currency, displayName FROM users WHERE siriToken = ?").get(token);
      
      if (!user) {
        return res.status(403).json({ error: "Invalid or expired Siri token" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        You are a financial record assistant. Parse the following natural language expense or income statement.
        The user might speak in Arabic or English.
        
        Rules:
        - Extract amount as a number.
        - Extract description as a clear string.
        - Determine type: 'expense' (spent money) or 'income' (received money).
        - Determine wallet: 'cash' or 'bank' ( صرافة/بنك/بطاقة -> bank, كاش/نقدي -> cash). Default to bank if unclear.
        - Determine category from this list: food, rent, utilities, transportation, health, entertainment, investment, gift, other.
        - Determine necessity: 'necessity' (mandatory) or 'luxury' (optional/fun).
        
        Text to parse: "${text}"
      `;

      let aiResponse;
      let retries = 2;
      while (retries >= 0) {
        try {
          aiResponse = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["expense", "income"] },
                  wallet: { type: Type.STRING, enum: ["cash", "bank"] },
                  category: { type: Type.STRING, enum: ["food", "rent", "utilities", "transportation", "health", "entertainment", "investment", "gift", "other"] },
                  necessity: { type: Type.STRING, enum: ["necessity", "luxury"] }
                },
                required: ["amount", "description", "type", "wallet", "category", "necessity"]
              }
            }
          });
          break;
        } catch (e: any) {
          const errMsg = e.message || "";
          if ((errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand")) && retries > 0) {
            retries--;
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw e;
        }
      }

      if (!aiResponse) throw new Error("No response from AI");

      const result = JSON.parse(aiResponse.text);
      const id = nodeCrypto.randomUUID();
      const date = new Date().toISOString();

      db.prepare(`
        INSERT INTO transactions (id, amount, description, date, category, type, necessity, wallet, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, result.amount, result.description, date, result.category, result.type, result.necessity, result.wallet, user.id);

      const walletLabel = result.wallet === 'cash' ? 'كاش' : 'الصرافة';
      const currency = user.currency || 'ر.س';
      
      const successMessage = `أهلاً ${user.displayName}، تم تسجيل ${result.amount} ${currency} (${result.description}) في ${walletLabel} بنجاح.`;
      
      res.json({ message: successMessage, data: result });
    } catch (err: any) {
      console.error("Quick Add Error:", err);
      res.status(500).json({ error: "فشل في معالجة طلب سيري: " + err.message });
    }
  });

  // User Siri Token Management
  app.post("/api/user/siri-token", authenticateToken, (req: any, res) => {
    try {
      const newToken = nodeCrypto.randomBytes(16).toString('hex');
      db.prepare("UPDATE users SET siriToken = ? WHERE id = ?").run(newToken, req.user.id);
      res.json({ siriToken: newToken });
    } catch (err) {
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  app.get("/api/user/profile", authenticateToken, (req: any, res) => {
    try {
      const user = db.prepare("SELECT displayName, email, currency, siriToken FROM users WHERE id = ?").get(req.user.id);
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Admin: Delete User
  app.delete("/api/admin/users/:userId", authenticateToken, (req: any, res) => {
    try {
      // Check if current user is admin
      const admin = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(req.user.id);
      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: "Unauthorized: Admin access required" });
      }

      const targetId = req.params.userId;
      
      // Prevent admin from deleting themselves
      if (targetId === req.user.id) {
        return res.status(400).json({ error: "Cannot delete your own admin account" });
      }

      // Start transaction to clean up user data
      const deleteUser = db.transaction(() => {
        db.prepare("DELETE FROM transactions WHERE userId = ?").run(targetId);
        db.prepare("DELETE FROM notifications WHERE userId = ?").run(targetId);
        db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
      });

      deleteUser();

      res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { displayName, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = nodeCrypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, displayName, email, password)
        VALUES (?, ?, ?, ?)
      `).run(id, displayName, email, hashedPassword);
      
      const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ 
        token, 
        user: { 
          id, 
          email, 
          displayName, 
          hasSeenTutorial: 0, 
          isAdmin: 0,
          theme: 'dark',
          language: 'ar'
        } 
      });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
      }
      res.status(500).json({ error: "خطأ في إنشاء الحساب" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }
      
      const token = jwt.sign({ id: user.id, email: user.email, displayName: user.displayName }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          displayName: user.displayName, 
          hasSeenTutorial: !!user.hasSeenTutorial, 
          isAdmin: !!user.isAdmin,
          theme: user.theme || 'dark',
          language: user.language || 'ar'
        } 
      });
    } catch (err) {
      res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/users/:uid/convert-currency", (req, res) => {
    const { ratio } = req.body;
    const { uid } = req.params;
    
    try {
      const db_transaction = db.transaction(() => {
        // Convert user initial balances
        db.prepare(`
          UPDATE users 
          SET initialCash = initialCash * ?, 
              initialBank = initialBank * ?,
              budgetThreshold = budgetThreshold * ?,
              emergencyFund = emergencyFund * ?,
              savingsFund = savingsFund * ?
          WHERE id = ?
        `).run(ratio, ratio, ratio, ratio, ratio, uid);

        // Convert all transaction amounts
        db.prepare(`
          UPDATE transactions 
          SET amount = amount * ? 
          WHERE userId = ?
        `).run(ratio, uid);

        // Convert subscriptions
        db.prepare(`
          UPDATE subscriptions 
          SET amount = amount * ? 
          WHERE userId = ?
        `).run(ratio, uid);
      });

      db_transaction();
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "فشل تحويل العملات" });
    }
  });

  // User Routes
  app.get("/api/users/:uid", (req, res) => {
    const user = db.prepare("SELECT id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial, isAdmin, siriToken, theme, language FROM users WHERE id = ?").get(req.params.uid);
    if (user) {
      user.hasSeenTutorial = !!user.hasSeenTutorial;
      user.isAdmin = !!user.isAdmin;
    }
    res.json(user || null);
  });

  app.post("/api/users", (req, res) => {
    const { id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial, theme, language, privacyMode } = req.body;
    db.prepare(`
        UPDATE users SET
          displayName = COALESCE(?, displayName),
          email = COALESCE(?, email),
          budgetThreshold = COALESCE(?, budgetThreshold),
          initialCash = COALESCE(?, initialCash),
          initialBank = COALESCE(?, initialBank),
          currency = COALESCE(?, currency),
          emergencyFund = COALESCE(?, emergencyFund),
          savingsFund = COALESCE(?, savingsFund),
          hasSeenTutorial = COALESCE(?, hasSeenTutorial),
          theme = COALESCE(?, theme),
          language = COALESCE(?, language),
          privacyMode = COALESCE(?, privacyMode)
        WHERE id = ?
    `).run(
      displayName, 
      email, 
      budgetThreshold, 
      initialCash, 
      initialBank, 
      currency, 
      emergencyFund, 
      savingsFund, 
      hasSeenTutorial !== undefined ? (hasSeenTutorial ? 1 : 0) : null, 
      theme, 
      language, 
      privacyMode !== undefined ? (privacyMode ? 1 : 0) : null,
      id
    );
    res.json({ status: "ok" });
  });

  // Transaction Routes
  app.get("/api/transactions/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC").all(req.params.uid);
    res.json(rows);
  });

  app.post("/api/transactions", (req, res) => {
    const { id, amount, description, date, category, type, necessity, wallet, toWallet, userId } = req.body;
    db.prepare(`
      INSERT INTO transactions (id, amount, description, date, category, type, necessity, wallet, toWallet, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, amount, description, date, category, type, necessity, wallet, toWallet, userId);
    res.json({ status: "ok" });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  app.delete("/api/transactions/user/:uid", (req, res) => {
    db.prepare("DELETE FROM transactions WHERE userId = ?").run(req.params.uid);
    res.json({ status: "ok" });
  });

  // Recurring Transactions Routes
  app.get("/api/recurring/:userId", (req, res) => {
    try {
      const recurring = db.prepare("SELECT * FROM recurring_transactions WHERE userId = ?").all(req.params.userId);
      res.json(recurring);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch recurring transactions" });
    }
  });

  app.post("/api/recurring", (req, res) => {
    const { id, amount, description, category, type, wallet, frequency, userId, autoProcess } = req.body;
    try {
      db.prepare(`
        INSERT INTO recurring_transactions (id, amount, description, category, type, wallet, frequency, autoProcess, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          amount = excluded.amount,
          description = excluded.description,
          category = excluded.category,
          type = excluded.type,
          wallet = excluded.wallet,
          frequency = excluded.frequency,
          autoProcess = excluded.autoProcess
      `).run(id, amount, description, category, type, wallet, frequency, autoProcess !== undefined ? (autoProcess ? 1 : 0) : 0, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to save recurring transaction" });
    }
  });

  app.delete("/api/recurring/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM recurring_transactions WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete recurring transaction" });
    }
  });

  // Subscription Routes
  app.get("/api/subscriptions/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").all(req.params.uid);
    res.json(rows);
  });

  app.post("/api/subscriptions", (req, res) => {
    const { id, name, amount, nextBillingDate, category, userId } = req.body;
    db.prepare(`
      INSERT INTO subscriptions (id, name, amount, nextBillingDate, category, userId)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        amount = excluded.amount,
        nextBillingDate = excluded.nextBillingDate,
        category = excluded.category
    `).run(id, name, amount, nextBillingDate, category, userId);
    res.json({ status: "ok" });
  });

  app.delete("/api/subscriptions/:id", (req, res) => {
    db.prepare("DELETE FROM subscriptions WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  // Snapshot Routes
  app.get("/api/snapshots/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM snapshots WHERE userId = ? ORDER BY date DESC").all(req.params.uid);
    res.json(rows.map(r => ({ ...r, transactions: JSON.parse(r.data || "[]") })));
  });

  app.post("/api/snapshots", (req, res) => {
    const { id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, transactions } = req.body;
    db.prepare(`
      INSERT INTO snapshots (id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, JSON.stringify(transactions));
    res.json({ status: "ok" });
  });

  // Notification Routes
  app.get("/api/notifications/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY date DESC LIMIT 50").all(req.params.uid);
    res.json(rows.map(r => ({ ...r, isRead: !!r.isRead })));
  });

  app.post("/api/notifications", (req, res) => {
    const { id, title, message, date, userId } = req.body;
    db.prepare(`
      INSERT INTO notifications (id, title, message, date, userId)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, message, date, userId);
    res.json({ status: "ok" });
  });

  app.post("/api/notifications/read-all/:uid", (req, res) => {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE userId = ?").run(req.params.uid);
    res.json({ status: "ok" });
  });

  app.delete("/api/notifications/:id", (req, res) => {
    db.prepare("DELETE FROM notifications WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  // Loan Routes
  app.get("/api/loans/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM loans WHERE userId = ? ORDER BY startDate DESC").all(req.params.uid);
    res.json(rows);
  });

  app.post("/api/loans", (req, res) => {
    const { id, amount, remainingAmount, personName, description, type, status, dueDate, startDate, wallet, userId } = req.body;
    db.prepare(`
      INSERT INTO loans (id, amount, remainingAmount, personName, description, type, status, dueDate, startDate, wallet, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount,
        remainingAmount = excluded.remainingAmount,
        personName = excluded.personName,
        description = excluded.description,
        type = excluded.type,
        status = excluded.status,
        dueDate = excluded.dueDate,
        wallet = excluded.wallet
    `).run(id, amount, remainingAmount, personName, description, type, status, dueDate, startDate, wallet, userId);
    res.json({ status: "ok" });
  });

  app.post("/api/loans/:id/repay", (req, res) => {
    const { amount } = req.body;
    const loan: any = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
    
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    const newRemaining = Math.max(0, loan.remainingAmount - amount);
    const newStatus = newRemaining === 0 ? "paid" : loan.status;

    db.prepare("UPDATE loans SET remainingAmount = ?, status = ? WHERE id = ?")
      .run(newRemaining, newStatus, req.params.id);
    
    res.json({ status: "ok", remainingAmount: newRemaining, loanStatus: newStatus });
  });

  app.delete("/api/loans/:id", (req, res) => {
    db.prepare("DELETE FROM loans WHERE id = ?").run(req.params.id);
    res.json({ status: "ok" });
  });

  // Admin Routes
  app.get("/api/admin/users", authenticateToken, (req: any, res) => {
    const admin = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(req.user.id);
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: "Admin only" });

    const users = db.prepare("SELECT id, displayName, email, isAdmin FROM users").all();
    res.json(users.map((u: any) => ({ ...u, isAdmin: !!u.isAdmin })));
  });

  app.post("/api/admin/broadcast", authenticateToken, (req: any, res) => {
    const admin = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(req.user.id);
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: "Admin only" });

    const { title, message } = req.body;
    const users = db.prepare("SELECT id FROM users").all();
    
    const insert = db.prepare(`
      INSERT INTO notifications (id, title, message, date, userId)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((users) => {
      for (const user of users) {
        insert.run(nodeCrypto.randomUUID(), title, message, new Date().toISOString(), user.id);
      }
    });

    transaction(users);
    res.json({ status: "ok", count: users.length });
  });

  app.post("/api/admin/users/:uid/reset-password", authenticateToken, async (req: any, res) => {
    const admin = db.prepare("SELECT isAdmin FROM users WHERE id = ?").get(req.user.id);
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: "Admin only" });

    const { newPassword } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.params.uid);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "فشل إعادة تعيين كلمة المرور" });
    }
  });

  app.post("/api/users/change-password", async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    try {
      const user: any = db.prepare("SELECT password FROM users WHERE id = ?").get(userId);
      if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
        return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
