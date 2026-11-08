import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AccountsService', () => {
  let accountsService: AccountsService;

  const prismaMock = {
    customer: {
      findUnique: vi.fn(),
    },
  };

  const activeCustomer = {
    id: 1,
    accountNumber: '0123456789',
    firstName: 'John',
    lastName: 'Okafor',
    email: 'john@example.com',
    phoneNumber: '08012345678',
    accountStatus: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    accountsService = new AccountsService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('should validate an active customer account', async () => {
    prismaMock.customer.findUnique.mockResolvedValue(activeCustomer);

    const result = await accountsService.validateAccount({
      accountNumber: '0123456789',
    });

    expect(result.success).toBe(true);
    expect(result.data.eligible).toBe(true);
    expect(result.data.accountStatus).toBe('ACTIVE');
    expect(result.data.accountNumber).toBe('******6789');
    expect(result.data.customerName).toBe('John Okafor');
  });

  it('should identify a blocked account as ineligible', async () => {
    prismaMock.customer.findUnique.mockResolvedValue({
      ...activeCustomer,
      accountStatus: 'BLOCKED',
    });

    const result = await accountsService.validateAccount({
      accountNumber: '0123456789',
    });

    expect(result.success).toBe(true);
    expect(result.data.eligible).toBe(false);
    expect(result.data.accountStatus).toBe('BLOCKED');
  });

  it('should identify a dormant account as ineligible', async () => {
    prismaMock.customer.findUnique.mockResolvedValue({
      ...activeCustomer,
      accountStatus: 'DORMANT',
    });

    const result = await accountsService.validateAccount({
      accountNumber: '0123456789',
    });

    expect(result.data.eligible).toBe(false);
    expect(result.data.accountStatus).toBe('DORMANT');
  });

  it('should throw NotFoundException for an unknown account', async () => {
    prismaMock.customer.findUnique.mockResolvedValue(null);

    await expect(
      accountsService.validateAccount({
        accountNumber: '9999999999',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
