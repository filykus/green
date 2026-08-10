import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  pendingShiftsTable,
  pendingMissionsTable,
} from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";

export function registerMessagesHandlers(bot: Bot): void {
  bot.callbackQuery("messages_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const now = new Date();

    // Count unconfirmed, non-expired shifts
    const shifts = await db
      .select()
      .from(pendingShiftsTable)
      .where(
        and(
          eq(pendingShiftsTable.userTelegramId, ctx.from.id),
          eq(pendingShiftsTable.confirmed, false),
          gt(pendingShiftsTable.expiresAt, now)
        )
      );

    // Count unconfirmed, non-expired missions
    const missions = await db
      .select()
      .from(pendingMissionsTable)
      .where(
        and(
          eq(pendingMissionsTable.userTelegramId, ctx.from.id),
          eq(pendingMissionsTable.confirmed, false),
          gt(pendingMissionsTable.expiresAt, now)
        )
      );

    const total = shifts.length + missions.length;

    const lines: string[] = [
      `📩 <b>Сообщения</b>\n`,
    ];

    const kb = new InlineKeyboard();

    if (shifts.length > 0) {
      lines.push(`⏰ Ожидают подтверждения смены: <b>${shifts.length}</b>`);
      for (const shift of shifts) {
        const jobLabel = jobDisplayName(shift.jobType);
        const expiresIn = Math.floor((shift.expiresAt.getTime() - now.getTime()) / 60000);
        kb.text(
          `✅ Смена: ${jobLabel} (истекает через ${expiresIn}мин)`,
          `confirm_shift:${shift.id}`
        ).row();
      }
    }

    if (missions.length > 0) {
      lines.push(`🎯 Ожидают выполнения миссии: <b>${missions.length}</b>`);
      for (const mission of missions) {
        const expiresIn = Math.floor((mission.expiresAt.getTime() - now.getTime()) / 60000);
        kb.text(
          `✅ Миссия: ${mission.missionType} (+${mission.rewardAmount}$) — ${expiresIn}мин`,
          `confirm_mission:${mission.id}`
        ).row();
      }
    }

    if (total === 0) {
      lines.push(`Нет новых сообщений. Ожидай смены или миссии — они придут автоматически.`);
    }

    kb.text("🔙 Главное меню", "main_menu");

    await ctx.editMessageText(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  });
}

function jobDisplayName(key: string): string {
  const names: Record<string, string> = {
    office: "Офисный",
    loader: "Грузчик",
    garbage: "Мусорщик",
    cleaner: "Уборщик",
    cashier: "Кассир",
    police: "Полиция",
    dealer: "Ферма",
  };
  return names[key] ?? key;
}
