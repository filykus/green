import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  policeDataTable,
  dealerDataTable,
  pendingShiftsTable,
  pendingMissionsTable,
  marketListingsTable,
  catalogItemsTable,
  userCatalogItemsTable,
  dealerInventoryTable,
} from "@workspace/db";
import {
  UpdateAdminUserBody,
  GetAdminUserParams,
  UpdateAdminUserParams,
  UpdateCatalogItemParams,
  UpdateCatalogItemBody,
  DeleteCatalogItemParams,
  DeactivateMarketListingParams,
  CreateCatalogItemBody,
} from "@workspace/api-zod";
import { eq, sql, desc, like, and, isNotNull, or } from "drizzle-orm";
import { SUBSTANCES } from "../bot/substances";

const router = Router();

// ─── Dashboard stats ─────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res) => {
  try {
    const [
      totalUsersResult,
      activeWorkersResult,
      balanceResult,
      lawfulnessResult,
      jobBreakdownResult,
      topEarnersResult,
      unlockedPoliceResult,
      unlockedDealersResult,
      pendingShiftsResult,
      pendingMissionsResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(isNotNull(usersTable.currentJob)),
      db.select({ total: sql<number>`coalesce(sum(balance),0)::int` }).from(usersTable),
      db.select({ total: sql<number>`coalesce(sum(lawfulness),0)::int` }).from(usersTable),
      db
        .select({ job: usersTable.currentJob, count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(isNotNull(usersTable.currentJob))
        .groupBy(usersTable.currentJob),
      db
        .select({
          telegramId: usersTable.telegramId,
          username: usersTable.username,
          firstName: usersTable.firstName,
          balance: usersTable.balance,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.balance))
        .limit(5),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.policeUnlocked, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.dealerUnlocked, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pendingShiftsTable)
        .where(eq(pendingShiftsTable.confirmed, false)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pendingMissionsTable)
        .where(eq(pendingMissionsTable.confirmed, false)),
    ]);

    res.json({
      totalUsers: totalUsersResult[0]?.count ?? 0,
      activeWorkers: activeWorkersResult[0]?.count ?? 0,
      totalBalance: balanceResult[0]?.total ?? 0,
      totalLawfulness: lawfulnessResult[0]?.total ?? 0,
      jobBreakdown: jobBreakdownResult.map((r) => ({ job: r.job ?? "", count: r.count })),
      topEarners: topEarnersResult,
      unlockedPolice: unlockedPoliceResult[0]?.count ?? 0,
      unlockedDealers: unlockedDealersResult[0]?.count ?? 0,
      pendingShifts: pendingShiftsResult[0]?.count ?? 0,
      pendingMissions: pendingMissionsResult[0]?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── List users ───────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const job = req.query.job as string | undefined;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(usersTable.username, `%${search}%`),
          like(usersTable.firstName, `%${search}%`)
        )
      );
    }
    if (job) {
      conditions.push(eq(usersTable.currentJob, job));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [users, totalResult] = await Promise.all([
      db
        .select()
        .from(usersTable)
        .where(whereClause)
        .orderBy(desc(usersTable.balance))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(whereClause),
    ]);

    res.json({
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      total: totalResult[0]?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list users" });
  }
});

// ─── Get single user ──────────────────────────────────────────────────────────
router.get("/admin/users/:telegramId", async (req, res) => {
  try {
    const { telegramId } = GetAdminUserParams.parse({ telegramId: Number(req.params.telegramId) });

    const [user, policeData, dealerData, inventoryRows, purchasedItems] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1),
      db.select().from(policeDataTable).where(eq(policeDataTable.userTelegramId, telegramId)).limit(1),
      db.select().from(dealerDataTable).where(eq(dealerDataTable.userTelegramId, telegramId)).limit(1),
      db.select().from(dealerInventoryTable).where(eq(dealerInventoryTable.userTelegramId, telegramId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userCatalogItemsTable)
        .where(eq(userCatalogItemsTable.userTelegramId, telegramId)),
    ]);

    if (!user[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    // Compute inventory value from substance prices
    let inventoryValue = 0;
    for (const row of inventoryRows) {
      const substance = SUBSTANCES.find((s) => s.key === row.substanceKey);
      if (substance) inventoryValue += substance.basePrice * row.quantity;
    }

    const pd = policeData[0];
    const dd = dealerData[0];

    res.json({
      user: {
        ...user[0],
        createdAt: user[0].createdAt?.toISOString() ?? new Date().toISOString(),
      },
      policeData: {
        rank: pd?.rank ?? null,
        missionsCompleted: pd?.missionsCompleted ?? 0,
        totalMissions: pd?.totalMissions ?? 0,
        stationLevel: pd?.stationLevel ?? 0,
      },
      dealerData: {
        farmLevel: dd?.farmLevel ?? 0,
        workersCount: dd?.workersCount ?? 0,
        lastHarvest: dd?.lastHarvest?.toISOString() ?? null,
      },
      inventoryValue,
      purchasedItems: purchasedItems[0]?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ─── Update user ──────────────────────────────────────────────────────────────
router.patch("/admin/users/:telegramId", async (req, res) => {
  try {
    const { telegramId } = UpdateAdminUserParams.parse({ telegramId: Number(req.params.telegramId) });
    const body = UpdateAdminUserBody.parse(req.body);

    const updates: Partial<{ balance: number; lawfulness: number }> = {};
    if (body.balance !== undefined) updates.balance = body.balance;
    if (body.lawfulness !== undefined) updates.lawfulness = body.lawfulness;

    if (Object.keys(updates).length === 0) {
      const user = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
      if (!user[0]) return res.status(404).json({ error: "User not found" });
      return res.json({ ...user[0], createdAt: user[0].createdAt?.toISOString() ?? new Date().toISOString() });
    }

    const updated = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.telegramId, telegramId))
      .returning();

    if (!updated[0]) return res.status(404).json({ error: "User not found" });

    res.json({ ...updated[0], createdAt: updated[0].createdAt?.toISOString() ?? new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ─── List catalog ─────────────────────────────────────────────────────────────
router.get("/admin/catalog", async (_req, res) => {
  try {
    const items = await db.select().from(catalogItemsTable).orderBy(catalogItemsTable.botNetwork, catalogItemsTable.name);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to list catalog" });
  }
});

// ─── Create catalog item ──────────────────────────────────────────────────────
router.post("/admin/catalog", async (req, res) => {
  try {
    const body = CreateCatalogItemBody.parse(req.body);
    const [created] = await db.insert(catalogItemsTable).values(body).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create catalog item" });
  }
});

// ─── Update catalog item ──────────────────────────────────────────────────────
router.patch("/admin/catalog/:id", async (req, res) => {
  try {
    const { id } = UpdateCatalogItemParams.parse({ id: Number(req.params.id) });
    const body = UpdateCatalogItemBody.parse(req.body);

    const updates: Partial<{
      name: string;
      description: string;
      price: number;
      category: string;
      emoji: string;
      isAvailable: boolean;
    }> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = body.price;
    if (body.category !== undefined) updates.category = body.category;
    if (body.emoji !== undefined) updates.emoji = body.emoji;
    if (body.isAvailable !== undefined) updates.isAvailable = body.isAvailable;

    const [updated] = await db
      .update(catalogItemsTable)
      .set(updates)
      .where(eq(catalogItemsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Item not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update catalog item" });
  }
});

// ─── Delete catalog item ──────────────────────────────────────────────────────
router.delete("/admin/catalog/:id", async (req, res) => {
  try {
    const { id } = DeleteCatalogItemParams.parse({ id: Number(req.params.id) });
    const [deleted] = await db.delete(catalogItemsTable).where(eq(catalogItemsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete catalog item" });
  }
});

// ─── Activity feed ────────────────────────────────────────────────────────────
router.get("/admin/activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // Recent confirmed shifts + missions combined
    const [shifts, missions] = await Promise.all([
      db
        .select({
          id: pendingShiftsTable.id,
          userTelegramId: pendingShiftsTable.userTelegramId,
          jobType: pendingShiftsTable.jobType,
          confirmedAt: pendingShiftsTable.confirmedAt,
          username: usersTable.username,
          firstName: usersTable.firstName,
        })
        .from(pendingShiftsTable)
        .leftJoin(usersTable, eq(pendingShiftsTable.userTelegramId, usersTable.telegramId))
        .where(eq(pendingShiftsTable.confirmed, true))
        .orderBy(desc(pendingShiftsTable.confirmedAt))
        .limit(limit),
      db
        .select({
          id: pendingMissionsTable.id,
          userTelegramId: pendingMissionsTable.userTelegramId,
          missionType: pendingMissionsTable.missionType,
          rewardAmount: pendingMissionsTable.rewardAmount,
          confirmedAt: pendingMissionsTable.confirmedAt,
          username: usersTable.username,
          firstName: usersTable.firstName,
        })
        .from(pendingMissionsTable)
        .leftJoin(usersTable, eq(pendingMissionsTable.userTelegramId, usersTable.telegramId))
        .where(eq(pendingMissionsTable.confirmed, true))
        .orderBy(desc(pendingMissionsTable.confirmedAt))
        .limit(limit),
    ]);

    const activities = [
      ...shifts.map((s) => ({
        type: "shift",
        description: `Completed ${s.jobType} shift`,
        userId: s.userTelegramId,
        username: s.username ?? null,
        amount: null as number | null,
        happenedAt: (s.confirmedAt ?? new Date()).toISOString(),
      })),
      ...missions.map((m) => ({
        type: "mission",
        description: `Completed ${m.missionType} mission`,
        userId: m.userTelegramId,
        username: m.username ?? null,
        amount: m.rewardAmount,
        happenedAt: (m.confirmedAt ?? new Date()).toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
      .slice(0, limit);

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: "Failed to load activity" });
  }
});

// ─── Market listings ──────────────────────────────────────────────────────────
router.get("/admin/market", async (_req, res) => {
  try {
    const listings = await db
      .select({
        id: marketListingsTable.id,
        sellerTelegramId: marketListingsTable.sellerTelegramId,
        substanceKey: marketListingsTable.substanceKey,
        quantity: marketListingsTable.quantity,
        pricePerUnit: marketListingsTable.pricePerUnit,
        listedAt: marketListingsTable.listedAt,
        username: usersTable.username,
      })
      .from(marketListingsTable)
      .leftJoin(usersTable, eq(marketListingsTable.sellerTelegramId, usersTable.telegramId))
      .where(eq(marketListingsTable.isActive, true))
      .orderBy(desc(marketListingsTable.listedAt))
      .limit(200);

    res.json(
      listings.map((l) => {
        const substance = SUBSTANCES.find((s) => s.key === l.substanceKey);
        return {
          id: l.id,
          sellerTelegramId: l.sellerTelegramId,
          sellerUsername: l.username ?? null,
          substanceKey: l.substanceKey,
          substanceName: substance?.name ?? l.substanceKey,
          substanceClass: substance?.substanceClass ?? "F",
          quantity: l.quantity,
          pricePerUnit: l.pricePerUnit,
          totalValue: l.quantity * l.pricePerUnit,
          listedAt: l.listedAt.toISOString(),
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list market" });
  }
});

// ─── Deactivate market listing ────────────────────────────────────────────────
router.post("/admin/market/:id/deactivate", async (req, res) => {
  try {
    const { id } = DeactivateMarketListingParams.parse({ id: Number(req.params.id) });
    await db.update(marketListingsTable).set({ isActive: false }).where(eq(marketListingsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate listing" });
  }
});

export default router;
