import { Bot } from "grammy";
import { logger } from "../lib/logger";
import { registerStartHandlers } from "./handlers/start";
import { registerJobHandlers, registerLockedHandlers } from "./handlers/jobs";
import { registerPoliceHandlers } from "./handlers/police";
import { registerDealerHandlers } from "./handlers/dealer";
import { registerMarketHandlers, seedCatalogItems } from "./handlers/market";
import { registerMessagesHandlers } from "./handlers/messages";
import { startScheduler } from "./scheduler";

let botInstance: Bot | null = null;

export function getBot(): Bot | null {
  return botInstance;
}

export async function initBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error("TELEGRAM_BOT_TOKEN is not set — bot will not start");
    return;
  }

  try {
    const bot = new Bot(token);

    // Register all handlers
    registerStartHandlers(bot);
    registerJobHandlers(bot);
    registerLockedHandlers(bot);
    registerPoliceHandlers(bot);
    registerDealerHandlers(bot);
    registerMarketHandlers(bot);
    registerMessagesHandlers(bot);

    // Generic error handler
    bot.catch((err) => {
      logger.error({ err: err.error, update: err.ctx.update }, "Bot handler error");
    });

    botInstance = bot;

    // Seed catalog items
    try {
      await seedCatalogItems();
      logger.info("Catalog items seeded");
    } catch (err) {
      logger.error({ err }, "Failed to seed catalog items");
    }

    // Start long polling (non-blocking)
    bot.start({
      onStart: (botInfo) => {
        logger.info({ username: botInfo.username }, "Telegram bot started");
      },
      drop_pending_updates: false,
    }).catch((err) => {
      logger.error({ err }, "Bot polling error");
    });

    // Start background scheduler
    startScheduler(bot);
  } catch (err) {
    logger.error({ err }, "Failed to initialize bot");
  }
}
