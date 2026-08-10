# Green Eco Bot

Telegram game bot with an economy and jobs system. Users earn virtual currency through jobs, unlock special professions, and spend money in a marketplace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Telegram bot (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Required secret: `TELEGRAM_BOT_TOKEN` — bot token from @BotFather

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Telegram bot: Grammy v1.x (long polling in dev)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Build: esbuild (grammy is externalized — not bundled)

## Where things live

- `artifacts/api-server/src/bot/` — all bot logic
  - `index.ts` — bot init, handler registration, catalog seeding
  - `scheduler.ts` — background job (5-min interval): sends shifts, missions, harvest notifs, dealer offers
  - `config.ts` — all game constants (salaries, ranks, intervals, costs)
  - `substances.ts` — full drug catalog (F–SSS classes)
  - `handlers/start.ts` — /start, main menu, profile
  - `handlers/jobs.ts` — job selection, shift confirmation callbacks
  - `handlers/police.ts` — police rank, mission confirmation, station upgrade
  - `handlers/dealer.ts` — farm, harvest, inventory, quick sell
  - `handlers/market.ts` — bot network catalog, item purchases; `seedCatalogItems()`
  - `handlers/messages.ts` — messages inbox (pending shifts/missions)
- `lib/db/src/schema/` — DB schema
  - `users.ts` — main user table (balance, lawfulness, job, unlock flags)
  - `jobs.ts` — pending_shifts table
  - `police.ts` — police_data + pending_missions tables
  - `dealer.ts` — dealer_data + dealer_inventory tables
  - `market.ts` — market_listings + catalog_items + user_catalog_items tables

## Architecture decisions

- Bot runs inside the API server process (single pnpm workspace package) — no separate bot service needed
- Grammy is externalized in esbuild (not bundled) because it has a native `platform.node` module that esbuild can't resolve
- Scheduler uses `setInterval` (5 min) — checks all active users and sends prompts/notifications
- Dealer unlock uses 1.5% daily chance; police unlock triggers at 30 lawfulness
- Catalog items for Green RP and Green Casino are seeded on bot startup if table is empty

## Product

- `/start` → welcome + main menu (💼 Работы | 📩 Сообщения | 🛒 Маркет | 👤 Профиль)
- **5 regular jobs** (Office, Loader, Garbage, Cleaner, Cashier): shift confirmations sent every 3–6h, +salary +1 lawfulness per confirm
- **Police** (unlocked at 30 lawfulness): 8 rank tiers (F→SSS), random missions, upgradeable station
- **Dealer** (unlocked at 1.5% daily chance): farm harvests every 6h, full drug catalog (F–SSS), quick sell or market listing, hireable workers
- **Marketplace**: Green RP and Green Casino item catalogs, purchases bound to Telegram ID

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- grammy must stay in esbuild `external` list — it loads `platform.node` dynamically at runtime
- Run `pnpm --filter @workspace/db run push` after any schema changes
- Scheduler sends notifications only when user has no active (unconfirmed, non-expired) pending shift/mission
