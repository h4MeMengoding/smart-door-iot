import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Strip sslmode dari URL karena pg driver v9 memperlakukan sslmode=require
// sebagai verify-full yang menolak self-signed cert Aiven.
// SSL ditangani manual via Pool config.
function getCleanConnectionString() {
  const url = process.env.DATABASE_URL!;
  return url.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: getCleanConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
