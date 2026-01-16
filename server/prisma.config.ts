import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },

  // Use DIRECT (no-pooler) for migrate when available
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
