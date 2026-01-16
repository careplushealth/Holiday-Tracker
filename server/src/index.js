import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma");

/* ------------------ DB ------------------ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

/* ------------------ APP ------------------ */
const app = express();
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/* ------------------ DEBUG ------------------ */
app.get("/__routes", (_req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route) {
      const methods = Object.keys(m.route.methods)
        .map((k) => k.toUpperCase())
        .join(",");
      routes.push(`${methods} ${m.route.path}`);
    }
  });
  res.json(routes);
});

/* ------------------ HEALTH ------------------ */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/* ------------------ BRANCHES ------------------ */
app.get("/branches", async (_req, res) => {
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
  res.json(branches);
});

/* ------------------ EMPLOYEES ------------------ */
function scheduleRowsToWeeklyHours(rows = []) {
  const map = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
  for (const r of rows) {
    const h = Number(r.hours) || 0;
    if (r.weekday === 1) map.mon = h;
    if (r.weekday === 2) map.tue = h;
    if (r.weekday === 3) map.wed = h;
    if (r.weekday === 4) map.thu = h;
    if (r.weekday === 5) map.fri = h;
    if (r.weekday === 6) map.sat = h;
    if (r.weekday === 7) map.sun = h;
  }
  return map;
}

app.get("/employees", async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "branchId required" });

  const employees = await prisma.employee.findMany({
    where: { branchId: String(branchId), isActive: true },
    include: { schedule: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  res.json(
    employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      allowedHolidayHoursPerYear: Number(e.allowedHolidayHoursPerYear || 0),
      weeklyHours: scheduleRowsToWeeklyHours(e.schedule),
    }))
  );
});

/* ------------------ PUBLIC HOLIDAYS ------------------ */

// GET by year
app.post("/public-holidays", async (req, res) => {
  try {
    const { date, name } = req.body;
    const region = req.body.region || "DEFAULT";  // <-- Force default if null/undefined/empty
    
    if (!date || !name?.trim()) {
      return res.status(400).json({ error: "date and name required" });
    }

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }

    const holiday = await prisma.publicHoliday.upsert({
      where: {
        date_region: {
          date: d,
          region: region,
        },
      },
      update: { name: name.trim() },
      create: { date: d, name: name.trim(), region: region },
    });

    res.json({
      ok: true,
      holiday: {
        date: holiday.date.toISOString().slice(0, 10),
        name: holiday.name,
        region: holiday.region,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save public holiday" });
  }
});

// GEt (upsert)
app.get("/public-holidays", async (req, res) => {
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: "year required" });

  const from = new Date(`${year}-01-01`);
  const to = new Date(`${year}-12-31`);

  const rows = await prisma.publicHoliday.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  res.json(
    rows.map((h) => ({
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
    }))
  );
});

// DELETE
app.delete("/public-holidays", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date required" });

    await prisma.publicHoliday.delete({ where: { date: new Date(date) } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "P2025") return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: "Failed to delete" });
  }
});


// ✅ Leaves for a branch in a date range (single-day rows)
app.get("/leaves", async (req, res) => {
  const { branchId, from, to } = req.query;
  if (!branchId) return res.status(400).json({ error: "branchId required" });
  if (!from || !to)
    return res.status(400).json({ error: "from and to required (YYYY-MM-DD)" });

  const leaves = await prisma.leaveEntry.findMany({
    where: {
      branchId: String(branchId),
      date: { gte: new Date(String(from)), lte: new Date(String(to)) },
    },
    orderBy: [{ date: "asc" }],
  });

  res.json(
    leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      date: l.date.toISOString().slice(0, 10),
      hours: Number(l.hours) || 0,
      type: l.type,
      comment: l.notes || "",
    }))
  );
});

// ✅ Bulk create leaves (one row per day)
app.post("/leaves/bulk", async (req, res) => {
  console.log("POST /leaves/bulk body =", req.body);

  const { branchId, items } = req.body;
  if (!branchId) return res.status(400).json({ error: "branchId required" });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "items[] required" });

  await prisma.leaveEntry.createMany({
    data: items.map((it) => ({
      branchId: String(branchId),
      employeeId: it.employeeId,
      date: new Date(it.date), // YYYY-MM-DD
      hours: it.hours,
      type: it.type,
      notes: it.comment || null,
      status: "APPROVED",
    })),
  });

  res.json({ ok: true, created: items.length });
});

/* ------------------ START ------------------ */
app.listen(4000, () => {
  console.log("✅ API running on http://localhost:4000");
});
    