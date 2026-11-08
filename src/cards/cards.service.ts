import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCardRequestDto } from './dto/create-card-request.dto.js';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateCardRequestDto, idempotencyKey: string) {
    // Validate the idempotency key.
    if (
      typeof idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'A valid Idempotency-Key header is required (8-128 permitted characters)',
      });
    }

    // Check whether this operation has already been processed.
    const existingRequest = await this.prisma.cardRequest.findUnique({
      where: { idempotencyKey },
      include: { customer: true },
    });

    if (existingRequest) {
      return this.handleExistingRequest(existingRequest, dto);
    }

    // Check account eligibility for a new request.
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

    if (customer.accountStatus !== 'ACTIVE') {
      throw new ConflictException({
        success: false,
        message: 'This account is not eligible for a card request',
        accountStatus: customer.accountStatus,
      });
    }

    // Generate a unique card request reference.
    const reference = `SCR-${randomUUID()
      .replaceAll('-', '')
      .slice(0, 12)
      .toUpperCase()}`;

    try {
      const cardRequest = await this.prisma.cardRequest.create({
        data: {
          reference,
          idempotencyKey,
          customerId: customer.id,
          cardType: dto.cardType,
          deliveryBranch: dto.deliveryBranch,
          status: 'PENDING',
        },
      });

      return this.formatResponse(cardRequest, customer);
    } catch (error) {
      // Another simultaneous request may have saved this key first.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentRequest = await this.prisma.cardRequest.findUnique({
          where: { idempotencyKey },
          include: { customer: true },
        });

        if (concurrentRequest) {
          return this.handleExistingRequest(concurrentRequest, dto);
        }
      }

      throw error;
    }
  }

  private handleExistingRequest(
    existingRequest: {
      customer: {
        accountNumber: string;
        firstName: string;
        lastName: string;
      };
      cardType: string;
      deliveryBranch: string;
      reference: string;
      status: string;
      createdAt: Date;
    },
    dto: CreateCardRequestDto,
  ) {
    const samePayload =
      existingRequest.customer.accountNumber === dto.accountNumber &&
      existingRequest.cardType === dto.cardType &&
      existingRequest.deliveryBranch === dto.deliveryBranch;

    if (!samePayload) {
      throw new ConflictException({
        success: false,
        message:
          'This Idempotency-Key has already been used with a different request payload',
      });
    }

    return this.formatResponse(existingRequest, existingRequest.customer, true);
  }

  private formatResponse(
    cardRequest: {
      reference: string;
      cardType: string;
      deliveryBranch: string;
      status: string;
      createdAt: Date;
    },
    customer: {
      accountNumber: string;
      firstName: string;
      lastName: string;
    },
    replayed = false,
  ) {
    return {
      success: true,
      message: replayed
        ? 'This card request was already submitted'
        : 'Card request submitted successfully',
      data: {
        reference: cardRequest.reference,
        customerName: `${customer.firstName} ${customer.lastName}`,
        accountNumber: `******${customer.accountNumber.slice(-4)}`,
        cardType: cardRequest.cardType,
        deliveryBranch: cardRequest.deliveryBranch,
        status: cardRequest.status,
        submittedAt: cardRequest.createdAt,
      },
    };
  }

  async getRequestStatus(reference: string) {
    const cardRequest = await this.prisma.cardRequest.findUnique({
      where: { reference },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            accountNumber: true,
          },
        },
      },
    });

    if (!cardRequest) {
      throw new NotFoundException({
        success: false,
        message: 'Card request not found',
      });
    }

    return {
      success: true,
      message: 'Card request status retrieved successfully',
      data: {
        reference: cardRequest.reference,
        customerName: `${cardRequest.customer.firstName} ${cardRequest.customer.lastName}`,
        accountNumber: `******${cardRequest.customer.accountNumber.slice(-4)}`,
        cardType: cardRequest.cardType,
        deliveryBranch: cardRequest.deliveryBranch,
        status: cardRequest.status,
        submittedAt: cardRequest.createdAt,
        lastUpdatedAt: cardRequest.updatedAt,
      },
    };
  }
}
