import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "module";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

/* ------------------ AUTH HELPERS ------------------ */
function signToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function readToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { role, branchId, username, iat, exp }
    next();
  } catch (_e) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, message: "Admin only" });
  }
  next();
}

/**
 * Admin: can access any branchId.
 * Branch user: must provide branchId and it must match their token branchId.
 * Returns normalized branchId as string.
 */
function assertBranchAccess(req) {
  const user = req.user;

  const branchId =
    req.query.branchId ??
    req.body.branchId ??
    req.params.branchId ??
    null;

  if (user?.role === "admin") {
    return { ok: true, branchId: branchId ? String(branchId) : null };
  }

  if (user?.role === "branch") {
    if (!branchId) return { ok: false, status: 400, message: "branchId required" };
    if (String(branchId) !== String(user.branchId)) {
      return { ok: false, status: 403, message: "Forbidden (wrong branch)" };
    }
    return { ok: true, branchId: String(branchId) };
  }

  return { ok: false, status: 403, message: "Forbidden" };
}

/* ------------------ DEBUG ------------------ */
app.get("/__routes", (_req, res) => {
  try {
    const stack = app?.router?.stack || app?._router?.stack || [];
    const routes = [];

    for (const m of stack) {
      if (m?.route?.path) {
        const methods = Object.keys(m.route.methods || {})
          .map((k) => k.toUpperCase())
          .join(",");
        routes.push(`${methods} ${m.route.path}`);
      }
    }

    res.json(routes);
  } catch (e) {
    console.error("ROUTES_ERROR:", e);
    res.status(500).json({ error: "Failed to list routes" });
  }
});

/* ------------------ HEALTH ------------------ */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/* ------------------ AUTH ------------------ */
/**
 * POST /auth/login
 * Body: { username, password }
 * Returns: { ok, token, role, branchId, username }
 */
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Username and password required." });
    }

    const user = await prisma.user.findUnique({
      where: { username: String(username).trim() },
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) {
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }

    const token = signToken({
      role: user.role,
      branchId: user.branchId,
      username: user.username,
    });

    return res.json({
      ok: true,
      token,
      role: user.role,
      branchId: user.branchId,
      username: user.username,
    });
  } catch (e) {
    console.error("LOGIN_ERROR:", e);
    return res.status(500).json({ ok: false, message: "Login failed." });
  }
});

/**
 * GET /auth/me
 * Header: Authorization: Bearer <token>
 * Returns token payload if valid. (Useful for debugging)
 */
app.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* ------------------ BRANCHES ------------------ */
app.get("/branches", async (_req, res) => {
  try {
    const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
    res.json(branches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load branches" });
  }
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

// Admin: can fetch any branch employees
// Branch: can fetch only their own branch employees
app.get("/employees", requireAuth, async (req, res) => {
  try {
    const access = assertBranchAccess(req);
    if (!access.ok) return res.status(access.status).json({ ok: false, message: access.message });
    const branchId = access.branchId;

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load employees" });
  }
});

/* ------------------ EMPLOYEE CREATE / UPDATE / DELETE ------------------ */
// Admin only

app.post("/employees", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { branchId, name, allowedHolidayHoursPerYear, weeklyHours } = req.body;

    if (!branchId) return res.status(400).json({ error: "branchId required" });
    if (!name?.trim()) return res.status(400).json({ error: "name required" });

    const parts = String(name).trim().split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" "); // can be empty

    const emp = await prisma.employee.create({
      data: {
        branchId: String(branchId),
        firstName,
        lastName,
        isActive: true,
        allowedHolidayHoursPerYear: Number(allowedHolidayHoursPerYear) || 0,
      },
    });

    const wh = weeklyHours || {};
    const rows = [
      { weekday: 1, hours: Number(wh.mon) || 0 },
      { weekday: 2, hours: Number(wh.tue) || 0 },
      { weekday: 3, hours: Number(wh.wed) || 0 },
      { weekday: 4, hours: Number(wh.thu) || 0 },
      { weekday: 5, hours: Number(wh.fri) || 0 },
      { weekday: 6, hours: Number(wh.sat) || 0 },
      { weekday: 7, hours: Number(wh.sun) || 0 },
    ];

    await prisma.employeeWorkSchedule.createMany({
      data: rows.map((r) => ({
        employeeId: emp.id,
        weekday: r.weekday,
        hours: r.hours,
      })),
    });

    res.json({ ok: true, id: emp.id });
  } catch (err) {
    console.error("POST /employees error:", err);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

app.put("/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, allowedHolidayHoursPerYear, weeklyHours } = req.body;

    if (!id) return res.status(400).json({ error: "id required" });
    if (!name?.trim()) return res.status(400).json({ error: "name required" });

    const parts = String(name).trim().split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");

    await prisma.employee.update({
      where: { id: String(id) },
      data: {
        firstName,
        lastName,
        allowedHolidayHoursPerYear: Number(allowedHolidayHoursPerYear) || 0,
      },
    });

    const wh = weeklyHours || {};
    const rows = [
      { weekday: 1, hours: Number(wh.mon) || 0 },
      { weekday: 2, hours: Number(wh.tue) || 0 },
      { weekday: 3, hours: Number(wh.wed) || 0 },
      { weekday: 4, hours: Number(wh.thu) || 0 },
      { weekday: 5, hours: Number(wh.fri) || 0 },
      { weekday: 6, hours: Number(wh.sat) || 0 },
      { weekday: 7, hours: Number(wh.sun) || 0 },
    ];

    await prisma.employeeWorkSchedule.deleteMany({
      where: { employeeId: String(id) },
    });

    await prisma.employeeWorkSchedule.createMany({
      data: rows.map((r) => ({
        employeeId: String(id),
        weekday: r.weekday,
        hours: r.hours,
      })),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /employees/:id error:", err);
    res.status(500).json({
      error: "Failed to update employee",
      details: err?.message || String(err),
      code: err?.code,
    });
  }
});

app.delete("/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id required" });

    await prisma.employeeWorkSchedule.deleteMany({
      where: { employeeId: String(id) },
    });
    await prisma.employee.delete({ where: { id: String(id) } });

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /employees/:id error:", err);
    res.status(500).json({
      error: "Failed to delete employee",
      details: err?.message || String(err),
      code: err?.code,
    });
  }
});

/* ------------------ LEAVES (RANGE BASED: 1 ROW PER LEAVE) ------------------ */

// Admin: can fetch any branch leaves
// Branch: can fetch only their own branch leaves
app.get("/leaves", requireAuth, async (req, res) => {
  try {
    const access = assertBranchAccess(req);
    if (!access.ok) return res.status(access.status).json({ ok: false, message: access.message });
    const branchId = access.branchId;

    const { from, to } = req.query;
    if (!from || !to)
      return res.status(400).json({ error: "from and to required (YYYY-MM-DD)" });

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid from/to date" });
    }

    const rows = await prisma.leaveEntry.findMany({
      where: {
        branchId: String(branchId),
        AND: [{ startDate: { lte: toDate } }, { endDate: { gte: fromDate } }],
      },
      orderBy: [{ startDate: "desc" }],
    });

    res.json(
      rows.map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        hours: Number(l.hours) || 0,
        type: l.type,
        comment: l.comment || "",
      }))
    );
  } catch (err) {
    console.error("GET /leaves error:", err);
    res.status(500).json({ error: "Failed to load leaves" });
  }
});

app.post("/leaves", requireAuth, async (req, res) => {
  try {
    const access = assertBranchAccess(req);
    if (!access.ok) return res.status(access.status).json({ ok: false, message: access.message });
    const branchId = access.branchId;

    const { employeeId, startDate, endDate, hours, type, comment } = req.body;

    if (!employeeId || !startDate || !endDate || !type) {
      return res.status(400).json({
        error: "branchId, employeeId, startDate, endDate and type are required",
      });
    }

    const s = new Date(String(startDate));
    const e = new Date(String(endDate));
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ error: "Invalid startDate/endDate" });
    }

    const start = s <= e ? s : e;
    const end = s <= e ? e : s;

    const created = await prisma.leaveEntry.create({
      data: {
        branchId: String(branchId),
        employeeId: String(employeeId),
        startDate: start,
        endDate: end,
        hours: Number(hours) || 0,
        type: String(type),
        comment: comment?.trim() ? String(comment).trim() : null,
      },
    });

    res.json({
      ok: true,
      leave: {
        id: created.id,
        employeeId: created.employeeId,
        startDate: created.startDate.toISOString().slice(0, 10),
        endDate: created.endDate.toISOString().slice(0, 10),
        hours: Number(created.hours) || 0,
        type: created.type,
        comment: created.comment || "",
      },
    });
  } catch (err) {
    console.error("POST /leaves error:", err);
    res.status(500).json({
      error: "Failed to create leave",
      details: err?.message || String(err),
      code: err?.code,
    });
  }
});

app.delete("/leaves", requireAuth, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });

    // Validate branch ownership for branch users before delete
    const leave = await prisma.leaveEntry.findUnique({ where: { id: String(id) } });
    if (!leave) return res.json({ ok: true });

    if (req.user.role === "branch" && String(leave.branchId) !== String(req.user.branchId)) {
      return res.status(403).json({ ok: false, message: "Forbidden (wrong branch)" });
    }

    await prisma.leaveEntry.delete({ where: { id: String(id) } });
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === "P2025") return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: "Failed to delete leave" });
  }
});

/* ------------------ PUBLIC HOLIDAYS ------------------ */

// Any logged-in user can view public holidays
app.get("/public-holidays", requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load public holidays" });
  }
});

// Admin only can create/delete public holidays
app.post("/public-holidays", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { date, name } = req.body;
    const region = req.body.region || "DEFAULT";

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

app.delete("/public-holidays", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const region = req.query.region || "DEFAULT";

    if (!date) return res.status(400).json({ error: "date required" });

    await prisma.publicHoliday.delete({
      where: {
        date_region: {
          date: new Date(date),
          region: region,
        },
      },
    });

    res.json({ ok: true });
  } catch (err) {
    if (err?.code === "P2025") return res.json({ ok: true });
    console.error(err);
    res.status(500).json({ error: "Failed to delete public holiday" });
  }
});

/* ------------------ START ------------------ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
