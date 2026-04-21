import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

let dbUrl = '';
try {
  const dotenvPath = path.join(process.cwd(), ".env");
  const dotenvContent = fs.readFileSync(dotenvPath, "utf8");
  dotenvContent.split("\n").forEach(line => {
    if (line.startsWith("DATABASE_URL=")) {
      dbUrl = line.replace("DATABASE_URL=", "").trim().replace(/^"|"$/g, "");
    }
  });
} catch (e) {
  console.error("Error reading .env:", e);
}

// Singleton pattern for Prisma Client with health check for new models
const prismaClientSingleton = () => {
  return new PrismaClient(
    dbUrl ? { datasources: { db: { url: dbUrl } } } : {}
  );
}

declare const globalThis: {
  prismaGlobal: PrismaClient | undefined;
} & typeof global;

// Standard singleton pattern for Prisma Client to prevent multiple instances in development
const getPrisma = () => {
  if (process.env.NODE_ENV === "production") {
    return prismaClientSingleton();
  }
  
  if (!globalThis.prismaGlobal) {
    console.log('[Prisma] Creating fresh instance');
    globalThis.prismaGlobal = prismaClientSingleton();
  }
  
  return globalThis.prismaGlobal;
}

const prisma = getPrisma();

export default prisma;
