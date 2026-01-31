import request from 'supertest';
import app from '../../index';
import { prisma } from '../setup';

describe('Incidents API Integration Tests', () => {
  let testUser: any;

  beforeAll(async () => {
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.incident.deleteMany({});
    await prisma.user.deleteMany({});
  });

  test('should create a new incident', async () => {
    const response = await request(app)
      .post('/v1/incidents')
      .send({
        title: 'Test Incident',
        description: 'Test description',
        severity: 'P1',
        createdBy: testUser.id,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Test Incident');
    expect(response.body.severity).toBe('P1');
    expect(response.body.status).toBe('OPEN');
  });

  test('should update incident status', async () => {
    // Create an incident first
    const incident = await prisma.incident.create({
      data: {
        title: 'Status Test',
        description: 'Test',
        severity: 'P2',
        createdBy: testUser.id,
      },
    });

    const response = await request(app)
      .patch(`/v1/incidents/${incident.id}/status`)
      .send({
        status: 'ACK',
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ACK');
  });

  test('should fetch incident with events', async () => {
    // Create an incident
    const incident = await prisma.incident.create({
      data: {
        title: 'Fetch Test',
        description: 'Test',
        severity: 'P3',
        createdBy: testUser.id,
      },
    });

    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: 'CREATED',
        payload: { test: 'data' },
      },
    });

    const response = await request(app).get(`/v1/incidents/${incident.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('events');
    expect(Array.isArray(response.body.events)).toBe(true);
  });

  test('should list incidents with pagination', async () => {
    const response = await request(app)
      .get('/v1/incidents')
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('should enforce idempotency', async () => {
    const idempotencyKey = 'test-key-' + Date.now();
    const payload = {
      title: 'Idempotent Test',
      description: 'Test',
      severity: 'P1',
      createdBy: testUser.id,
    };

    const response1 = await request(app)
      .post('/v1/incidents')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    const response2 = await request(app)
      .post('/v1/incidents')
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(200);
    expect(response1.body.id).toBe(response2.body.id);
  });
});
