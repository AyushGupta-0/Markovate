import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/incident_alerts';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  try {
    // Clean up test database
    await prisma.$executeRaw`TRUNCATE TABLE incident_events CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE incidents CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE idempotency_keys CASCADE`;
  } catch (error) {
    console.log('Note: Database cleanup failed - tests will use Docker PostgreSQL');
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

export { prisma };
