import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Strip sslmode & channel_binding dari URL karena pg driver v9 memperlakukan
// sslmode=require sebagai verify-full yang menolak self-signed cert.
// SSL ditangani manual via Pool config.
function getCleanConnectionString() {
  const raw = process.env.DATABASE_URL!;
  const url = new URL(raw);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  return url.toString();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: getCleanConnectionString(),
    ssl: { rejectUnauthorized: false },
    max: 5,                      // Limit connections per serverless instance
    idleTimeoutMillis: 30_000,   // Close idle connections after 30s
    connectionTimeoutMillis: 5_000, // Fail fast if DB unreachable
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
