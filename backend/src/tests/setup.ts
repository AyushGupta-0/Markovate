import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clean up test database
  await prisma.$executeRaw`TRUNCATE TABLE incident_events CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE incidents CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE idempotency_keys CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
