require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || "data.db";
const db = new Database(DB_PATH);

const email = process.argv[2];

if (!email) {
  console.error("❌ خطأ: لم يتم توفير بريد إلكتروني.");
  process.exit(1);
}

try {
  const result = db.prepare("UPDATE users SET isAdmin = 1 WHERE email = ?").run(email);
  
  if (result.changes > 0) {
    console.log(`✅ تم منح صلاحية الأدمن للمستخدم: ${email}`);
  } else {
    console.log(`⚠️ لم يتم العثور على مستخدم بهذا البريد: ${email}`);
  }
} catch (err) {
  console.error("❌ حدث خطأ أثناء تحديث قاعدة البيانات:", err.message);
  process.exit(1);
}
