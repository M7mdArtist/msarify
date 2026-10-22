import { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, Events, AttachmentBuilder } from "discord.js";
import nodeCrypto from "node:crypto";
import fs from "fs";
import path from "path";
import os from "os";

let discordClient: Client | null = null;
let isBotReady = false;
let botTag = "";
let dbInstance: any = null;

// Helper to generate a unique readable access key
export function generateDiscordKey(): string {
  const p1 = nodeCrypto.randomBytes(2).toString("hex").toUpperCase();
  const p2 = nodeCrypto.randomBytes(2).toString("hex").toUpperCase();
  return `MSF-${p1}-${p2}`;
}

export function initDiscordBot(db: any) {
  dbInstance = db;

  // Ensure system_settings table exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  } catch (e) {}

  // Ensure DB columns exist for Discord integration
  try {
    db.exec("ALTER TABLE users ADD COLUMN discordAccessKey TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN discordUserId TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN discordUsername TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN discordNotificationsEnabled INTEGER DEFAULT 1");
  } catch (e) {}

  // Auto-generate keys for users that don't have one yet
  try {
    const usersWithoutKey = db.prepare("SELECT id FROM users WHERE discordAccessKey IS NULL OR discordAccessKey = ''").all();
    for (const u of usersWithoutKey as any[]) {
      const key = generateDiscordKey();
      db.prepare("UPDATE users SET discordAccessKey = ? WHERE id = ?").run(key, u.id);
    }
  } catch (err) {
    console.warn("Could not check/generate discord keys for users:", err);
  }

  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) {
    console.log("ℹ️ [Discord Bot] DISCORD_BOT_TOKEN is not set in environment. Discord notifications are in standby mode.");
    return;
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
      ],
    });

    discordClient.on(Events.ClientReady, () => {
      isBotReady = true;
      botTag = discordClient?.user?.tag || "Masarif Bot";
      console.log(`🤖 [Discord Bot] Connected and ready as ${botTag}!`);

      // Initial check for scheduled daily backup
      setTimeout(() => {
        checkAndRunScheduledBackup().catch(() => {});
      }, 10000);
    });

    // Scheduled interval to check for daily backup every 30 minutes
    setInterval(() => {
      checkAndRunScheduledBackup().catch(() => {});
    }, 30 * 60 * 1000);

    discordClient.on("messageCreate", async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      // Only respond to DMs (Direct Messages)
      const isDM = message.channel.type === ChannelType.DM || !message.guild;
      if (!isDM) return;

      const rawContent = message.content.trim();
      const upperContent = rawContent.toUpperCase();

      // Check for help command
      if (rawContent === "مساعدة" || rawContent.toLowerCase() === "help") {
        const linkedUser: any = dbInstance.prepare("SELECT * FROM users WHERE discordUserId = ?").get(message.author.id);
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🤖 بوت مصاريفي - قائمة الأوامر والمساعدة")
          .setDescription(
            linkedUser
              ? `أهلاً بك يا **${linkedUser.displayName || message.author.username}**! حسابك مربوط وجاهز لتلقي الإشعارات.\n\n` +
                "**الأوامر المتاحة:**\n" +
                "• `رصيد` أو `حالة` - عرض رصيدك المالي الحالي.\n" +
                "• `اشتراكات` - عرض الاشتراكات المسجلة ومواعيد تجديدها.\n" +
                "• `إلغاء` - إلغاء ربط حسابك في ديسكورد."
              : "👋 مرحباً بك في بوت **مصاريفي** للإشعارات المالية!\n\n" +
                "لربط حسابك وتلقي الإشعارات الفورية عند خصم الاشتراكات أو تسجيل المصاريف:\n" +
                "1. افتح صفحة **الإعدادات > إشعارات ديسكورد** في تطبيق مصاريفي.\n" +
                "2. انسخ **كود مفتاح الوصول** الخاص بك (يبدأ بـ `MSF-`).\n" +
                "3. أرسل الكود هنا في هذه المحادثة الخاصة!"
          )
          .setFooter({ text: "مصاريفي - رفيقك المالي الذكي" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      // Check for unlink command
      if (rawContent === "إلغاء" || rawContent.toLowerCase() === "unlink") {
        const user: any = dbInstance.prepare("SELECT * FROM users WHERE discordUserId = ?").get(message.author.id);
        if (user) {
          dbInstance.prepare("UPDATE users SET discordUserId = NULL, discordUsername = NULL WHERE id = ?").run(user.id);
          const embed = new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle("🔒 تم إلغاء الربط بنجاح")
            .setDescription(`تم إلغاء ربط حسابك **${user.displayName || user.email}** مع هذا الحساب في ديسكورد.\nلن تصلك إشعارات بعد الآن إلا بعد إعادة الربط بمفتاح جديد.`)
            .setTimestamp();
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply("⚠️ حسابك غير مربوط حالياً بأي مستخدم في تطبيق مصاريفي.");
        }
        return;
      }

      // Check for balance/status command
      if (rawContent === "رصيد" || rawContent === "حالة" || rawContent.toLowerCase() === "status" || rawContent.toLowerCase() === "balance") {
        const user: any = dbInstance.prepare("SELECT * FROM users WHERE discordUserId = ?").get(message.author.id);
        if (!user) {
          await message.reply("⚠️ حسابك غير مربوط حالياً. أرسل كود مفتاح الوصول الخاص بك لربط الحساب.");
          return;
        }

        const currency = user.currency || "ر.س";
        // Calculate user balances
        const txs: any[] = dbInstance.prepare("SELECT * FROM transactions WHERE userId = ?").all(user.id);
        let cash = user.initialCash || 0;
        let bank = user.initialBank || 0;
        let emergency = user.emergencyFund || 0;
        let savings = user.savingsFund || 0;

        for (const tx of txs) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === "income") {
            if (tx.wallet === "cash") cash += amt;
            else if (tx.wallet === "bank") bank += amt;
            else if (tx.wallet === "emergency") emergency += amt;
            else if (tx.wallet === "savings") savings += amt;
          } else if (tx.type === "expense") {
            if (tx.wallet === "cash") cash -= amt;
            else if (tx.wallet === "bank") bank -= amt;
            else if (tx.wallet === "emergency") emergency -= amt;
            else if (tx.wallet === "savings") savings -= amt;
          } else if (tx.type === "transfer" && tx.toWallet) {
            if (tx.wallet === "cash") cash -= amt;
            else if (tx.wallet === "bank") bank -= amt;
            else if (tx.wallet === "emergency") emergency -= amt;
            else if (tx.wallet === "savings") savings -= amt;

            if (tx.toWallet === "cash") cash += amt;
            else if (tx.toWallet === "bank") bank += amt;
            else if (tx.toWallet === "emergency") emergency += amt;
            else if (tx.toWallet === "savings") savings += amt;
          }
        }

        const total = cash + bank + emergency + savings;

        const embed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle(`📊 تقرير رصيد محفظتك (${user.displayName || 'مصاريفي'})`)
          .setDescription(`إجمالي الرصيد المتوفر: **${total.toLocaleString()} ${currency}**`)
          .addFields(
            { name: "🏦 الحساب البنكي", value: `${bank.toLocaleString()} ${currency}`, inline: true },
            { name: "💵 الكاش (النقدي)", value: `${cash.toLocaleString()} ${currency}`, inline: true },
            { name: "🛡️ صندوق الطوارئ", value: `${emergency.toLocaleString()} ${currency}`, inline: true },
            { name: "💰 حصالة الادخار", value: `${savings.toLocaleString()} ${currency}`, inline: true },
          )
          .setFooter({ text: "مصاريفي - رفيقك المالي الذكي" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      // Check for subscriptions command
      if (rawContent === "اشتراكات" || rawContent.toLowerCase() === "subscriptions" || rawContent.toLowerCase() === "subs") {
        const user: any = dbInstance.prepare("SELECT * FROM users WHERE discordUserId = ?").get(message.author.id);
        if (!user) {
          await message.reply("⚠️ حسابك غير مربوط حالياً. أرسل كود مفتاح الوصول الخاص بك لربط الحساب.");
          return;
        }

        const subs: any[] = dbInstance.prepare("SELECT * FROM subscriptions WHERE userId = ?").all(user.id);
        if (subs.length === 0) {
          await message.reply("ℹ️ ليس لديك أي اشتراكات مسجلة حالياً في مصاريفي.");
          return;
        }

        const currency = user.currency || "ر.س";
        const fields = subs.map(s => {
          let dateStr = "غير محدد";
          if (s.nextBillingDate) {
            try {
              dateStr = new Date(s.nextBillingDate).toLocaleDateString("ar-SA");
            } catch (e) {
              dateStr = s.nextBillingDate;
            }
          }
          return {
            name: `📦 ${s.name} (${s.amount} ${currency})`,
            value: `موعد التجديد: **${dateStr}** | الخصم: ${s.autoDeduct ? 'تلقائي ⚡' : 'يدوي'}`,
            inline: false
          };
        });

        const embed = new EmbedBuilder()
          .setColor(0x6366F1)
          .setTitle(`📦 الاشتراكات النشطة (${subs.length})`)
          .setDescription("الاشتراكات الشهرية والتجديد التلقائي:")
          .addFields(fields.slice(0, 10))
          .setFooter({ text: "مصاريفي - رفيقك المالي الذكي" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        return;
      }

      // Check if message is a link key
      const keyMatches = rawContent.match(/MSF-[A-Z0-9]{4}-[A-Z0-9]{4}/i) || [rawContent];
      const testKey = (keyMatches[0] || rawContent).trim().toUpperCase();

      const userWithKey: any = dbInstance.prepare(
        "SELECT * FROM users WHERE UPPER(TRIM(discordAccessKey)) = ? OR UPPER(TRIM(discordAccessKey)) = ?"
      ).get(testKey, testKey.replace(/-/g, ""));

      if (userWithKey) {
        // Link the user!
        const usernameTag = message.author.tag || message.author.username;
        dbInstance.prepare(`
          UPDATE users 
          SET discordUserId = ?, discordUsername = ?, discordNotificationsEnabled = 1 
          WHERE id = ?
        `).run(message.author.id, usernameTag, userWithKey.id);

        const embed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle("🎉 تم ربط حسابك في مصاريفي بنجاح!")
          .setDescription(
            `أهلاً بك يا **${userWithKey.displayName || message.author.username}** 👋\n\n` +
            "تم ربط حسابك في تطبيق **مصاريفي** بهذا الحساب في ديسكورد بنجاح.\n" +
            "ستصلك هنا في الرسائل الخاصة إشعارات فورية بكل العمليات المالية:\n\n" +
            "• 🔄 **خصم الاشتراكات التلقائية**: إشعار عند حلول موعد أي اشتراك مع موعد التجديد القادم.\n" +
            "• 💸 **تسجيل المعاملات**: إشعار فوري عند إضافة أي مصروف أو دخل.\n" +
            "• ⚠️ **تنبيهات الميزانية**: تحذير عند الاقتراب من حد الميزانية الشهري.\n\n" +
            "💡 **أوامر سريعة يمكنك استخدامها:**\n" +
            "• أرسل `رصيد` لمعرفة وضعك المالي الحالي.\n" +
            "• أرسل `اشتراكات` لعرض الاشتراكات القادمة.\n" +
            "• أرسل `مساعدة` لمعرفة كافة الأوامر."
          )
          .setFooter({ text: "مصاريفي - رفيقك المالي الذكي" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        console.log(`[Discord Bot] Successfully linked user ${userWithKey.displayName || userWithKey.id} to Discord user ${usernameTag} (${message.author.id})`);
        return;
      }

      // If user is already linked but sent something unrecognised
      const alreadyLinked: any = dbInstance.prepare("SELECT * FROM users WHERE discordUserId = ?").get(message.author.id);
      if (alreadyLinked) {
        await message.reply(
          `👋 مرحباً **${alreadyLinked.displayName || message.author.username}**!\n` +
          "لم أفهم هذا الأمر. يمكنك إرسال `مساعدة` لعرض الأوامر، أو `رصيد` لمعرفة رصيدك الحالي، أو `اشتراكات` لعرض التزاماتك القادمة."
        );
        return;
      }

      // Not linked and invalid key
      const errorEmbed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle("❌ مفتاح الوصول غير صحيح")
        .setDescription(
          "لم يتم العثور على أي حساب مسجل بهذا المفتاح.\n\n" +
          "**كيف تحصل على المفتاح الصحيح؟**\n" +
          "1. افتح تطبيق **مصاريفي**.\n" +
          "2. توجه إلى **الإعدادات > إشعارات ديسكورد**.\n" +
          "3. انسخ **كود مفتاح الوصول** (مثال: `MSF-A1B2-C3D4`).\n" +
          "4. أرسله هنا في رسالة خاصة للربط الفوري."
        )
        .setFooter({ text: "مصاريفي" })
        .setTimestamp();

      await message.reply({ embeds: [errorEmbed] });
    });

    discordClient.login(token).catch((err) => {
      console.warn("⚠️ [Discord Bot] Failed to log in with provided token:", err?.message || err);
      isBotReady = false;
    });
  } catch (err) {
    console.warn("⚠️ [Discord Bot] Initialization error:", err);
  }
}

export async function sendDiscordNotification(userId: string, options: {
  title: string;
  description: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  type?: "subscription" | "expense" | "income" | "alert" | "info";
}): Promise<boolean> {
  if (!discordClient || !isBotReady || !dbInstance) {
    return false;
  }

  try {
    const user: any = dbInstance.prepare(
      "SELECT discordUserId, discordNotificationsEnabled, displayName FROM users WHERE id = ?"
    ).get(userId);

    if (!user || !user.discordUserId || !user.discordNotificationsEnabled) {
      return false;
    }

    const discordUser = await discordClient.users.fetch(user.discordUserId);
    if (!discordUser) return false;

    let defaultColor = 0x5865F2; // Discord Blurple
    if (options.type === "subscription") defaultColor = 0x6366F1; // Indigo
    else if (options.type === "expense") defaultColor = 0xEF4444; // Red
    else if (options.type === "income") defaultColor = 0x10B981; // Green
    else if (options.type === "alert") defaultColor = 0xF59E0B; // Amber

    const embed = new EmbedBuilder()
      .setColor(options.color || defaultColor)
      .setTitle(options.title)
      .setDescription(options.description)
      .setFooter({ text: "مصاريفي - إشعار فوري" })
      .setTimestamp();

    if (options.fields && options.fields.length > 0) {
      embed.addFields(options.fields);
    }

    await discordUser.send({ embeds: [embed] });
    return true;
  } catch (err: any) {
    console.warn(`[Discord Bot] Could not send DM to user ${userId}:`, err?.message || err);
    return false;
  }
}

export function getDiscordStatus(userId: string) {
  const botId = discordClient?.user?.id || undefined;
  const botAvatar = typeof discordClient?.user?.displayAvatarURL === "function" ? discordClient.user.displayAvatarURL() : undefined;
  const botDmUrl = botId ? `https://discord.com/users/${botId}` : undefined;

  if (!dbInstance) {
    return {
      botOnline: false,
      botUsername: undefined,
      botId: undefined,
      botAvatar: undefined,
      botDmUrl: undefined,
      isLinked: false,
      discordUsername: undefined,
      discordUserId: undefined,
      discordAccessKey: undefined,
      notificationsEnabled: false,
    };
  }

  let user: any = dbInstance.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (user && (!user.discordAccessKey || user.discordAccessKey === "")) {
    const freshKey = generateDiscordKey();
    dbInstance.prepare("UPDATE users SET discordAccessKey = ? WHERE id = ?").run(freshKey, userId);
    user.discordAccessKey = freshKey;
  }

  return {
    botOnline: isBotReady,
    botUsername: botTag || discordClient?.user?.tag || undefined,
    botId,
    botAvatar,
    botDmUrl,
    isLinked: Boolean(user?.discordUserId),
    discordUsername: user?.discordUsername || undefined,
    discordUserId: user?.discordUserId || undefined,
    discordAccessKey: user?.discordAccessKey || undefined,
    notificationsEnabled: Boolean(user?.discordNotificationsEnabled ?? 1),
  };
}

export function regenerateDiscordKey(userId: string): string {
  if (!dbInstance) return generateDiscordKey();
  const freshKey = generateDiscordKey();
  dbInstance.prepare("UPDATE users SET discordAccessKey = ? WHERE id = ?").run(freshKey, userId);
  return freshKey;
}

export function unlinkDiscord(userId: string) {
  if (!dbInstance) return;
  dbInstance.prepare("UPDATE users SET discordUserId = NULL, discordUsername = NULL WHERE id = ?").run(userId);
}

export function setDiscordNotifications(userId: string, enabled: boolean) {
  if (!dbInstance) return;
  dbInstance.prepare("UPDATE users SET discordNotificationsEnabled = ? WHERE id = ?").run(enabled ? 1 : 0, userId);
}

export function linkDiscordManual(userId: string, discordUserId: string, discordUsername: string) {
  if (!dbInstance) return;
  dbInstance.prepare(`
    UPDATE users 
    SET discordUserId = ?, discordUsername = ?, discordNotificationsEnabled = 1 
    WHERE id = ?
  `).run(discordUserId, discordUsername, userId);
}

export function getSystemSetting(key: string, defaultValue = ""): string {
  if (!dbInstance) return defaultValue;
  try {
    const row: any = dbInstance.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
    return row ? String(row.value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSystemSetting(key: string, value: string) {
  if (!dbInstance) return;
  try {
    dbInstance.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)").run(key, value);
  } catch (err) {
    console.error("setSystemSetting error:", err);
  }
}

export const MSARIFY_CATEGORY_NAME = "📁 MSARIFY";

export const MSARIFY_CHANNELS = {
  backups: {
    name: "msarify-backups",
    topic: "💾 النسخ الاحتياطية اليومية لقاعدة بيانات مصاريفي (.sqlite)",
    description: "النسخ الاحتياطية التلقائية واليدوية لقاعدة البيانات"
  },
  users: {
    name: "msarify-users",
    topic: "👥 سجل تسجيل المستخدمين الجدد وإدارة الحسابات",
    description: "سجل تسجيل الأعضاء الجدد وحذف الحسابات"
  },
  security: {
    name: "msarify-security",
    topic: "🔐 سجل الأمان وتغيير وإعادة تعيين كلمات المرور",
    description: "تغيير وإعادة تعيين كلمات المرور والعمليات الأمنية"
  },
  broadcasts: {
    name: "msarify-broadcasts",
    topic: "📢 سجل التعاميم والإعلانات الإدارية الصادرة",
    description: "التعاميم والتنبيهات الإدارية الموجهة للمستخدمين"
  },
  system: {
    name: "msarify-system",
    topic: "⚡ حالة السيرفر والنظام وإشعارات التشغيل والفحوصات",
    description: "إقلاع السيرفر، الفحوصات التجريبية وحالة النظام"
  }
};

export async function ensureMsarifyCategoryAndChannels(guildId: string): Promise<{
  success: boolean;
  category?: any;
  channels?: Record<string, any>;
  channelsList?: Array<{ id: string; name: string; topic: string; key: string }>;
  message?: string;
}> {
  if (!discordClient || !isBotReady) {
    return { success: false, message: "بوت ديسكورد غير متصل حالياً" };
  }

  try {
    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return { success: false, message: "لم يتم العثور على السيرفر. تأكد من إدخال Server ID بشكل صحيح وأن البوت مضاف إليه." };
    }

    const fetchedChannels = await guild.channels.fetch();

    // 1. Find or create Category "📁 MSARIFY"
    let category = fetchedChannels.find((c: any) =>
      c && c.type === ChannelType.GuildCategory && (
        c.name.toLowerCase().includes("msarify") || 
        c.name === MSARIFY_CATEGORY_NAME
      )
    );

    if (!category) {
      category = await guild.channels.create({
        name: MSARIFY_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
      });
      console.log(`[Discord Bot] Created category "${MSARIFY_CATEGORY_NAME}" in guild "${guild.name}"`);
    }

    const createdOrFound: Record<string, any> = {};
    const channelsList: Array<{ id: string; name: string; topic: string; key: string }> = [];

    // 2. Ensure each msarify channel exists under that category
    for (const [key, conf] of Object.entries(MSARIFY_CHANNELS)) {
      let ch = fetchedChannels.find((c: any) =>
        c && c.type === ChannelType.GuildText && c.name.toLowerCase() === conf.name.toLowerCase()
      );

      if (!ch) {
        ch = await guild.channels.create({
          name: conf.name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: conf.topic,
        });
        console.log(`[Discord Bot] Created channel #${conf.name} under category "${category.name}"`);
      } else if (ch.parentId !== category.id) {
        await ch.setParent(category.id).catch(() => {});
      }

      createdOrFound[key] = ch;
      channelsList.push({
        id: ch.id,
        name: ch.name,
        topic: conf.topic,
        key
      });
    }

    return {
      success: true,
      category,
      channels: createdOrFound,
      channelsList,
      message: `تم إنشاء وتهيئة كاتاقوري "${MSARIFY_CATEGORY_NAME}" والرومات بنجاح في سيرفر ${guild.name}!`
    };
  } catch (err: any) {
    console.error("[Discord Bot] Error creating category/channels:", err);
    if (err?.code === 50013) {
      return {
        success: false,
        message: "البوت لا يملك صلاحية إدارة القنوات (Manage Channels). يرجى إعطاء البوت صلاحية Manage Channels في سيرفرك ليتمكن من إنشاء الكاتاقوري والرومات تلقائياً."
      };
    }
    return {
      success: false,
      message: err?.message || "حدث خطأ أثناء إعداد الرومات في ديسكورد"
    };
  }
}

export async function resolveAdminTargetChannel(logType: string = 'system'): Promise<any | null> {
  if (!discordClient || !isBotReady) return null;
  const targetId = getSystemSetting("discord_admin_target_id", process.env.DISCORD_ADMIN_CHANNEL_ID || process.env.DISCORD_GUILD_ID || "").trim();
  if (!targetId) return null;

  try {
    // 1. Try resolving as a server (guild) ID
    const guild = await discordClient.guilds.fetch(targetId).catch(() => null);
    if (guild) {
      // Map logType to channel key
      let channelKey = 'system';
      if (logType === 'backup') channelKey = 'backups';
      else if (logType === 'user') channelKey = 'users';
      else if (logType === 'security') channelKey = 'security';
      else if (logType === 'broadcast') channelKey = 'broadcasts';

      const targetConfig = (MSARIFY_CHANNELS as any)[channelKey] || MSARIFY_CHANNELS.system;

      const channels = await guild.channels.fetch();
      let matchedChannel = channels.find((c: any) =>
        c && c.type === ChannelType.GuildText && c.name.toLowerCase() === targetConfig.name.toLowerCase()
      );

      // If matchedChannel doesn't exist yet, auto-create category and channels!
      if (!matchedChannel) {
        const setup = await ensureMsarifyCategoryAndChannels(guild.id);
        if (setup.success && setup.channels && setup.channels[channelKey]) {
          matchedChannel = setup.channels[channelKey];
        }
      }

      if (matchedChannel) return matchedChannel;

      // Fallbacks if channel creation failed due to permissions:
      const fallbackChannel = channels.find((c: any) =>
        c && c.type === ChannelType.GuildText && /msarify|log|لوق|admin|إدارة|backup|general|عام/i.test(c.name)
      );
      if (fallbackChannel) return fallbackChannel;

      if (guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText) {
        return guild.systemChannel;
      }

      const firstTextChannel = channels.find((c: any) =>
        c && c.type === ChannelType.GuildText && c.permissionsFor(discordClient!.user!)?.has("SendMessages")
      );
      if (firstTextChannel) return firstTextChannel;
    }

    // 2. Direct channel ID fallback
    const ch: any = await discordClient.channels.fetch(targetId).catch(() => null);
    if (ch && (ch.type === ChannelType.GuildText || typeof ch.send === "function")) {
      return ch;
    }
  } catch (err) {
    console.warn("[Discord Bot] Error resolving admin channel:", err);
  }

  return null;
}

export async function sendAdminDiscordLog(event: {
  title: string;
  description: string;
  type?: 'info' | 'success' | 'warn' | 'alert' | 'user' | 'security' | 'broadcast' | 'system' | 'backup';
  fields?: { name: string; value: string; inline?: boolean }[];
}): Promise<boolean> {
  const enabled = getSystemSetting("discord_admin_logs_enabled", "1") !== "0";
  if (!enabled) return false;

  const channel = await resolveAdminTargetChannel(event.type || 'system');
  if (!channel) return false;

  try {
    let color = 0x5865F2; // Blurple
    if (event.type === 'user') color = 0x3B82F6; // Blue
    else if (event.type === 'success') color = 0x10B981; // Emerald
    else if (event.type === 'warn') color = 0xF59E0B; // Amber
    else if (event.type === 'alert' || event.type === 'security') color = 0xEF4444; // Red
    else if (event.type === 'broadcast') color = 0xF59E0B; // Amber
    else if (event.type === 'backup') color = 0x10B981; // Emerald

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🛡️ ${event.title}`)
      .setDescription(event.description)
      .setFooter({ text: `مصاريفي • #${channel.name}` })
      .setTimestamp();

    if (event.fields && event.fields.length > 0) {
      embed.addFields(event.fields);
    }

    await channel.send({ embeds: [embed] });
    return true;
  } catch (err: any) {
    console.warn("[Discord Bot] Failed to send admin log:", err?.message || err);
    return false;
  }
}

export async function sendDailyBackupDiscord(explicitTrigger = false): Promise<{ success: boolean; message: string; channelName?: string }> {
  if (!discordClient || !isBotReady) {
    return { success: false, message: "بوت ديسكورد غير متصل حالياً" };
  }

  const channel = await resolveAdminTargetChannel('backup');
  if (!channel) {
    return { success: false, message: "لم يتم العثور على القناة أو السيرفر، يرجى التأكد من كتابة ID السيرفر بشكل صحيح في لوحة الإدارة" };
  }

  const enabled = getSystemSetting("discord_daily_backup_enabled", "1") !== "0";
  if (!enabled && !explicitTrigger) {
    return { success: false, message: "النسخ الاحتياطي التلقائي معطل في الإعدادات" };
  }

  const tempBackupPath = path.join(os.tmpdir(), `masarify_backup_${Date.now()}.sqlite`);

  try {
    // 1. Create a safe ACID-compliant snapshot of the SQLite database
    if (typeof dbInstance?.backup === "function") {
      await dbInstance.backup(tempBackupPath);
    } else {
      const currentDbPath = process.env.DB_PATH || "data.db";
      fs.copyFileSync(currentDbPath, tempBackupPath);
    }

    // 2. Compute stats
    const stats = fs.statSync(tempBackupPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const displaySize = stats.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    let userCount = 0;
    let txCount = 0;
    let subCount = 0;
    try {
      userCount = dbInstance.prepare("SELECT count(*) as c FROM users").get()?.c || 0;
      txCount = dbInstance.prepare("SELECT count(*) as c FROM transactions").get()?.c || 0;
      subCount = dbInstance.prepare("SELECT count(*) as c FROM subscriptions").get()?.c || 0;
    } catch {}

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("ar-SA", { dateStyle: "full" });
    const timeFormatted = now.toLocaleTimeString("ar-SA", { timeStyle: "medium" });

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle("💾 نسخة احتياطية لقاعدة البيانات (Database Backup)")
      .setDescription(
        explicitTrigger 
          ? `✅ **تم إنشاء وإرسال النسخة الاحتياطية بنجاح إلى #${channel.name}.**` 
          : `🔄 **نسخة احتياطية يومية مجدولة وتلقائية لحفظ وأمان بياناتك.**`
      )
      .addFields(
        { name: "📦 حجم الملف", value: displaySize, inline: true },
        { name: "👥 إجمالي المستخدمين", value: `${userCount} مستخدم`, inline: true },
        { name: "💳 إجمالي العمليات", value: `${txCount} عملية`, inline: true },
        { name: "🔄 إجمالي الاشتراكات", value: `${subCount} اشتراك`, inline: true },
        { name: "📁 الروم", value: `#${channel.name}`, inline: true },
        { name: "📅 التاريخ والوقت", value: `${dateFormatted} - ${timeFormatted}`, inline: true }
      )
      .setFooter({ text: "مصاريفي - الحماية والنسخ الاحتياطي" })
      .setTimestamp();

    const fileName = `masarify_backup_${now.toISOString().slice(0, 10)}.sqlite`;
    const attachment = new AttachmentBuilder(tempBackupPath, { name: fileName });

    await channel.send({ embeds: [embed], files: [attachment] });

    // Update last backup timestamp
    setSystemSetting("discord_last_backup_at", now.toISOString());

    const channelDisplayName = channel.guild ? `${channel.guild.name} (#${channel.name})` : `#${channel.name}`;
    return {
      success: true,
      message: `تم إرسال النسخة الاحتياطية بنجاح إلى ديسكورد: ${channelDisplayName}`,
      channelName: channel.name,
    };
  } catch (err: any) {
    console.error("[Discord Bot] Backup error:", err);
    return { success: false, message: `فشل إرسال النسخة: ${err.message || 'خطأ غير معروف'}` };
  } finally {
    try {
      if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
    } catch {}
  }
}

export async function checkAndRunScheduledBackup() {
  try {
    const enabled = getSystemSetting("discord_daily_backup_enabled", "1") !== "0";
    const targetId = getSystemSetting("discord_admin_target_id", process.env.DISCORD_ADMIN_CHANNEL_ID || process.env.DISCORD_GUILD_ID || "").trim();
    if (!enabled || !targetId || !isBotReady) return;

    const lastBackupStr = getSystemSetting("discord_last_backup_at", "");
    const now = Date.now();
    if (!lastBackupStr) {
      await sendDailyBackupDiscord(false);
    } else {
      const lastBackupTime = new Date(lastBackupStr).getTime();
      if (now - lastBackupTime >= 24 * 60 * 60 * 1000) {
        await sendDailyBackupDiscord(false);
      }
    }
  } catch (err) {
    console.warn("[Discord Bot] Scheduled backup check error:", err);
  }
}

export async function getDiscordAdminSettings() {
  const targetId = getSystemSetting("discord_admin_target_id", process.env.DISCORD_ADMIN_CHANNEL_ID || process.env.DISCORD_GUILD_ID || "");
  const logsEnabled = getSystemSetting("discord_admin_logs_enabled", "1") !== "0";
  const backupEnabled = getSystemSetting("discord_daily_backup_enabled", "1") !== "0";
  const lastBackupAt = getSystemSetting("discord_last_backup_at", "");

  let targetName = "";
  let serverName = "";
  let categoryName = "";
  let channelsList: Array<{ id: string; name: string; topic: string; key: string }> = [];

  if (targetId && isBotReady && discordClient) {
    try {
      const guild = await discordClient.guilds.fetch(targetId).catch(() => null);
      if (guild) {
        serverName = guild.name;
        targetName = guild.name;
        const fetchedChannels = await guild.channels.fetch();
        const category = fetchedChannels.find((c: any) =>
          c && c.type === ChannelType.GuildCategory && (
            c.name.toLowerCase().includes("msarify") || 
            c.name === MSARIFY_CATEGORY_NAME
          )
        );
        if (category) {
          categoryName = category.name;
        }

        for (const [key, conf] of Object.entries(MSARIFY_CHANNELS)) {
          const ch = fetchedChannels.find((c: any) =>
            c && c.type === ChannelType.GuildText && c.name.toLowerCase() === conf.name.toLowerCase()
          );
          if (ch) {
            channelsList.push({
              id: ch.id,
              name: ch.name,
              topic: conf.topic,
              key
            });
          }
        }
      } else {
        const ch: any = await discordClient.channels.fetch(targetId).catch(() => null);
        if (ch) {
          targetName = ch.guild ? `${ch.guild.name} (#${ch.name})` : `#${ch.name}`;
          serverName = ch.guild ? ch.guild.name : "";
        }
      }
    } catch {}
  }

  return {
    targetId,
    logsEnabled,
    backupEnabled,
    lastBackupAt: lastBackupAt || undefined,
    botOnline: isBotReady,
    targetName: targetName || undefined,
    serverName: serverName || undefined,
    categoryName: categoryName || undefined,
    channels: channelsList.length > 0 ? channelsList : undefined,
  };
}

export async function saveDiscordAdminSettings(settings: {
  targetId?: string;
  logsEnabled?: boolean;
  backupEnabled?: boolean;
}) {
  if (settings.targetId !== undefined) {
    const cleanId = settings.targetId.trim();
    setSystemSetting("discord_admin_target_id", cleanId);
    if (cleanId && isBotReady && discordClient) {
      try {
        await ensureMsarifyCategoryAndChannels(cleanId);
      } catch (err) {
        console.warn("[Discord Bot] Auto-provision on save warning:", err);
      }
    }
  }
  if (settings.logsEnabled !== undefined) {
    setSystemSetting("discord_admin_logs_enabled", settings.logsEnabled ? "1" : "0");
  }
  if (settings.backupEnabled !== undefined) {
    setSystemSetting("discord_daily_backup_enabled", settings.backupEnabled ? "1" : "0");
  }
}
