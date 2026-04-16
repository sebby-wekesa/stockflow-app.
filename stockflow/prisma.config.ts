import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  migrations: {
    // This is the missing piece that Prisma is asking for
    seed: 'npx tsx prisma/seed.ts',
  },
});