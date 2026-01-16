import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "module";

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
  const branches = ["Careplus Chemist", "Wilmslow Road Pharmacy", "247 Pharmacy"];

  for (const name of branches) {
    await prisma.branch.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seeded branches ✅");
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
