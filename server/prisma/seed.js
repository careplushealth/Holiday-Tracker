import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "module";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma");

// Use pooled DATABASE_URL for runtime connections (fine with pg Pool)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon needs SSL
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1) Seed branches (unchanged behavior)
  const branches = ["Careplus Chemist", "Wilmslow Road Pharmacy", "247 Pharmacy"];

  for (const name of branches) {
    await prisma.branch.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Fetch branches so we can map names -> ids (avoids hardcoding UUIDs)
  const seededBranches = await prisma.branch.findMany({
    where: { name: { in: branches } },
    select: { id: true, name: true },
  });

  const branchIdByName = Object.fromEntries(
    seededBranches.map((b) => [b.name, b.id])
  );

  // 2) Seed users (admin + branch logins)
  const SALT_ROUNDS = 10;

  // Admin user
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      role: "admin",
      branchId: null,
    },
    create: {
      username: "admin",
      password: await bcrypt.hash("Mehraan@123", SALT_ROUNDS),
      role: "admin",
      branchId: null,
    },
  });

  // Branch users mapped by branch name (so it works even if branch IDs change)
  const branchUsers = [
    {
      branchName: "Careplus Chemist",
      username: "careplus",
      password: "Careplus@123",
    },
    {
      branchName: "Wilmslow Road Pharmacy",
      username: "wilmslow",
      password: "Wilmslow@123",
    },
    {
      branchName: "247 Pharmacy",
      username: "pharmacy247",
      password: "Pharmacy247@123",
    },
  ];

  for (const u of branchUsers) {
    const branchId = branchIdByName[u.branchName];
    if (!branchId) {
      throw new Error(
        `Branch not found for user seed: "${u.branchName}". Did branches seed correctly?`
      );
    }

    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        role: "branch",
        branchId,
      },
      create: {
        username: u.username,
        password: await bcrypt.hash(u.password, SALT_ROUNDS),
        role: "branch",
        branchId,
      },
    });
  }

  console.log("Seeded branches ✅");
  console.log("Seeded users ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
