import {
  pgTable,
  serial,
  bigint,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const dealerDataTable = pgTable("dealer_data", {
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).primaryKey(),
  farmLevel: integer("farm_level").notNull().default(1),
  lastHarvest: timestamp("last_harvest"),
  workersCount: integer("workers_count").notNull().default(0),
  // class threshold below which to auto-sell: 'A' = auto-sell F,E,D,C,B,A; null = manual only
  autoSellBelowClass: text("auto_sell_below_class"),
});

export const dealerInventoryTable = pgTable("dealer_inventory", {
  id: serial("id").primaryKey(),
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).notNull(),
  substanceKey: text("substance_key").notNull(),
  quantity: integer("quantity").notNull().default(0),
});

export type DealerData = typeof dealerDataTable.$inferSelect;
export type DealerInventory = typeof dealerInventoryTable.$inferSelect;
