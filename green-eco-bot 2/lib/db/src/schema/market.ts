import {
  pgTable,
  serial,
  bigint,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const marketListingsTable = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  sellerTelegramId: bigint("seller_telegram_id", { mode: "number" }).notNull(),
  substanceKey: text("substance_key").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  listedAt: timestamp("listed_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

export const catalogItemsTable = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  botNetwork: text("bot_network").notNull(), // 'green_rp' | 'green_casino'
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
  emoji: text("emoji").notNull().default("🎁"),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const userCatalogItemsTable = pgTable("user_catalog_items", {
  id: serial("id").primaryKey(),
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).notNull(),
  itemId: integer("item_id").notNull(),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

export type MarketListing = typeof marketListingsTable.$inferSelect;
export type CatalogItem = typeof catalogItemsTable.$inferSelect;
export type UserCatalogItem = typeof userCatalogItemsTable.$inferSelect;
