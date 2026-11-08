import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CardsService } from './cards.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/index.js';

describe('CardsService', () => {
  let cardsService: CardsService;

  const prismaMock = {
    customer: {
      findUnique: vi.fn(),
    },
    cardRequest: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const customer = {
    id: 1,
    accountNumber: '0123456789',
    firstName: 'John',
    lastName: 'Okafor',
    email: 'john@example.com',
    phoneNumber: '08012345678',
    accountStatus: 'ACTIVE',
  };

  const dto = {
    accountNumber: '0123456789',
    cardType: 'DEBIT',
    deliveryBranch: 'Port Harcourt Main Branch',
  };

  const existingRequest = {
    reference: 'SCR-63C91F4783C7',
    idempotencyKey: 'secbank-test-001',
    customerId: 1,
    cardType: 'DEBIT',
    deliveryBranch: 'Port Harcourt Main Branch',
    status: 'PENDING',
    createdAt: new Date('2026-11-08T02:53:57.637Z'),
    updatedAt: new Date('2026-11-08T02:53:57.637Z'),
    customer,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    cardsService = new CardsService(prismaMock as unknown as PrismaService);
  });

  it('should create a card request for an active customer', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(null);
    prismaMock.customer.findUnique.mockResolvedValue(customer);
    prismaMock.cardRequest.create.mockResolvedValue({
      ...existingRequest,
      customer: undefined,
    });

    const result = await cardsService.createRequest(dto, 'secbank-test-002');

    expect(result.success).toBe(true);
    expect(result.data.reference).toBe(existingRequest.reference);
    expect(result.data.status).toBe('PENDING');

    expect(prismaMock.cardRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'secbank-test-002',
          customerId: customer.id,
          cardType: 'DEBIT',
          status: 'PENDING',
        }),
      }),
    );
  });

  it('should reject a missing idempotency key', async () => {
    await expect(cardsService.createRequest(dto, '')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.cardRequest.create).not.toHaveBeenCalled();
  });

  it('should return the original request for an identical retry', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(existingRequest);

    const result = await cardsService.createRequest(dto, 'secbank-test-001');

    expect(result.success).toBe(true);
    expect(result.message).toBe('This card request was already submitted');
    expect(result.data.reference).toBe(existingRequest.reference);
    expect(prismaMock.cardRequest.create).not.toHaveBeenCalled();
  });

  it('should reject reuse of an idempotency key with a different payload', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(existingRequest);

    await expect(
      cardsService.createRequest(
        {
          ...dto,
          cardType: 'PREPAID',
        },
        'secbank-test-001',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.cardRequest.create).not.toHaveBeenCalled();
  });

  it('should allow a retry even if the account status later changes', async () => {
    const previouslySubmittedRequest = {
      ...existingRequest,
      customer: {
        ...customer,
        accountStatus: 'BLOCKED',
      },
    };

    prismaMock.cardRequest.findUnique.mockResolvedValue(
      previouslySubmittedRequest,
    );

    const result = await cardsService.createRequest(dto, 'secbank-test-001');

    expect(result.success).toBe(true);
    expect(result.data.reference).toBe(existingRequest.reference);
    expect(prismaMock.customer.findUnique).not.toHaveBeenCalled();
  });

  it('should reject a request for an unknown account', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(null);
    prismaMock.customer.findUnique.mockResolvedValue(null);

    await expect(
      cardsService.createRequest(dto, 'secbank-test-003'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.cardRequest.create).not.toHaveBeenCalled();
  });

  it('should reject a request from a blocked account', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(null);
    prismaMock.customer.findUnique.mockResolvedValue({
      ...customer,
      accountStatus: 'BLOCKED',
    });

    await expect(
      cardsService.createRequest(dto, 'secbank-test-004'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.cardRequest.create).not.toHaveBeenCalled();
  });

  it('should retrieve an existing card request by reference', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(existingRequest);

    const result = await cardsService.getRequestStatus('SCR-63C91F4783C7');

    expect(result.success).toBe(true);
    expect(result.data.reference).toBe('SCR-63C91F4783C7');
    expect(result.data.status).toBe('PENDING');
    expect(result.data.customerName).toBe('John Okafor');
  });

  it('should throw NotFoundException for an unknown reference', async () => {
    prismaMock.cardRequest.findUnique.mockResolvedValue(null);

    await expect(
      cardsService.getRequestStatus('SCR-UNKNOWN'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should recover from a concurrent duplicate idempotency-key request', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the idempotency key',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: {
          target: ['idempotencyKey'],
        },
      },
    );

    // The initial lookup finds no request.
    prismaMock.cardRequest.findUnique
      .mockResolvedValueOnce(null)
      // A concurrent request has now created it.
      .mockResolvedValueOnce(existingRequest);

    prismaMock.customer.findUnique.mockResolvedValue(customer);

    // Our attempted insert loses the race.
    prismaMock.cardRequest.create.mockRejectedValue(prismaError);

    const result = await cardsService.createRequest(dto, 'secbank-test-005');

    expect(result.success).toBe(true);
    expect(result.message).toBe('This card request was already submitted');
    expect(result.data.reference).toBe(existingRequest.reference);

    expect(prismaMock.cardRequest.findUnique).toHaveBeenCalledTimes(2);
    expect(prismaMock.cardRequest.findUnique).toHaveBeenLastCalledWith({
      where: { idempotencyKey: 'secbank-test-005' },
      include: { customer: true },
    });
  });

  it('should rethrow a unique-constraint error when no concurrent request is found', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: {
          target: ['idempotencyKey'],
        },
      },
    );

    prismaMock.cardRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    prismaMock.customer.findUnique.mockResolvedValue(customer);
    prismaMock.cardRequest.create.mockRejectedValue(prismaError);

    await expect(
      cardsService.createRequest(dto, 'secbank-test-006'),
    ).rejects.toBe(prismaError);

    expect(prismaMock.cardRequest.findUnique).toHaveBeenCalledTimes(2);
  });
});
