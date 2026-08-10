import { Bot } from "grammy";
import { db } from "@workspace/db";
import {
  usersTable,
  pendingShiftsTable,
  policeDataTable,
  pendingMissionsTable,
  dealerDataTable,
} from "@workspace/db";
import { eq, and, gt, lte, desc, isNull, or, lt } from "drizzle-orm";
import {
  JOBS,
  REGULAR_JOBS,
  MISSION_INTERVAL_HOURS,
  POLICE_MISSIONS,
  HARVEST_INTERVAL_HOURS,
  DEALER_OFFER_COOLDOWN_HOURS,
  DEALER_OFFER_CHANCE,
  POLICE_BASE_SALARY,
  STATION_SALARY_BONUS,
  type JobType,
  type PoliceRank,
} from "./config";
import { logger } from "../lib/logger";

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startScheduler(bot: Bot): void {
  logger.info("Bot scheduler started");

  // Run immediately, then on interval
  runSchedulerCycle(bot).catch((err) =>
    logger.error({ err }, "Scheduler initial run error")
  );

  setInterval(() => {
    runSchedulerCycle(bot).catch((err) =>
      logger.error({ err }, "Scheduler cycle error")
    );
  }, SCHEDULER_INTERVAL_MS);
}

async function runSchedulerCycle(bot: Bot): Promise<void> {
  await Promise.all([
    sendPendingShifts(bot),
    sendPoliceMissions(bot),
    notifyHarvestReady(bot),
    checkDealerUnlockOffers(bot),
  ]);
}

// ─── Regular job shift confirmations ────────────────────────────────────────

async function sendPendingShifts(bot: Bot): Promise<void> {
  const regularJobKeys = REGULAR_JOBS.map((j) => j.key);

  // Get users with active regular jobs
  const activeWorkers = await db
    .select()
    .from(usersTable)
    .where(
      and(
        // currentJob is one of the regular jobs
        or(
          ...regularJobKeys.map((k) => eq(usersTable.currentJob, k))
        )
      )
    );

  for (const user of activeWorkers) {
    try {
      const jobKey = user.currentJob as JobType;
      const jobCfg = JOBS[jobKey];
      if (!jobCfg) continue;

      // Check for existing active (unconfirmed, not expired) shift
      const now = new Date();
      const activeShift = await db
        .select()
        .from(pendingShiftsTable)
        .where(
          and(
            eq(pendingShiftsTable.userTelegramId, user.telegramId),
            eq(pendingShiftsTable.jobType, jobKey),
            eq(pendingShiftsTable.confirmed, false),
            gt(pendingShiftsTable.expiresAt, now)
          )
        )
        .limit(1);

      if (activeShift.length > 0) continue; // already has active shift

      // Check when last shift was issued
      const lastShift = await db
        .select()
        .from(pendingShiftsTable)
        .where(
          and(
            eq(pendingShiftsTable.userTelegramId, user.telegramId),
            eq(pendingShiftsTable.jobType, jobKey)
          )
        )
        .orderBy(desc(pendingShiftsTable.issuedAt))
        .limit(1);

      if (lastShift.length > 0) {
        const lastIssued = lastShift[0]!.issuedAt;
        const nextIssueAt = new Date(
          lastIssued.getTime() + jobCfg.shiftIntervalHours * 3600 * 1000
        );
        if (now < nextIssueAt) continue; // not time yet
      }

      // Issue new shift
      const expiresAt = new Date(
        Date.now() + jobCfg.shiftExpiryHours * 3600 * 1000
      );

      const [inserted] = await db
        .insert(pendingShiftsTable)
        .values({
          userTelegramId: user.telegramId,
          jobType: jobKey,
          expiresAt,
        })
        .returning();

      if (!inserted) continue;

      const msg = await bot.api.sendMessage(
        user.telegramId,
        `⏰ <b>Смена ожидает подтверждения!</b>\n\n` +
          `${jobCfg.emoji} Работа: <b>${jobCfg.name}</b>\n` +
          `💵 Зарплата: <b>${jobCfg.salaryPerShift}$</b>\n` +
          `⚖️ Бонус: +1 к законопослушности\n\n` +
          `У тебя есть <b>${jobCfg.shiftExpiryHours} часа</b> чтобы подтвердить!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Подтвердить смену", callback_data: `confirm_shift:${inserted.id}` }],
            ],
          },
        }
      );

      // Save message id
      await db
        .update(pendingShiftsTable)
        .set({ messageId: msg.message_id })
        .where(eq(pendingShiftsTable.id, inserted.id));
    } catch (err: unknown) {
      logger.warn({ err, userId: user.telegramId }, "Failed to send shift notification");
    }
  }
}

// ─── Police missions ─────────────────────────────────────────────────────────

async function sendPoliceMissions(bot: Bot): Promise<void> {
  const officers = await db
    .select({ userId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.currentJob, "police"));

  for (const officer of officers) {
    try {
      const now = new Date();

      // Check for existing active mission
      const activeMission = await db
        .select()
        .from(pendingMissionsTable)
        .where(
          and(
            eq(pendingMissionsTable.userTelegramId, officer.userId),
            eq(pendingMissionsTable.confirmed, false),
            gt(pendingMissionsTable.expiresAt, now)
          )
        )
        .limit(1);

      if (activeMission.length > 0) continue;

      // Get police data for station level
      const [police] = await db
        .select()
        .from(policeDataTable)
        .where(eq(policeDataTable.userTelegramId, officer.userId))
        .limit(1);

      if (!police) continue;

      const intervalHours = MISSION_INTERVAL_HOURS[police.stationLevel] ?? 6;

      // Check last mission timing
      const lastMission = await db
        .select()
        .from(pendingMissionsTable)
        .where(eq(pendingMissionsTable.userTelegramId, officer.userId))
        .orderBy(desc(pendingMissionsTable.issuedAt))
        .limit(1);

      if (lastMission.length > 0) {
        const nextAt = new Date(
          lastMission[0]!.issuedAt.getTime() + intervalHours * 3600 * 1000
        );
        if (now < nextAt) continue;
      }

      // Pick random mission
      const missionCfg =
        POLICE_MISSIONS[Math.floor(Math.random() * POLICE_MISSIONS.length)]!;

      // Scale reward by rank
      const rank = police.rank as PoliceRank;
      const rankIdx = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"].indexOf(rank);
      const rankMultiplier = 1 + rankIdx * 0.25;
      const reward = Math.floor(missionCfg.baseReward * rankMultiplier);

      const expiresAt = new Date(Date.now() + 4 * 3600 * 1000); // 4 hours

      const [inserted] = await db
        .insert(pendingMissionsTable)
        .values({
          userTelegramId: officer.userId,
          missionType: missionCfg.name,
          expiresAt,
          rewardAmount: reward,
          bonusReputation: missionCfg.reputationBonus,
        })
        .returning();

      if (!inserted) continue;

      const msg = await bot.api.sendMessage(
        officer.userId,
        `🚨 <b>СПЕЦОПЕРАЦИЯ</b>\n\n` +
          `🎯 <b>${missionCfg.name}</b>\n` +
          `<i>${missionCfg.description}</i>\n\n` +
          `💵 Вознаграждение: <b>${reward.toLocaleString("ru")}$</b>\n` +
          `⚖️ Репутация: +${missionCfg.reputationBonus}\n\n` +
          `У тебя <b>4 часа</b> на выполнение!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `✅ Выполнить операцию (+${reward.toLocaleString("ru")}$)`,
                  callback_data: `confirm_mission:${inserted.id}`,
                },
              ],
            ],
          },
        }
      );

      await db
        .update(pendingMissionsTable)
        .set({ messageId: msg.message_id })
        .where(eq(pendingMissionsTable.id, inserted.id));
    } catch (err: unknown) {
      logger.warn({ err, userId: officer.userId }, "Failed to send mission notification");
    }
  }
}

// ─── Dealer harvest notifications ────────────────────────────────────────────

async function notifyHarvestReady(bot: Bot): Promise<void> {
  const dealers = await db
    .select({ userId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.currentJob, "dealer"));

  const harvestCooldownMs = HARVEST_INTERVAL_HOURS * 3600 * 1000;

  for (const dealer of dealers) {
    try {
      const [data] = await db
        .select()
        .from(dealerDataTable)
        .where(eq(dealerDataTable.userTelegramId, dealer.userId))
        .limit(1);

      if (!data) continue;

      // Check if harvest is ready and we haven't already notified
      const now = Date.now();
      const lastHarvestMs = data.lastHarvest?.getTime() ?? 0;

      // Harvest is ready if enough time has passed
      if (now - lastHarvestMs < harvestCooldownMs) continue;

      // Only send a notification once per ready cycle
      // We track this by checking if we've sent a notification since last harvest
      // Simple heuristic: only notify if lastHarvest was set to exactly the cooldown boundary recently
      // For simplicity, send a nudge once per cycle by comparing to a 10-minute window
      const cycleDuration = harvestCooldownMs;
      const timeSinceLastHarvest = now - lastHarvestMs;
      const cyclePosition = timeSinceLastHarvest % cycleDuration;

      // Notify once per cycle, near the start of the ready window (within first 10 minutes)
      const notifyWindowMs = SCHEDULER_INTERVAL_MS + 60000;
      if (cyclePosition > notifyWindowMs && data.lastHarvest !== null) continue;

      await bot.api.sendMessage(
        dealer.userId,
        `🌿 <b>Урожай готов!</b>\n\nТвоя ферма уровня ${data.farmLevel} принесла плоды.\nОткрой раздел «Работы» → «Барыга» чтобы собрать урожай.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "🌾 К ферме", callback_data: "dealer_menu" }]],
          },
        }
      );
    } catch (err: unknown) {
      logger.warn({ err, userId: dealer.userId }, "Failed to send harvest notification");
    }
  }
}

// ─── Dealer unlock offers ─────────────────────────────────────────────────────

async function checkDealerUnlockOffers(bot: Bot): Promise<void> {
  const cooldownMs = DEALER_OFFER_COOLDOWN_HOURS * 3600 * 1000;
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownMs);

  // Users without dealer_unlocked, where last check was > 24h ago (or never)
  const candidates = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.dealerUnlocked, false),
        or(
          isNull(usersTable.lastDealerOfferCheck),
          lt(usersTable.lastDealerOfferCheck, cutoff)
        )
      )
    );

  for (const user of candidates) {
    try {
      // Update last check time
      await db
        .update(usersTable)
        .set({ lastDealerOfferCheck: now })
        .where(eq(usersTable.telegramId, user.telegramId));

      // Roll 1.5% chance
      if (Math.random() >= DEALER_OFFER_CHANCE) continue;

      // Unlock dealer
      await db
        .update(usersTable)
        .set({ dealerUnlocked: true })
        .where(eq(usersTable.telegramId, user.telegramId));

      await bot.api.sendMessage(
        user.telegramId,
        `🌿 <b>Особое предложение</b>\n\n` +
          `К тебе обратился незнакомец с предложением войти в теневой бизнес...\n\n` +
          `Профессия <b>Барыга (SSS)</b> теперь доступна в разделе «Доступные работы»!\n\n` +
          `⚠️ Риски: полицейские могут проводить рейды против тебя.\n` +
          `💰 Потенциал: самый высокий доход в игре.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💼 Посмотреть работы", callback_data: "jobs_menu" }],
            ],
          },
        }
      );

      logger.info({ userId: user.telegramId }, "Dealer profession unlocked for user");
    } catch (err: unknown) {
      logger.warn({ err, userId: user.telegramId }, "Failed to send dealer offer");
    }
  }
}
