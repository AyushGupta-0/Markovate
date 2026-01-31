import crypto from 'crypto';
import prisma from '../config/database';
import { config } from '../config';

export function generateRequestHash(payload: any): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export async function checkIdempotencyKey(key: string, requestHash: string) {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key },
  });

  if (!existing) {
    return { exists: false, conflict: false };
  }

  // Check if key has expired
  if (existing.expiresAt < new Date()) {
    await prisma.idempotencyKey.delete({ where: { key } });
    return { exists: false, conflict: false };
  }

  // Check for hash mismatch
  if (existing.requestHash !== requestHash) {
    return { exists: true, conflict: true };
  }

  return {
    exists: true,
    conflict: false,
    incidentId: existing.responseIncidentId,
  };
}

export async function storeIdempotencyKey(
  key: string,
  requestHash: string,
  incidentId: string
) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + config.idempotency.expiryHours);

  await prisma.idempotencyKey.create({
    data: {
      key,
      requestHash,
      responseIncidentId: incidentId,
      expiresAt,
    },
  });
}
