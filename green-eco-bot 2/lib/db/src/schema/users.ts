import {
  pgTable,
  bigint,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  username: text("username"),
  firstName: text("first_name").notNull().default(""),
  balance: integer("balance").notNull().default(0),
  lawfulness: integer("lawfulness").notNull().default(0),
  currentJob: text("current_job"), // 'office'|'loader'|'garbage'|'cleaner'|'cashier'|'police'|'dealer'|null
  dealerUnlocked: boolean("dealer_unlocked").notNull().default(false),
  policeUnlocked: boolean("police_unlocked").notNull().default(false),
  lastDealerOfferCheck: timestamp("last_dealer_offer_check"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
