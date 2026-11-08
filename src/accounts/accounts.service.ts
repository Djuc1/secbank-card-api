import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ValidateAccountDto } from './dto/validate-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAccount(dto: ValidateAccountDto) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        accountNumber: dto.accountNumber,
      },
    });

    if (!customer) {
      throw new NotFoundException({
        success: false,
        message: 'Bank account not found',
      });
    }

    const eligible = customer.accountStatus === 'ACTIVE';

    return {
      success: true,
      message: eligible
        ? 'Account is valid and eligible for a card request'
        : 'Account is not eligible for a card request',
      data: {
        accountNumber: `******${customer.accountNumber.slice(-4)}`,
        customerName: `${customer.firstName} ${customer.lastName}`,
        accountStatus: customer.accountStatus,
        eligible,
      },
    };
  }
}
