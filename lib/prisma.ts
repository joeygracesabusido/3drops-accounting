import { PrismaClient } from "@prisma/client";

// Singleton pattern for Prisma Client with health check for new models
const prismaClientSingleton = () => {
  return new PrismaClient()
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
