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
    isAdmin INTEGER DEFAULT 0
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

// Bootstrap the user as admin (optional, now handled by script)
/*
try {
  db.prepare("UPDATE users SET isAdmin = 1 WHERE email = ?").run('m.m.a.q.vip@gmail.com');
} catch (e) {}
*/

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
`);

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  // API Routes
  
  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { displayName, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, displayName, email, password)
        VALUES (?, ?, ?, ?)
      `).run(id, displayName, email, hashedPassword);
      
      const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, user: { id, email, displayName, hasSeenTutorial: 0, isAdmin: 0 } });
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
      res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, hasSeenTutorial: !!user.hasSeenTutorial, isAdmin: !!user.isAdmin } });
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
    const user = db.prepare("SELECT id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial, isAdmin FROM users WHERE id = ?").get(req.params.uid);
    if (user) {
      user.hasSeenTutorial = !!user.hasSeenTutorial;
      user.isAdmin = !!user.isAdmin;
    }
    res.json(user || null);
  });

  app.post("/api/users", (req, res) => {
    const { id, displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial } = req.body;
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
          hasSeenTutorial = COALESCE(?, hasSeenTutorial)
        WHERE id = ?
    `).run(displayName, email, budgetThreshold, initialCash, initialBank, currency, emergencyFund, savingsFund, hasSeenTutorial !== undefined ? (hasSeenTutorial ? 1 : 0) : null, id);
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

  // Admin Routes
  app.get("/api/admin/users", (req, res) => {
    // Note: In a real app, you should check for admin status in the JWT or session
    const users = db.prepare("SELECT id, displayName, email, isAdmin FROM users").all();
    res.json(users.map(u => ({ ...u, isAdmin: !!u.isAdmin })));
  });

  app.post("/api/admin/broadcast", (req, res) => {
    const { title, message } = req.body;
    const users = db.prepare("SELECT id FROM users").all();
    
    const insert = db.prepare(`
      INSERT INTO notifications (id, title, message, date, userId)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((users) => {
      for (const user of users) {
        insert.run(crypto.randomUUID(), title, message, new Date().toISOString(), user.id);
      }
    });

    transaction(users);
    res.json({ status: "ok", count: users.length });
  });

  app.post("/api/admin/users/:uid/reset-password", async (req, res) => {
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
