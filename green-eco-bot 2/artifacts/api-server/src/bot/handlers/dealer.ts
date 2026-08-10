import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  dealerDataTable,
  dealerInventoryTable,
  marketListingsTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import {
  HARVEST_INTERVAL_HOURS,
  FARM_HARVEST_COUNT,
  FARM_UPGRADE_COSTS,
  WORKER_HIRE_COST,
  QUICK_SELL_RATE,
  WORKER_MARKET_BONUS,
} from "../config";
import {
  getRandomSubstance,
  formatSubstanceLine,
  CLASS_ORDER,
  SUBSTANCE_MAP,
  type SubstanceClass,
} from "../substances";

export function registerDealerHandlers(bot: Bot): void {
  // Dealer main menu
  bot.callbackQuery("dealer_menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    await showDealerMenu(ctx);
  });

  // Harvest
  bot.callbackQuery("dealer_harvest", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    const [dealer] = await db
      .select()
      .from(dealerDataTable)
      .where(eq(dealerDataTable.userTelegramId, ctx.from.id))
      .limit(1);

    if (!user || !dealer) {
      await ctx.answerCallbackQuery({ text: "Данные не найдены.", show_alert: true });
      return;
    }

    // Check cooldown
    if (dealer.lastHarvest) {
      const nextHarvestAt = new Date(
        dealer.lastHarvest.getTime() + HARVEST_INTERVAL_HOURS * 3600 * 1000
      );
      if (nextHarvestAt > new Date()) {
        const msLeft = nextHarvestAt.getTime() - Date.now();
        const hoursLeft = Math.floor(msLeft / 3600000);
        const minutesLeft = Math.floor((msLeft % 3600000) / 60000);
        await ctx.answerCallbackQuery({
          text: `Урожай ещё не готов! Осталось: ${hoursLeft}ч ${minutesLeft}мин`,
          show_alert: true,
        });
        return;
      }
    }

    // Generate harvest
    const [minCount, maxCount] = FARM_HARVEST_COUNT[dealer.farmLevel] ?? [1, 3];
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

    const harvestedItems: { key: string; name: string; qty: number }[] = [];
    for (let i = 0; i < count; i++) {
      const substance = getRandomSubstance();
      harvestedItems.push({ key: substance.key, name: substance.name, qty: 1 });
    }

    // Aggregate
    const aggregated = new Map<string, number>();
    for (const item of harvestedItems) {
      aggregated.set(item.key, (aggregated.get(item.key) ?? 0) + item.qty);
    }

    // Update inventory
    for (const [substanceKey, qty] of aggregated.entries()) {
      const existing = await db
        .select()
        .from(dealerInventoryTable)
        .where(
          and(
            eq(dealerInventoryTable.userTelegramId, ctx.from.id),
            eq(dealerInventoryTable.substanceKey, substanceKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(dealerInventoryTable)
          .set({ quantity: existing[0]!.quantity + qty })
          .where(eq(dealerInventoryTable.id, existing[0]!.id));
      } else {
        await db.insert(dealerInventoryTable).values({
          userTelegramId: ctx.from.id,
          substanceKey,
          quantity: qty,
        });
      }
    }

    // Update last harvest
    await db
      .update(dealerDataTable)
      .set({ lastHarvest: new Date() })
      .where(eq(dealerDataTable.userTelegramId, ctx.from.id));

    const harvestLines = Array.from(aggregated.entries())
      .map(([key, qty]) => formatSubstanceLine(key, qty))
      .join("\n");

    await ctx.editMessageText(
      `🌿 <b>Урожай собран!</b>\n\n` +
        `Ферма уровня ${dealer.farmLevel} принесла:\n${harvestLines}\n\n` +
        `⏰ Следующий урожай через ${HARVEST_INTERVAL_HOURS} часов.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("💊 Мой инвентарь", "dealer_inventory")
          .row()
          .text("🔙 К ферме", "dealer_menu"),
      }
    );
  });

  // View inventory
  bot.callbackQuery("dealer_inventory", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const inventory = await db
      .select()
      .from(dealerInventoryTable)
      .where(
        and(
          eq(dealerInventoryTable.userTelegramId, ctx.from.id),
          gt(dealerInventoryTable.quantity, 0)
        )
      );

    if (inventory.length === 0) {
      await ctx.editMessageText("🗃️ Инвентарь пуст. Собери урожай!", {
        reply_markup: new InlineKeyboard().text("🔙 К ферме", "dealer_menu"),
      });
      return;
    }

    // Sort by class (SSS first)
    const sorted = inventory.slice().sort((a, b) => {
      const sa = SUBSTANCE_MAP.get(a.substanceKey);
      const sb = SUBSTANCE_MAP.get(b.substanceKey);
      const ia = sa ? CLASS_ORDER.indexOf(sa.substanceClass) : 0;
      const ib = sb ? CLASS_ORDER.indexOf(sb.substanceClass) : 0;
      return ib - ia;
    });

    const lines = sorted.map((i) => formatSubstanceLine(i.substanceKey, i.quantity));

    // Calculate total quick-sell value
    let totalValue = 0;
    for (const item of inventory) {
      const s = SUBSTANCE_MAP.get(item.substanceKey);
      if (s) totalValue += Math.floor(s.basePrice * QUICK_SELL_RATE) * item.quantity;
    }

    const kb = new InlineKeyboard()
      .text(`💸 Быстрая продажа (~${totalValue.toLocaleString("ru")}$)`, "dealer_quick_sell")
      .row()
      .text("🏪 Выставить на рынок", "dealer_list_market")
      .row()
      .text("🔙 К ферме", "dealer_menu");

    await ctx.editMessageText(
      `🗃️ <b>Инвентарь</b>\n\n` + lines.join("\n") + `\n\n💵 Быстрая продажа: ~${totalValue.toLocaleString("ru")}$ (${Math.round(QUICK_SELL_RATE * 100)}% цены)`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  // Quick sell all
  bot.callbackQuery("dealer_quick_sell", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    const inventory = await db
      .select()
      .from(dealerInventoryTable)
      .where(
        and(
          eq(dealerInventoryTable.userTelegramId, ctx.from.id),
          gt(dealerInventoryTable.quantity, 0)
        )
      );

    if (!user || inventory.length === 0) {
      await ctx.answerCallbackQuery({ text: "Инвентарь пуст!", show_alert: true });
      return;
    }

    let total = 0;
    for (const item of inventory) {
      const s = SUBSTANCE_MAP.get(item.substanceKey);
      if (s) total += Math.floor(s.basePrice * QUICK_SELL_RATE) * item.quantity;
    }

    // Clear inventory
    await db
      .update(dealerInventoryTable)
      .set({ quantity: 0 })
      .where(eq(dealerInventoryTable.userTelegramId, ctx.from.id));

    const newBalance = user.balance + total;
    await db
      .update(usersTable)
      .set({ balance: newBalance })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await ctx.editMessageText(
      `💸 <b>Весь товар продан скупщику!</b>\n\n` +
        `Выручка: +<b>${total.toLocaleString("ru")}$</b>\n` +
        `💰 Баланс: <b>${newBalance.toLocaleString("ru")}$</b>\n\n` +
        `(Скупщик берёт всё по базовой цене минус ${Math.round((1 - QUICK_SELL_RATE) * 100)}%)`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К ферме", "dealer_menu"),
      }
    );
  });

  // Upgrade farm
  bot.callbackQuery(/^upgrade_farm:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const targetLevel = parseInt(ctx.match[1]!);
    const cost = FARM_UPGRADE_COSTS[targetLevel];
    if (!cost) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user || user.balance < cost) {
      await ctx.answerCallbackQuery({
        text: `Недостаточно средств! Нужно ${(cost ?? 0).toLocaleString("ru")}$`,
        show_alert: true,
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ balance: user.balance - cost })
      .where(eq(usersTable.telegramId, ctx.from.id));
    await db
      .update(dealerDataTable)
      .set({ farmLevel: targetLevel })
      .where(eq(dealerDataTable.userTelegramId, ctx.from.id));

    await ctx.editMessageText(
      `🏗️ Ферма улучшена до уровня <b>${targetLevel}</b>!\n\nТеперь урожай больше.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К ферме", "dealer_menu"),
      }
    );
  });

  // Hire worker
  bot.callbackQuery("hire_worker", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);
    if (!user || user.balance < WORKER_HIRE_COST) {
      await ctx.answerCallbackQuery({
        text: `Нужно ${WORKER_HIRE_COST.toLocaleString("ru")}$ для найма!`,
        show_alert: true,
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ balance: user.balance - WORKER_HIRE_COST })
      .where(eq(usersTable.telegramId, ctx.from.id));

    const [dealer] = await db
      .select()
      .from(dealerDataTable)
      .where(eq(dealerDataTable.userTelegramId, ctx.from.id))
      .limit(1);
    if (!dealer) return;

    await db
      .update(dealerDataTable)
      .set({ workersCount: dealer.workersCount + 1 })
      .where(eq(dealerDataTable.userTelegramId, ctx.from.id));

    await ctx.editMessageText(
      `🧑 Закладчик нанят! Теперь рыночные продажи приносят +${Math.round(WORKER_MARKET_BONUS * 100)}% к базовой цене.\n\n` +
        `Всего закладчиков: ${dealer.workersCount + 1}`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К ферме", "dealer_menu"),
      }
    );
  });

  // Placeholder for market listing
  bot.callbackQuery("dealer_list_market", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🏪 <b>Выставить на игровой рынок</b>\n\nЭта функция позволяет продавать вещества другим игрокам по своей цене. Боты-покупатели активнее скупают товары высоких классов (S, SS, SSS).\n\nИспользуй /list_substance для выставления лота.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔙 К инвентарю", "dealer_inventory"),
      }
    );
  });
}

async function showDealerMenu(ctx: { from?: { id: number }; editMessageText: Function }): Promise<void> {
  if (!ctx.from) return;

  const [dealer] = await db
    .select()
    .from(dealerDataTable)
    .where(eq(dealerDataTable.userTelegramId, ctx.from.id))
    .limit(1);

  if (!dealer) {
    // First time — create dealer data
    await db.insert(dealerDataTable).values({ userTelegramId: ctx.from.id });
    const fresh = { farmLevel: 1, lastHarvest: null, workersCount: 0 };
    await renderDealerMenu(ctx, fresh);
    return;
  }

  await renderDealerMenu(ctx, dealer);
}

async function renderDealerMenu(
  ctx: { from?: { id: number }; editMessageText: Function },
  dealer: { farmLevel: number; lastHarvest: Date | null; workersCount: number }
): Promise<void> {
  if (!ctx.from) return;

  const now = new Date();
  let harvestStatus: string;
  let canHarvest = false;

  if (!dealer.lastHarvest) {
    harvestStatus = "✅ Готов к сбору!";
    canHarvest = true;
  } else {
    const nextAt = new Date(dealer.lastHarvest.getTime() + HARVEST_INTERVAL_HOURS * 3600 * 1000);
    if (now >= nextAt) {
      harvestStatus = "✅ Готов к сбору!";
      canHarvest = true;
    } else {
      const ms = nextAt.getTime() - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      harvestStatus = `⏳ Через ${h}ч ${m}мин`;
    }
  }

  const upgradeCost = FARM_UPGRADE_COSTS[dealer.farmLevel + 1];
  const [minHarvest, maxHarvest] = FARM_HARVEST_COUNT[dealer.farmLevel] ?? [1, 3];

  const text =
    `🌿 <b>Ферма барыги</b>\n\n` +
    `🏗️ Уровень фермы: <b>${dealer.farmLevel}/5</b>\n` +
    `🧑 Закладчиков: <b>${dealer.workersCount}</b> (+${dealer.workersCount > 0 ? Math.round(WORKER_MARKET_BONUS * 100) : 0}% к продажам)\n` +
    `🌾 Урожай: ${minHarvest}–${maxHarvest} шт. за раз\n` +
    `⏰ Статус: ${harvestStatus}`;

  const kb = new InlineKeyboard();
  if (canHarvest) {
    kb.text("🌾 Собрать урожай", "dealer_harvest").row();
  }
  kb.text("🗃️ Инвентарь", "dealer_inventory").row();
  if (upgradeCost) {
    kb.text(`🏗️ Улучшить ферму (${upgradeCost.toLocaleString("ru")}$)`, `upgrade_farm:${dealer.farmLevel + 1}`).row();
  }
  kb.text(`🧑 Нанять закладчика (${WORKER_HIRE_COST.toLocaleString("ru")}$)`, "hire_worker").row();
  kb.text("🔙 Главное меню", "main_menu");

  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
}
