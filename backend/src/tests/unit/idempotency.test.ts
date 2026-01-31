import { generateRequestHash, checkIdempotencyKey, storeIdempotencyKey } from '../../utils/idempotency';
import { prisma } from '../setup';

describe('Idempotency', () => {
  test('should generate consistent hash for same payload', () => {
    const payload1 = { title: 'Test', description: 'Desc' };
    const payload2 = { title: 'Test', description: 'Desc' };

    const hash1 = generateRequestHash(payload1);
    const hash2 = generateRequestHash(payload2);

    expect(hash1).toBe(hash2);
  });

  test('should generate different hash for different payload', () => {
    const payload1 = { title: 'Test1', description: 'Desc' };
    const payload2 = { title: 'Test2', description: 'Desc' };

    const hash1 = generateRequestHash(payload1);
    const hash2 = generateRequestHash(payload2);

    expect(hash1).not.toBe(hash2);
  });

  test('should detect non-existent key', async () => {
    const result = await checkIdempotencyKey('non-existent-key', 'hash123');
    expect(result.exists).toBe(false);
    expect(result.conflict).toBe(false);
  });

  test('should store and retrieve idempotency key', async () => {
    const key = 'test-key-' + Date.now();
    const hash = 'hash123';
    const incidentId = 'incident-123';

    await storeIdempotencyKey(key, hash, incidentId);

    const result = await checkIdempotencyKey(key, hash);
    expect(result.exists).toBe(true);
    expect(result.conflict).toBe(false);
    expect(result.incidentId).toBe(incidentId);

    // Clean up
    await prisma.idempotencyKey.delete({ where: { key } });
  });

  test('should detect hash mismatch conflict', async () => {
    const key = 'test-key-conflict-' + Date.now();
    const hash1 = 'hash123';
    const hash2 = 'hash456';
    const incidentId = 'incident-123';

    await storeIdempotencyKey(key, hash1, incidentId);

    const result = await checkIdempotencyKey(key, hash2);
    expect(result.exists).toBe(true);
    expect(result.conflict).toBe(true);

    // Clean up
    await prisma.idempotencyKey.delete({ where: { key } });
  });
});
