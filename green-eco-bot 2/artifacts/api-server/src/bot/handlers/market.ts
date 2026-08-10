import { Bot, InlineKeyboard } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  catalogItemsTable,
  userCatalogItemsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const BOT_NETWORKS: Record<string, { name: string; emoji: string; description: string }> = {
  green_rp: {
    name: "Green RP",
    emoji: "🎭",
    description: "Бот для чата и ролевых игр. Кастомизация персонажа, статусы и аксессуары.",
  },
  green_casino: {
    name: "Green Casino",
    emoji: "🎰",
    description: "Казино и азартные игры. Усилители удачи, VIP-доступ и бонусы.",
  },
};

export function registerMarketHandlers(bot: Bot): void {
  // Main market screen
  bot.callbackQuery("market_main", async (ctx) => {
    await ctx.answerCallbackQuery();

    const kb = new InlineKeyboard();
    for (const [key, network] of Object.entries(BOT_NETWORKS)) {
      kb.text(`${network.emoji} ${network.name}`, `market_bot:${key}`).row();
    }
    kb.text("🔙 Главное меню", "main_menu");

    await ctx.editMessageText(
      `🛒 <b>Маркет Green</b>\n\n` +
        `Выбери бота сети, в котором хочешь приобрести вещи.\n` +
        `Купленные предметы привязаны к твоему профилю и отображаются в целевом боте.`,
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  // Bot network catalog
  bot.callbackQuery(/^market_bot:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const networkKey = ctx.match[1]!;
    const network = BOT_NETWORKS[networkKey];
    if (!network) return;

    const items = await db
      .select()
      .from(catalogItemsTable)
      .where(
        and(
          eq(catalogItemsTable.botNetwork, networkKey),
          eq(catalogItemsTable.isAvailable, true)
        )
      );

    // Owned items by user
    const owned = await db
      .select()
      .from(userCatalogItemsTable)
      .where(eq(userCatalogItemsTable.userTelegramId, ctx.from.id));
    const ownedItemIds = new Set(owned.map((o) => o.itemId));

    if (items.length === 0) {
      await ctx.editMessageText(
        `${network.emoji} <b>${network.name}</b>\n\nКаталог пока пуст. Следи за обновлениями!`,
        {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("🔙 К маркету", "market_main"),
        }
      );
      return;
    }

    const lines: string[] = [
      `${network.emoji} <b>${network.name}</b>`,
      `<i>${network.description}</i>`,
      ``,
    ];

    const kb = new InlineKeyboard();
    for (const item of items) {
      const isOwned = ownedItemIds.has(item.id);
      lines.push(
        `${item.emoji} <b>${item.name}</b> — ${item.price.toLocaleString("ru")}$` +
          (isOwned ? ` ✅` : "")
      );
      lines.push(`<i>${item.description}</i>`);
      lines.push(``);

      if (!isOwned) {
        kb.text(
          `${item.emoji} Купить «${item.name}» — ${item.price.toLocaleString("ru")}$`,
          `buy_item:${item.id}`
        ).row();
      } else {
        kb.text(`✅ ${item.name} — куплено`, `item_owned:${item.id}`).row();
      }
    }

    kb.text("🔙 К маркету", "market_main");

    await ctx.editMessageText(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  });

  // Buy item
  bot.callbackQuery(/^buy_item:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const itemId = parseInt(ctx.match[1]!);

    const [item] = await db
      .select()
      .from(catalogItemsTable)
      .where(eq(catalogItemsTable.id, itemId))
      .limit(1);

    if (!item) {
      await ctx.answerCallbackQuery({ text: "Товар не найден.", show_alert: true });
      return;
    }

    // Check already owned
    const existing = await db
      .select()
      .from(userCatalogItemsTable)
      .where(
        and(
          eq(userCatalogItemsTable.userTelegramId, ctx.from.id),
          eq(userCatalogItemsTable.itemId, itemId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await ctx.answerCallbackQuery({
        text: "Ты уже владеешь этим предметом!",
        show_alert: true,
      });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramId, ctx.from.id))
      .limit(1);

    if (!user) return;

    if (user.balance < item.price) {
      await ctx.answerCallbackQuery({
        text: `Недостаточно средств! Нужно ${item.price.toLocaleString("ru")}$, у тебя ${user.balance.toLocaleString("ru")}$`,
        show_alert: true,
      });
      return;
    }

    // Purchase
    await db
      .update(usersTable)
      .set({ balance: user.balance - item.price })
      .where(eq(usersTable.telegramId, ctx.from.id));

    await db.insert(userCatalogItemsTable).values({
      userTelegramId: ctx.from.id,
      itemId,
    });

    await ctx.editMessageText(
      `✅ <b>Покупка совершена!</b>\n\n` +
        `${item.emoji} <b>${item.name}</b>\n` +
        `<i>${item.description}</i>\n\n` +
        `💵 Потрачено: ${item.price.toLocaleString("ru")}$\n` +
        `💰 Баланс: ${(user.balance - item.price).toLocaleString("ru")}$\n\n` +
        `Предмет привязан к твоему профилю и будет отображаться в боте <b>${BOT_NETWORKS[item.botNetwork]?.name ?? item.botNetwork}</b>.`,
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("🛒 Продолжить покупки", `market_bot:${item.botNetwork}`)
          .row()
          .text("🔙 Главное меню", "main_menu"),
      }
    );
  });

  // Already owned - just answer
  bot.callbackQuery(/^item_owned:\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Этот предмет уже у тебя есть!",
      show_alert: false,
    });
  });

  // My items
  bot.callbackQuery("my_items", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;

    const owned = await db
      .select({
        itemId: userCatalogItemsTable.itemId,
        acquiredAt: userCatalogItemsTable.acquiredAt,
        name: catalogItemsTable.name,
        emoji: catalogItemsTable.emoji,
        botNetwork: catalogItemsTable.botNetwork,
        description: catalogItemsTable.description,
      })
      .from(userCatalogItemsTable)
      .innerJoin(catalogItemsTable, eq(userCatalogItemsTable.itemId, catalogItemsTable.id))
      .where(eq(userCatalogItemsTable.userTelegramId, ctx.from.id));

    if (owned.length === 0) {
      await ctx.editMessageText("У тебя пока нет купленных предметов. Загляни в 🛒 Маркет!", {
        reply_markup: new InlineKeyboard()
          .text("🛒 Маркет", "market_main")
          .row()
          .text("🔙 Главное меню", "main_menu"),
      });
      return;
    }

    const lines = [`🎒 <b>Мои предметы</b>\n`];
    for (const item of owned) {
      lines.push(`${item.emoji} <b>${item.name}</b> — ${BOT_NETWORKS[item.botNetwork]?.name ?? item.botNetwork}`);
      lines.push(`<i>${item.description}</i>\n`);
    }

    await ctx.editMessageText(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("🛒 Маркет", "market_main")
        .row()
        .text("🔙 Главное меню", "main_menu"),
    });
  });
}

// Seed catalog items if not present
export async function seedCatalogItems(): Promise<void> {
  const existing = await db.select().from(catalogItemsTable).limit(1);
  if (existing.length > 0) return;

  const items = [
    // Green RP
    {
      botNetwork: "green_rp",
      name: "Кастомное имя",
      description: "Уникальное отображаемое имя в ролевых играх",
      price: 500,
      category: "Кастомизация",
      emoji: "✏️",
    },
    {
      botNetwork: "green_rp",
      name: "VIP статус",
      description: "VIP-значок рядом с именем в чатах сети Green",
      price: 2000,
      category: "Статусы",
      emoji: "⭐",
    },
    {
      botNetwork: "green_rp",
      name: "Уникальный тег",
      description: "Персональный тег для отображения в профиле",
      price: 1000,
      category: "Кастомизация",
      emoji: "🏷️",
    },
    {
      botNetwork: "green_rp",
      name: "Золотая метка",
      description: "Редкий золотой маркер — символ высокого статуса",
      price: 5000,
      category: "Редкие",
      emoji: "🥇",
    },
    {
      botNetwork: "green_rp",
      name: "Именной канал",
      description: "Персональный именной канал в сети Green RP",
      price: 10000,
      category: "Премиум",
      emoji: "📢",
    },

    // Green Casino
    {
      botNetwork: "green_casino",
      name: "Удвоитель х2",
      description: "Удваивает выигрыш в следующей игре",
      price: 1500,
      category: "Усилители",
      emoji: "✖️",
    },
    {
      botNetwork: "green_casino",
      name: "Страховка",
      description: "Защищает от потери ставки один раз",
      price: 800,
      category: "Защита",
      emoji: "🛡️",
    },
    {
      botNetwork: "green_casino",
      name: "VIP Фишки",
      description: "Набор премиальных фишек для эксклюзивных столов",
      price: 3000,
      category: "Премиум",
      emoji: "🎲",
    },
    {
      botNetwork: "green_casino",
      name: "Бонус 5000$",
      description: "Зачисляет 5000 казино-кредитов на счёт",
      price: 4000,
      category: "Бонусы",
      emoji: "💎",
    },
    {
      botNetwork: "green_casino",
      name: "Золотой стол",
      description: "Пожизненный доступ к эксклюзивному VIP-столу",
      price: 15000,
      category: "Премиум",
      emoji: "🏆",
    },
  ];

  await db.insert(catalogItemsTable).values(items);
}
