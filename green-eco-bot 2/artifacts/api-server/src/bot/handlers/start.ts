import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💼 Доступные работы", "jobs_menu")
    .text("📩 Сообщения", "messages_menu")
    .text("🛒 Маркет", "market_main")
    .row()
    .text("👤 Профиль", "profile_menu");
}

export function registerStartHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from) return;

    const tgId = ctx.from.id;
    const username = ctx.from.username ?? null;
    const firstName = ctx.from.first_name ?? "";

    // Upsert user
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, tgId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        telegramId: tgId,
        username,
        firstName,
      });
    } else {
      await db
        .update(usersTable)
        .set({ username, firstName })
        .where(eq(usersTable.telegramId, tgId));
    }

    const user = existing[0] ?? { balance: 0, lawfulness: 0, currentJob: null };

    const displayName = username ? `@${username}` : firstName;
    const jobLabel = user.currentJob ? jobName(user.currentJob) : "нет";

    const text =
      `🌿 Добро пожаловать, ${displayName}, в бот <b>Green</b>!\n\n` +
      `Здесь ты можешь зарабатывать валюту ($) на удовольствия и кастомизацию.\n` +
      `Купленные на маркете вещи автоматически переносятся в чат с нашим ботом, если он добавлен туда.\n\n` +
      `💰 <b>Баланс:</b> ${user.balance.toLocaleString("ru")}$\n` +
      `⚖️ <b>Законопослушность:</b> ${user.lawfulness}\n` +
      `💼 <b>Работа:</b> ${jobLabel}`;

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    });
  });

  // Profile button
  bot.callbackQuery("profile_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);

    const user = rows[0];
    if (!user) {
      await ctx.answerCallbackQuery({ text: "Профиль не найден. Введи /start" });
      return;
    }

    const displayName = user.username ? `@${user.username}` : user.firstName;
    const jobLabel = user.currentJob ? jobName(user.currentJob) : "нет";

    const text =
      `👤 <b>Профиль</b>\n\n` +
      `🆔 ID: <code>${user.telegramId}</code>\n` +
      `👤 Имя: ${displayName}\n` +
      `💰 Баланс: <b>${user.balance.toLocaleString("ru")}$</b>\n` +
      `⚖️ Законопослушность: <b>${user.lawfulness}</b>\n` +
      `💼 Работа: <b>${jobLabel}</b>\n` +
      `🎖️ Полиция: ${user.policeUnlocked ? "✅ Разблокирована" : `🔒 (нужно ${30} законопослушности)`}\n` +
      `🌿 Барыга: ${user.dealerUnlocked ? "✅ Разблокирована" : "🔒 (редкое предложение)"}`;

    const kb = new InlineKeyboard().text("🔙 Главное меню", "main_menu");

    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
  });

  // Back to main menu
  bot.callbackQuery("main_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);

    const user = rows[0];
    const displayName = user?.username
      ? `@${user.username}`
      : (user?.firstName ?? "незнакомец");
    const jobLabel = user?.currentJob ? jobName(user.currentJob) : "нет";

    const text =
      `🌿 <b>Green</b> — Главное меню\n\n` +
      `👤 ${displayName}\n` +
      `💰 <b>Баланс:</b> ${(user?.balance ?? 0).toLocaleString("ru")}$\n` +
      `⚖️ <b>Законопослушность:</b> ${user?.lawfulness ?? 0}\n` +
      `💼 <b>Работа:</b> ${jobLabel}`;

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    });
  });
}

export function jobName(key: string): string {
  const names: Record<string, string> = {
    office: "🖥️ Офисный работник",
    loader: "📦 Грузчик",
    garbage: "🗑️ Мусорщик",
    cleaner: "🧹 Уборщик",
    cashier: "💰 Кассир",
    police: "👮 Полицейский",
    dealer: "🌿 Барыга",
  };
  return names[key] ?? key;
}
