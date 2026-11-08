import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const API_KEY = 'test-fintech-api-key-1234567890';

const ACTIVE_ACCOUNT = '0123456789';
const BLOCKED_ACCOUNT = '0123456791';
const DORMANT_ACCOUNT = '0123456792';

function findStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record[property] === 'string') {
    return record[property] as string;
  }

  for (const nestedValue of Object.values(record)) {
    const result = findStringProperty(nestedValue, property);

    if (result) {
      return result;
    }
  }

  return undefined;
}

describe('SecBank API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Point Prisma to the isolated test database before creating the app.
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.FINTECH_API_KEY = API_KEY;

    // Dynamic import ensures environment variables are set first.
    const { AppModule } = await import('../src/app.module.js');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clear dependent records first to preserve foreign-key integrity.
    await prisma.cardRequest.deleteMany();
    await prisma.customer.deleteMany();

    await Promise.all([
      prisma.customer.create({
        data: {
          accountNumber: ACTIVE_ACCOUNT,
          firstName: 'John',
          lastName: 'Okafor',
          email: 'john.e2e@example.com',
          phoneNumber: '08011111111',
          accountStatus: 'ACTIVE',
        },
      }),

      prisma.customer.create({
        data: {
          accountNumber: BLOCKED_ACCOUNT,
          firstName: 'David',
          lastName: 'Bello',
          email: 'david.e2e@example.com',
          phoneNumber: '08022222222',
          accountStatus: 'BLOCKED',
        },
      }),

      prisma.customer.create({
        data: {
          accountNumber: DORMANT_ACCOUNT,
          firstName: 'Sarah',
          lastName: 'Ade',
          email: 'sarah.e2e@example.com',
          phoneNumber: '08033333333',
          accountStatus: 'DORMANT',
        },
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API key authentication', () => {
    it('rejects requests without an API key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounts/validate')
        .send({ accountNumber: ACTIVE_ACCOUNT })
        .expect(401);
    });

    it('rejects requests with an incorrect API key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounts/validate')
        .set('X-API-Key', 'incorrect-api-key')
        .send({ accountNumber: ACTIVE_ACCOUNT })
        .expect(401);
    });
  });

  describe('POST /api/v1/accounts/validate', () => {
    it('validates an active customer account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/accounts/validate')
        .set('X-API-Key', API_KEY)
        .send({ accountNumber: ACTIVE_ACCOUNT })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account is valid and eligible for a card request',
        data: {
          accountNumber: '******6789',
          customerName: 'John Okafor',
          accountStatus: 'ACTIVE',
          eligible: true,
        },
      });

      // The full account number must not be exposed in the response.
      expect(JSON.stringify(response.body)).not.toContain(ACTIVE_ACCOUNT);
    });

    it('rejects an incorrectly formatted account number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounts/validate')
        .set('X-API-Key', API_KEY)
        .send({ accountNumber: '12345' })
        .expect(400);
    });
    it('returns 404 when the account number does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounts/validate')
        .set('X-API-Key', API_KEY)
        .send({ accountNumber: '0999999999' })
        .expect(404);
    });

  });

  describe('POST /api/v1/cards/requests', () => {
    it('creates a card request for an eligible customer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-card-request-0001')
        .send({
          accountNumber: ACTIVE_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
      });

      expect(findStringProperty(response.body, 'reference')).toMatch(
        /^SCR-[A-F0-9]{12}$/,
      );
    });

    it('returns 404 when the customer account does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-unknown-account-01')
        .send({
          accountNumber: '0999999999',
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(404);
    });

    it('returns the original request for an identical idempotent retry', async () => {
      const payload = {
        accountNumber: ACTIVE_ACCOUNT,
        cardType: 'DEBIT',
        deliveryBranch: 'Port Harcourt Main Branch',
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-card-request-0002')
        .send(payload)
        .expect(201);

      const retryResponse = await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-card-request-0002')
        .send(payload)
        .expect(201);

      expect(findStringProperty(retryResponse.body, 'reference')).toBe(
        findStringProperty(firstResponse.body, 'reference'),
      );
    });

    it('rejects reuse of an idempotency key with a different payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-card-request-0003')
        .send({
          accountNumber: ACTIVE_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-card-request-0003')
        .send({
          accountNumber: ACTIVE_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Lagos Main Branch',
        })
        .expect(409);
    });

    it('rejects a request without an idempotency key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .send({
          accountNumber: ACTIVE_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(400);
    });

    it('rejects card requests for blocked customers', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-blocked-account-01')
        .send({
          accountNumber: BLOCKED_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(409);
    });

    it('rejects card requests for dormant customers', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-dormant-account-01')
        .send({
          accountNumber: DORMANT_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/cards/requests/:reference', () => {
    it('returns the status of an existing card request', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/cards/requests')
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-status-check-0001')
        .send({
          accountNumber: ACTIVE_ACCOUNT,
          cardType: 'DEBIT',
          deliveryBranch: 'Port Harcourt Main Branch',
        })
        .expect(201);

      const reference = findStringProperty(createResponse.body, 'reference');

      expect(reference).toBeDefined();

      const statusResponse = await request(app.getHttpServer())
        .get(`/api/v1/cards/requests/${reference}`)
        .set('X-API-Key', API_KEY)
        .expect(200);

      expect(JSON.stringify(statusResponse.body)).toContain(reference);
      expect(JSON.stringify(statusResponse.body)).toContain('PENDING');
    });

    it('returns 404 for an unknown card request reference', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/cards/requests/SCR-UNKNOWN00001')
        .set('X-API-Key', API_KEY)
        .expect(404);
    });
  });
});
