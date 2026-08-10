import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  policeDataTable,
  pendingMissionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  POLICE_RANKS,
  RANK_MISSION_REQUIREMENTS,
  POLICE_BASE_SALARY,
  STATION_SALARY_BONUS,
  STATION_UPGRADE_COSTS,
  type PoliceRank,
} from "../config";
import { mainMenuKeyboard } from "./start";

export function registerPoliceHandlers(bot: Bot): void {
  // Police info (from messages menu)
  bot.callbackQuery("police_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    await showPoliceMenu(ctx);
  });

  // Upgrade station
  bot.callbackQuery(/^upgrade_station:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const targetLevel = parseInt(ctx.match[1]!);
    const cost = STATION_UPGRADE_COSTS[targetLevel];
    if (!cost) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    const [police] = await db
      .select()
      .from(policeDataTable)
      .where(eq(policeDataTable.userTelegramId, ctx.from.id))
      .limit(1);

    if (!user || !police) return;

    if (user.balance < cost) {
      await ctx.answerCallbackQuery({
        text: `Недостаточно средств! Нужно ${cost.toLocaleString("ru")}$`,
        show_alert: true,
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ balance: user.balance - cost })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await db
      .update(policeDataTable)
      .set({ stationLevel: targetLevel })
      .where(eq(policeDataTable.userTelegramId, ctx.from.id));

    await ctx.editMessageText(
      `🏛️ <b>Отделение полиции</b> улучшено до уровня <b>${targetLevel}</b>!\n\n` +
        `Теперь миссии будут приходить чаще, а базовая зарплата выше.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К полиции", "police_info"),
      }
    );
  });

  // Confirm mission
  bot.callbackQuery(/^confirm_mission:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;

    const missionId = parseInt(ctx.match[1]!);

    const [mission] = await db
      .select()
      .from(pendingMissionsTable)
      .where(
        and(
          eq(pendingMissionsTable.id, missionId),
          eq(pendingMissionsTable.userTelegramId, ctx.from.id)
        )
      )
      .limit(1);

    if (!mission) {
      await ctx.answerCallbackQuery({ text: "Миссия не найдена.", show_alert: true });
      return;
    }
    if (mission.confirmed) {
      await ctx.answerCallbackQuery({ text: "Миссия уже выполнена!", show_alert: true });
      return;
    }
    if (mission.expiresAt < new Date()) {
      await ctx.answerCallbackQuery({ text: "Время миссии истекло!", show_alert: true });
      return;
    }

    // Mark confirmed
    await db
      .update(pendingMissionsTable)
      .set({ confirmed: true, confirmedAt: new Date() })
      .where(eq(pendingMissionsTable.id, missionId));

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    const [police] = await db
      .select()
      .from(policeDataTable)
      .where(eq(policeDataTable.userTelegramId, ctx.from.id))
      .limit(1);

    if (!user || !police) return;

    // Pay + update missions
    const newBalance = user.balance + mission.rewardAmount;
    const newLawfulness = user.lawfulness + mission.bonusReputation;
    await db
      .update(usersTable)
      .set({ balance: newBalance, lawfulness: newLawfulness })
      .where(eq(usersTable.telegramId, ctx.from.id));

    const newMissionsCompleted = police.missionsCompleted + 1;
    const newTotalMissions = police.totalMissions + 1;
    const required = RANK_MISSION_REQUIREMENTS[police.rank as PoliceRank];
    const rankIdx = POLICE_RANKS.indexOf(police.rank as PoliceRank);

    let newRank = police.rank;
    let newMissionsForRank = newMissionsCompleted;
    let rankUpMessage = "";

    if (required > 0 && newMissionsCompleted >= required && rankIdx < POLICE_RANKS.length - 1) {
      newRank = POLICE_RANKS[rankIdx + 1]!;
      newMissionsForRank = 0;
      rankUpMessage =
        `\n\n🎖️ <b>ПОВЫШЕНИЕ В ЗВАНИИ!</b>\n` +
        `Твой новый ранг: <b>${newRank}</b>\n` +
        `Базовая зарплата теперь: <b>${POLICE_BASE_SALARY[newRank as PoliceRank].toLocaleString("ru")}$</b>`;
    }

    await db
      .update(policeDataTable)
      .set({
        missionsCompleted: newMissionsForRank,
        totalMissions: newTotalMissions,
        rank: newRank,
      })
      .where(eq(policeDataTable.userTelegramId, ctx.from.id));

    await ctx.answerCallbackQuery({ text: `+${mission.rewardAmount}$ получено!` });

    await ctx.editMessageText(
      `✅ <b>Операция выполнена!</b>\n\n` +
        `🎯 ${mission.missionType}\n\n` +
        `💵 Награда: +<b>${mission.rewardAmount.toLocaleString("ru")}$</b>\n` +
        `⚖️ Репутация: +${mission.bonusReputation}\n` +
        `💰 Баланс: <b>${newBalance.toLocaleString("ru")}$</b>` +
        rankUpMessage,
      { parse_mode: "HTML" }
    );
  });
}

async function showPoliceMenu(ctx: { from?: { id: number }; editMessageText: Function }): Promise<void> {
  if (!ctx.from) return;

  const [police] = await db
    .select()
    .from(policeDataTable)
    .where(eq(policeDataTable.userTelegramId, ctx.from.id))
    .limit(1);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, ctx.from.id))
    .limit(1);

  if (!police || !user) {
    return;
  }

  const rank = police.rank as PoliceRank;
  const required = RANK_MISSION_REQUIREMENTS[rank];
  const baseSalary = POLICE_BASE_SALARY[rank];
  const salaryMult = STATION_SALARY_BONUS[police.stationLevel] ?? 1;
  const actualSalary = Math.floor(baseSalary * salaryMult);

  const rankIdx = POLICE_RANKS.indexOf(rank);
  const isMaxRank = rankIdx === POLICE_RANKS.length - 1;

  const progressBar = required > 0
    ? buildProgressBar(police.missionsCompleted, required)
    : "— (макс. ранг)";

  const nextUpgradeCost = STATION_UPGRADE_COSTS[police.stationLevel + 1];

  const lines = [
    `👮 <b>Полицейский</b>`,
    ``,
    `🎖️ Ранг: <b>${rank}</b>`,
    `🏛️ Уровень отделения: <b>${police.stationLevel}/5</b>`,
    `💵 Зарплата за смену: <b>${actualSalary.toLocaleString("ru")}$</b>`,
    ``,
    isMaxRank
      ? `✨ Максимальный ранг!`
      : `📊 Миссии до повышения: <b>${police.missionsCompleted}/${required}</b>\n${progressBar}`,
    ``,
    `📋 Всего выполнено миссий: ${police.totalMissions}`,
  ];

  const kb = new InlineKeyboard();
  if (nextUpgradeCost && police.stationLevel < 5) {
    kb.text(
      `🏛️ Улучшить отделение (${nextUpgradeCost.toLocaleString("ru")}$)`,
      `upgrade_station:${police.stationLevel + 1}`
    ).row();
  }
  kb.text("🔙 Главное меню", "main_menu");

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

function buildProgressBar(current: number, max: number): string {
  const filled = Math.round((current / max) * 10);
  const empty = 10 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}
