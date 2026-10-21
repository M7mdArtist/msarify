import { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, Events } from "discord.js";
import nodeCrypto from "node:crypto";

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
    });

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
