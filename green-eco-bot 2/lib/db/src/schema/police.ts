import {
  pgTable,
  serial,
  bigint,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const policeDataTable = pgTable("police_data", {
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).primaryKey(),
  rank: text("rank").notNull().default("F"), // F|E|D|C|B|A|S|SS|SSS
  missionsCompleted: integer("missions_completed").notNull().default(0),
  totalMissions: integer("total_missions").notNull().default(0),
  stationLevel: integer("station_level").notNull().default(1),
});

export const pendingMissionsTable = pgTable("pending_missions", {
  id: serial("id").primaryKey(),
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).notNull(),
  missionType: text("mission_type").notNull(),
  messageId: integer("message_id"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  bonusReputation: integer("bonus_reputation").notNull().default(0),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmedAt: timestamp("confirmed_at"),
});

export type PoliceData = typeof policeDataTable.$inferSelect;
export type PendingMission = typeof pendingMissionsTable.$inferSelect;
