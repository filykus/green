import {
  pgTable,
  serial,
  bigint,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const pendingShiftsTable = pgTable("pending_shifts", {
  id: serial("id").primaryKey(),
  userTelegramId: bigint("user_telegram_id", { mode: "number" }).notNull(),
  jobType: text("job_type").notNull(),
  messageId: integer("message_id"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmedAt: timestamp("confirmed_at"),
});

export type PendingShift = typeof pendingShiftsTable.$inferSelect;
