import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  pendingShiftsTable,
  policeDataTable,
} from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import {
  JOBS,
  REGULAR_JOBS,
  POLICE_UNLOCK_LAWFULNESS,
  type JobType,
} from "../config";
import { jobName } from "./start";

export function registerJobHandlers(bot: Bot): void {
  // Jobs menu
  bot.callbackQuery("jobs_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    await showJobsMenu(ctx);
  });

  // Take a regular job
  bot.callbackQuery(/^take_job:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const jobKey = ctx.match[1] as JobType;
    const jobCfg = JOBS[jobKey];
    if (!jobCfg) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user) return;

    if (user.currentJob === jobKey) {
      // Quit job
      await db
        .update(usersTable)
        .set({ currentJob: null })
        .where(eq(usersTable.telegramId, ctx.from.id));
      await ctx.editMessageText(
        `🚪 Ты уволился с должности <b>${jobCfg.emoji} ${jobCfg.name}</b>.\n\nЗаходи, когда понадоблюсь!`,
        { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔙 Назад к работам", "jobs_menu") }
      );
      return;
    }

    // Hire
    await db
      .update(usersTable)
      .set({ currentJob: jobKey })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await ctx.editMessageText(
      `✅ Ты устроился на работу: <b>${jobCfg.emoji} ${jobCfg.name}</b>\n\n` +
        `💵 Зарплата за смену: <b>${jobCfg.salaryPerShift}$</b>\n` +
        `⏰ Смены приходят каждые ~${jobCfg.shiftIntervalHours} ч. У тебя будет ${jobCfg.shiftExpiryHours} ч. на подтверждение.\n\n` +
        `⚖️ За каждую смену +1 к законопослушности.`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("🔙 К работам", "jobs_menu") }
    );
  });

  // Take police job
  bot.callbackQuery("take_job:police", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user) return;

    if (!user.policeUnlocked) {
      await ctx.answerCallbackQuery({
        text: `Нужно ${POLICE_UNLOCK_LAWFULNESS} законопослушности!`,
        show_alert: true,
      });
      return;
    }

    if (user.currentJob === "police") {
      await db
        .update(usersTable)
        .set({ currentJob: null })
        .where(eq(usersTable.telegramId, ctx.from.id));
      await ctx.editMessageText(`🚪 Ты уволился из полиции.`, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К работам", "jobs_menu"),
      });
      return;
    }

    // Create police data if not exists
    const existing = await db
      .select()
      .from(policeDataTable)
      .where(eq(policeDataTable.userTelegramId, ctx.from.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(policeDataTable).values({ userTelegramId: ctx.from.id });
    }

    await db
      .update(usersTable)
      .set({ currentJob: "police" })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await ctx.editMessageText(
      `👮 Ты поступил на <b>Государственную службу</b>!\n\n` +
        `Твой начальный ранг: <b>F</b>\n` +
        `Выполняй спецоперации, чтобы повышаться в звании.\n` +
        `Миссии будут приходить в личные сообщения бота.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К работам", "jobs_menu"),
      }
    );
  });

  // Take dealer job
  bot.callbackQuery("take_job:dealer", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user) return;

    if (!user.dealerUnlocked) {
      await ctx.answerCallbackQuery({
        text: "У тебя нет доступа к этой профессии.",
        show_alert: true,
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ currentJob: "dealer" })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await ctx.editMessageText(
      `🌿 Добро пожаловать в теневой бизнес!\n\n` +
        `Твоя ферма уже ждёт. Урожай будет готов каждые 6 часов.\n` +
        `Открой раздел <b>Барыга</b> в меню работ, чтобы управлять бизнесом.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К работам", "jobs_menu"),
      }
    );
  });

  // Confirm shift
  bot.callbackQuery(/^confirm_shift:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;

    const shiftId = parseInt(ctx.match[1]!);

    const [shift] = await db
      .select()
      .from(pendingShiftsTable)
      .where(
        and(
          eq(pendingShiftsTable.id, shiftId),
          eq(pendingShiftsTable.userTelegramId, ctx.from.id)
        )
      )
      .limit(1);

    if (!shift) {
      await ctx.answerCallbackQuery({ text: "Смена не найдена.", show_alert: true });
      return;
    }
    if (shift.confirmed) {
      await ctx.answerCallbackQuery({ text: "Смена уже подтверждена!", show_alert: true });
      return;
    }
    if (shift.expiresAt < new Date()) {
      await ctx.answerCallbackQuery({ text: "Время смены истекло!", show_alert: true });
      return;
    }

    const jobCfg = JOBS[shift.jobType as JobType];
    const salary = jobCfg?.salaryPerShift ?? 80;

    // Mark confirmed + pay + lawfulness
    await db
      .update(pendingShiftsTable)
      .set({ confirmed: true, confirmedAt: new Date() })
      .where(eq(pendingShiftsTable.id, shiftId));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user) return;

    const newBalance = user.balance + salary;
    const newLawfulness = user.lawfulness + 1;

    await db
      .update(usersTable)
      .set({ balance: newBalance, lawfulness: newLawfulness })
      .where(eq(usersTable.telegramId, ctx.from.id));

    // Check police unlock
    const justUnlocked =
      !user.policeUnlocked && newLawfulness >= POLICE_UNLOCK_LAWFULNESS;
    if (justUnlocked) {
      await db
        .update(usersTable)
        .set({ policeUnlocked: true })
        .where(eq(usersTable.telegramId, ctx.from.id));
    }

    await ctx.answerCallbackQuery({ text: `+${salary}$ получено!` });

    await ctx.editMessageText(
      `✅ <b>Смена подтверждена!</b>\n\n` +
        `💵 Зарплата: +<b>${salary}$</b>\n` +
        `💰 Баланс: <b>${newBalance.toLocaleString("ru")}$</b>\n` +
        `⚖️ Законопослушность: <b>${newLawfulness}</b>` +
        (justUnlocked
          ? `\n\n🎉 <b>Поздравляю! Ты набрал достаточно законопослушности.</b>\n👮 Профессия <b>Полицейский</b> теперь доступна в разделе «Работы»!`
          : ""),
      { parse_mode: "HTML" }
    );
  });
}

async function showJobsMenu(ctx: { from?: { id: number }; editMessageText: Function }): Promise<void> {
  if (!ctx.from) return;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, ctx.from.id))
    .limit(1);

  if (!user) return;

  const currentJob = user.currentJob;
  const kb = new InlineKeyboard();

  // Regular jobs
  for (const job of REGULAR_JOBS) {
    const isCurrent = currentJob === job.key;
    const label = isCurrent ? `✅ ${job.emoji} ${job.name}` : `${job.emoji} ${job.name}`;
    kb.text(label, `take_job:${job.key}`).row();
  }

  // Police
  if (user.policeUnlocked) {
    const isCurrent = currentJob === "police";
    const label = isCurrent ? "✅ 👮 Полицейский" : "👮 Полицейский";
    kb.text(label, "take_job:police").row();
  } else {
    kb.text(`🔒 Полицейский (нужно ${POLICE_UNLOCK_LAWFULNESS} законопослушности)`, "locked_police").row();
  }

  // Dealer
  if (user.dealerUnlocked) {
    const isCurrent = currentJob === "dealer";
    const label = isCurrent ? "✅ 🌿 Барыга (SSS)" : "🌿 Барыга (SSS)";
    kb.text(label, "take_job:dealer").row();
  } else {
    kb.text("🔒 Барыга (редкое предложение)", "locked_dealer").row();
  }

  kb.text("🔙 Главное меню", "main_menu");

  const lines: string[] = [
    `💼 <b>Доступные работы</b>\n`,
    `⚖️ Законопослушность: ${user.lawfulness}\n`,
    `Нажми на профессию, чтобы устроиться (или уволиться, если уже работаешь).\n`,
  ];

  for (const job of REGULAR_JOBS) {
    lines.push(`${job.emoji} <b>${job.name}</b> — ${job.salaryPerShift}$/смена`);
  }

  if (user.policeUnlocked) {
    lines.push(`\n👮 <b>Полицейский</b> — зарплата по рангу`);
  }
  if (user.dealerUnlocked) {
    lines.push(`🌿 <b>Барыга</b> — урожай каждые 6ч`);
  }

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

// Locked profession callbacks (just answer with alert)
export function registerLockedHandlers(bot: Bot): void {
  bot.callbackQuery("locked_police", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: `Нужно ${POLICE_UNLOCK_LAWFULNESS} законопослушности для разблокировки!`,
      show_alert: true,
    });
  });
  bot.callbackQuery("locked_dealer", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Барыга — SSS-профессия. Жди особого предложения (1.5% шанс в день).",
      show_alert: true,
    });
  });
}
