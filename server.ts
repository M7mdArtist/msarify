import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import morgan from "morgan";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import nodeCrypto from "node:crypto";
import { 
  initDiscordBot, 
  sendDiscordNotification, 
  getDiscordStatus, 
  regenerateDiscordKey, 
  unlinkDiscord, 
  setDiscordNotifications, 
  linkDiscordManual,
  generateDiscordKey 
} from "./src/server/discordBot";

dotenv.config();
process.env.DISABLE_HMR = "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);

let dbPath = process.env.DB_PATH || "data.db";
try {
  const dir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create directory for DB_PATH, using local fallback:", e);
  dbPath = path.resolve(__dirname, "data.db");
}

let db: any;
try {
  db = new Database(dbPath);
} catch (e) {
  console.warn("Failed to open DB at", dbPath, "falling back to local data.db:", e);
  dbPath = path.resolve(__dirname, "data.db");
  db = new Database(dbPath);
}

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

// Initialize Discord Notification Bot
try {
  initDiscordBot(db);
} catch (err) {
  console.warn("Could not initialize Discord bot:", err);
}

// Ensure a user record exists to prevent FOREIGN KEY constraint violations
function ensureUserExists(userId: string, defaultName = "مستخدم") {
  if (!userId) return;
  try {
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!existing) {
      const freshKey = generateDiscordKey();
      db.prepare(`
        INSERT OR IGNORE INTO users (id, displayName, email, currency, discordAccessKey, hasSeenTutorial)
        VALUES (?, ?, ?, 'ر.س', ?, 1)
      `).run(userId, userId === 'default' ? 'حسابي' : defaultName, `${userId}@local.app`, freshKey);
    }
  } catch (err) {
    console.warn("ensureUserExists error:", err);
  }
}

const VALID_CATEGORIES = new Set([
  'salary', 'living', 'bills', 'food', 'transport', 'health', 
  'shopping', 'entertainment', 'investment', 'gift', 'other', 'transfer'
]);

const CATEGORY_MAP: Record<string, string> = {
  rent: 'living',
  housing: 'living',
  utilities: 'bills',
  utility: 'bills',
  bill: 'bills',
  transportation: 'transport',
  transit: 'transport',
  gas: 'transport',
  fuel: 'transport',
  car: 'transport',
  groceries: 'food',
  dining: 'food',
  medical: 'health',
  pharmacy: 'health',
  fun: 'entertainment',
  invest: 'investment',
  present: 'gift',
};

function sanitizeCategory(cat?: string): string {
  if (!cat) return 'other';
  const lower = String(cat).toLowerCase().trim();
  if (VALID_CATEGORIES.has(lower)) return lower;
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  return 'other';
}

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
        const safeCat = sanitizeCategory(item.category);

        db.transaction(() => {
          // Insert transaction
          db.prepare(`
            INSERT INTO transactions (id, amount, description, date, category, type, wallet, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(txId, item.amount, item.description, dateStr, safeCat, item.type, item.wallet, item.userId);

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

// Background and on-demand task for auto-deducting due subscriptions
function processSubscriptions(targetUserId?: string) {
  try {
    const now = new Date();
    let query = `
      SELECT s.*, u.currency, u.language, u.displayName
      FROM subscriptions s
      LEFT JOIN users u ON s.userId = u.id
      WHERE (s.autoDeduct IS NULL OR s.autoDeduct = 1)
    `;
    const params: any[] = [];
    if (targetUserId) {
      query += " AND s.userId = ?";
      params.push(targetUserId);
    }

    const subscriptions = db.prepare(query).all(...params);

    for (const sub of subscriptions as any[]) {
      if (!sub.nextBillingDate) continue;
      const billingDate = new Date(sub.nextBillingDate);
      if (isNaN(billingDate.getTime())) continue;

      if (billingDate <= now) {
        const txId = nodeCrypto.randomUUID();
        const notifId = nodeCrypto.randomUUID();
        const dateStr = now.toISOString();
        const safeCat = sanitizeCategory(sub.category || 'bills');
        const wallet = sub.wallet || 'bank';
        const currency = sub.currency || 'ر.س';
        const isAr = sub.language !== 'en';

        // Calculate next billing date: advance by month until strictly in the future
        const nextDate = new Date(billingDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        while (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        const nextBillingDateStr = nextDate.toISOString();

        const notifTitle = isAr ? 'تجديد اشتراك تلقائي' : 'Subscription Auto-Renewed';
        const notifMsg = isAr 
          ? `تم خصم ${sub.amount} ${currency} لاشتراك "${sub.name}" بنجاح.`
          : `Successfully deducted ${sub.amount} ${currency} for subscription "${sub.name}".`;

        db.transaction(() => {
          // 1. Add expense transaction
          db.prepare(`
            INSERT INTO transactions (id, amount, description, date, category, type, necessity, wallet, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txId, 
            sub.amount, 
            sub.name, 
            dateStr, 
            safeCat, 
            'expense', 
            'necessity', 
            wallet, 
            sub.userId
          );

          // 2. Advance nextBillingDate on subscription
          db.prepare(`
            UPDATE subscriptions 
            SET nextBillingDate = ? 
            WHERE id = ?
          `).run(nextBillingDateStr, sub.id);

          // 3. Create in-app notification
          db.prepare(`
            INSERT INTO notifications (id, title, message, date, isRead, userId)
            VALUES (?, ?, ?, ?, 0, ?)
          `).run(notifId, notifTitle, notifMsg, dateStr, sub.userId);
        })();

        // 4. Dispatch Discord DM Notification if user has Discord linked
        try {
          const walletLabel = wallet === 'cash' ? 'كاش (نقدي)' : wallet === 'bank' ? 'الحساب البنكي' : wallet;
          sendDiscordNotification(sub.userId, {
            title: isAr ? '🔄 تجديد اشتراك تلقائي' : '🔄 Subscription Auto-Renewed',
            description: isAr 
              ? `تم خصم **${sub.amount} ${currency}** بنجاح لاشتراك **"${sub.name}"** من محفظة **${walletLabel}**.`
              : `Successfully deducted **${sub.amount} ${currency}** for subscription **"${sub.name}"** from wallet **${walletLabel}**.`,
            type: 'subscription',
            fields: [
              { name: isAr ? '💰 المبلغ المخصوم' : 'Amount', value: `${sub.amount} ${currency}`, inline: true },
              { name: isAr ? '📅 التجديد القادم' : 'Next Renewal', value: new Date(nextBillingDateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US'), inline: true },
              { name: isAr ? '🏦 المحفظة' : 'Wallet', value: walletLabel, inline: true }
            ]
          });
        } catch (discordErr) {
          console.warn("Could not send Discord notification for subscription:", discordErr);
        }

        console.log(`Auto-deducted subscription "${sub.name}" (${sub.amount}) for user ${sub.userId}`);
      }
    }
  } catch (err) {
    console.error("Error processing subscriptions:", err);
  }
}

// Run every 10 minutes
setInterval(() => {
  processRecurring();
  processSubscriptions();
}, 10 * 60 * 1000);

// Also run on startup after a short delay
setTimeout(() => {
  processRecurring();
  processSubscriptions();
}, 5000);

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

try {
  db.exec("ALTER TABLE subscriptions ADD COLUMN wallet TEXT DEFAULT 'bank'");
} catch (e) {}

try {
  db.exec("ALTER TABLE subscriptions ADD COLUMN autoDeduct INTEGER DEFAULT 1");
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

// Migration to normalize categories and prevent undefined category crash
try {
  db.exec(`
    UPDATE transactions SET category = 'living' WHERE category = 'rent' OR category = 'housing';
    UPDATE transactions SET category = 'bills' WHERE category = 'utilities' OR category = 'utility';
    UPDATE transactions SET category = 'transport' WHERE category = 'transportation' OR category = 'transit';
    UPDATE transactions SET category = 'food' WHERE category = 'groceries';
    UPDATE transactions SET category = 'other' WHERE category IS NULL OR category = '';
    UPDATE recurring_transactions SET category = 'living' WHERE category = 'rent' OR category = 'housing';
    UPDATE recurring_transactions SET category = 'bills' WHERE category = 'utilities' OR category = 'utility';
    UPDATE recurring_transactions SET category = 'transport' WHERE category = 'transportation' OR category = 'transit';
    UPDATE recurring_transactions SET category = 'food' WHERE category = 'groceries';
    UPDATE recurring_transactions SET category = 'other' WHERE category IS NULL OR category = '';
  `);
} catch (e) {}

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
        - Determine category from this exact list: salary, living, bills, food, transport, health, shopping, entertainment, investment, gift, other.
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
                  category: { type: Type.STRING, enum: ["salary", "living", "bills", "food", "transport", "health", "shopping", "entertainment", "investment", "gift", "other"] },
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
      const safeCat = sanitizeCategory(result.category);

      db.prepare(`
        INSERT INTO transactions (id, amount, description, date, category, type, necessity, wallet, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, result.amount, result.description, date, safeCat, result.type, result.necessity, result.wallet, user.id);

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
    try {
      const uid = req.params.uid;
      ensureUserExists(uid);
      let user: any = db.prepare("SELECT id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial, isAdmin, siriToken, discordAccessKey, discordUserId, discordUsername, discordNotificationsEnabled, theme, language FROM users WHERE id = ?").get(uid);
      if (user) {
        if (!user.discordAccessKey || user.discordAccessKey === '') {
          const freshKey = generateDiscordKey();
          db.prepare("UPDATE users SET discordAccessKey = ? WHERE id = ?").run(freshKey, user.id);
          user.discordAccessKey = freshKey;
        }
        user.hasSeenTutorial = !!user.hasSeenTutorial;
        user.isAdmin = !!user.isAdmin;
        user.discordNotificationsEnabled = !!(user.discordNotificationsEnabled ?? 1);
      }
      res.json(user || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", (req, res) => {
    try {
      const { id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial, theme, language, privacyMode } = req.body;
      ensureUserExists(id, displayName);
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
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Discord Bot Routes
  app.get("/api/discord/status/:uid", (req, res) => {
    try {
      const status = getDiscordStatus(req.params.uid);
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discord/regenerate-key/:uid", (req, res) => {
    try {
      const newKey = regenerateDiscordKey(req.params.uid);
      res.json({ discordAccessKey: newKey });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discord/toggle-notifications/:uid", (req, res) => {
    try {
      const { enabled } = req.body;
      setDiscordNotifications(req.params.uid, Boolean(enabled));
      res.json({ success: true, enabled: Boolean(enabled) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discord/unlink/:uid", (req, res) => {
    try {
      unlinkDiscord(req.params.uid);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discord/test-notification/:uid", async (req, res) => {
    try {
      const user: any = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.uid);
      if (!user) return res.status(404).json({ error: "User not found" });
      const currency = user.currency || "ر.س";
      const isAr = user.language !== "en";

      const sent = await sendDiscordNotification(req.params.uid, {
        title: isAr ? "🔔 تجربة إشعارات مصاريفي" : "🔔 Masarif Test Notification",
        description: isAr
          ? `أهلاً بك يا **${user.displayName || 'صديقنا'}**! ✨\nتم إرسال هذا الإشعار التجريبي لتأكيد نجاح ربط حسابك في تطبيق مصاريفي مع ديسكورد.\nستصلك إشعارات العمليات والاشتراكات هنا مباشرة!`
          : `Hello **${user.displayName || 'User'}**! ✨\nThis test notification confirms your Masarif account is connected to Discord!\nYou will receive transaction and subscription alerts here.`,
        color: 0x5865F2,
        fields: [
          { name: isAr ? "🟢 حالة الاتصال" : "Status", value: isAr ? "متصل بنجاح وجاهز" : "Connected & Ready", inline: true },
          { name: isAr ? "💰 العملة المعتمدة" : "Currency", value: currency, inline: true }
        ]
      });

      if (sent) {
        res.json({ success: true, message: isAr ? "تم إرسال الإشعار التجريبي إلى رسائلك الخاصة في ديسكورد بنجاح!" : "Test notification sent to Discord DM!" });
      } else {
        res.status(400).json({ 
          success: false, 
          error: isAr 
            ? "تعذر إرسال الإشعار. يرجى التأكد من إرسال كود مفتاح الوصول للبوت أولاً لربط الحساب وأن البوت متصل." 
            : "Could not send notification. Ensure your account is linked by DMing the access key to the bot first." 
        });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/discord/link-key", (req, res) => {
    try {
      const { accessKey, discordUserId, discordUsername, userId } = req.body;
      if (userId && discordUserId) {
        linkDiscordManual(userId, discordUserId, discordUsername || `@user_${discordUserId}`);
        return res.json({ success: true });
      }

      if (!accessKey) return res.status(400).json({ error: "Access key is required" });
      const cleanKey = accessKey.trim().toUpperCase();
      const user: any = db.prepare("SELECT * FROM users WHERE UPPER(TRIM(discordAccessKey)) = ?").get(cleanKey);
      if (!user) return res.status(404).json({ error: "Invalid access key" });

      if (discordUserId) {
        linkDiscordManual(user.id, discordUserId, discordUsername || `@user_${discordUserId}`);
      }
      res.json({ success: true, user: { id: user.id, displayName: user.displayName } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Transaction Routes
  app.get("/api/transactions/:uid", (req, res) => {
    try {
      processSubscriptions(req.params.uid);
    } catch (e) {}
    const rows = db.prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC").all(req.params.uid);
    res.json(rows);
  });

  app.post("/api/transactions", (req, res) => {
    try {
      const { id, amount, description, date, category, type, necessity, wallet, toWallet, userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      ensureUserExists(userId);
      const safeCat = sanitizeCategory(category);
      db.prepare(`
        INSERT INTO transactions (id, amount, description, date, category, type, necessity, wallet, toWallet, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, amount, description, date, safeCat, type, necessity, wallet, toWallet, userId);

      // Send Discord Notification safely
      try {
        const u: any = db.prepare("SELECT currency, language FROM users WHERE id = ?").get(userId);
        const curr = u?.currency || 'ر.س';
        const isAr = u?.language !== 'en';
        const walletLabel = wallet === 'cash' ? (isAr ? 'كاش (نقدي)' : 'Cash') : wallet === 'bank' ? (isAr ? 'الحساب البنكي' : 'Bank') : wallet;
        
        let notifTitle = '';
        let notifDesc = '';
        if (type === 'expense') {
          notifTitle = isAr ? '💸 تسجيل مصروف جديد' : '💸 New Expense';
          notifDesc = isAr 
            ? `تم تسجيل مصروف بقيمة **${amount} ${curr}**\n📝 **الوصف**: ${description}\n📂 **التصنيف**: ${safeCat}\n🏦 **المحفظة**: ${walletLabel}`
            : `Expense of **${amount} ${curr}** recorded\n📝 **Description**: ${description}\n📂 **Category**: ${safeCat}\n🏦 **Wallet**: ${walletLabel}`;
        } else if (type === 'income') {
          notifTitle = isAr ? '💵 تسجيل دخل جديد' : '💵 New Income';
          notifDesc = isAr 
            ? `تم إيداع دخل بقيمة **${amount} ${curr}**\n📝 **الوصف**: ${description}\n🏦 **المحفظة**: ${walletLabel}`
            : `Income of **${amount} ${curr}** received\n📝 **Description**: ${description}\n🏦 **Wallet**: ${walletLabel}`;
        } else if (type === 'transfer') {
          const toWalletLabel = toWallet === 'cash' ? (isAr ? 'كاش (نقدي)' : 'Cash') : toWallet === 'bank' ? (isAr ? 'الحساب البنكي' : 'Bank') : toWallet;
          notifTitle = isAr ? '🔁 تحويل مالي بين المحافظ' : '🔁 Wallet Transfer';
          notifDesc = isAr 
            ? `تم تحويل **${amount} ${curr}** من **${walletLabel}** إلى **${toWalletLabel}**.`
            : `Transferred **${amount} ${curr}** from **${walletLabel}** to **${toWalletLabel}**.`;
        }

        if (notifTitle) {
          sendDiscordNotification(userId, {
            title: notifTitle,
            description: notifDesc,
            type: type === 'expense' ? 'expense' : 'income'
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Could not dispatch transaction notification to Discord:", e);
      }

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Error creating transaction:", err);
      res.status(500).json({ error: err.message || "Failed to create transaction" });
    }
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
    const safeCat = sanitizeCategory(category);
    try {
      ensureUserExists(userId);
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
      `).run(id, amount, description, safeCat, type, wallet, frequency, autoProcess !== undefined ? (autoProcess ? 1 : 0) : 0, userId);
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save recurring transaction" });
    }
  });

  app.delete("/api/recurring/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM recurring_transactions WHERE id = ?").run(req.params.id);
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete recurring transaction" });
    }
  });

  // Subscription Routes
  app.get("/api/subscriptions/:uid", (req, res) => {
    try {
      processSubscriptions(req.params.uid);
    } catch (e) {}
    const rows = db.prepare("SELECT * FROM subscriptions WHERE userId = ?").all(req.params.uid);
    res.json(rows);
  });

  app.post("/api/subscriptions", (req, res) => {
    try {
      const { id, name, amount, nextBillingDate, category, wallet, autoDeduct, userId } = req.body;
      ensureUserExists(userId);
      const safeCat = sanitizeCategory(category);
      const safeWallet = wallet === 'cash' ? 'cash' : 'bank';
      const safeAutoDeduct = autoDeduct !== undefined ? (autoDeduct ? 1 : 0) : 1;
      db.prepare(`
        INSERT INTO subscriptions (id, name, amount, nextBillingDate, category, wallet, autoDeduct, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          amount = excluded.amount,
          nextBillingDate = excluded.nextBillingDate,
          category = excluded.category,
          wallet = excluded.wallet,
          autoDeduct = excluded.autoDeduct
      `).run(id, name, amount, nextBillingDate, safeCat, safeWallet, safeAutoDeduct, userId);
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save subscription" });
    }
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
    try {
      const { id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, transactions } = req.body;
      ensureUserExists(userId);
      db.prepare(`
        INSERT INTO snapshots (id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, date, totalAmount, cashAmount, bankAmount, transactionCount, userId, JSON.stringify(transactions));
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save snapshot" });
    }
  });

  // Notification Routes
  app.get("/api/notifications/:uid", (req, res) => {
    const rows = db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY date DESC LIMIT 50").all(req.params.uid);
    res.json(rows.map(r => ({ ...r, isRead: !!r.isRead })));
  });

  app.post("/api/notifications", (req, res) => {
    try {
      const { id, title, message, date, userId } = req.body;
      ensureUserExists(userId);
      db.prepare(`
        INSERT INTO notifications (id, title, message, date, userId)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, title, message, date, userId);
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save notification" });
    }
  });

  app.post("/api/notifications/read-all/:uid", (req, res) => {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE userId = ?").run(req.params.uid);
    res.json({ status: "ok" });
  });

  app.post("/api/notifications/read/:id", (req, res) => {
    db.prepare("UPDATE notifications SET isRead = 1 WHERE id = ?").run(req.params.id);
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
    try {
      const { id, amount, remainingAmount, personName, description, type, status, dueDate, startDate, wallet, userId } = req.body;
      ensureUserExists(userId);
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save loan" });
    }
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

  // Vite middleware for development vs static production build
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isDev = process.env.npm_lifecycle_event === "dev" || 
                process.env.NODE_ENV === "development" || 
                !hasDist;

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
