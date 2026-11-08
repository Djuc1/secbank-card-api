import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { CardsService } from './cards.service.js';
import { CreateCardRequestDto } from './dto/create-card-request.dto.js';

@ApiTags('Card Requests')
@UseGuards(ApiKeyGuard)
@ApiSecurity('X-API-Key')
@Controller('cards/requests')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new bank card request' })
  @ApiResponse({
    status: 201,
    description: 'Card request submitted or existing request returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or missing idempotency key',
  })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  @ApiResponse({
    status: 409,
    description:
      'Account is not eligible or idempotency key was reused with different data',
  })
  createRequest(
    @Body() dto: CreateCardRequestDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.cardsService.createRequest(dto, idempotencyKey);
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Check the status of a card request' })
  @ApiResponse({ status: 200, description: 'Request status retrieved' })
  @ApiResponse({ status: 404, description: 'Card request not found' })
  getRequestStatus(@Param('reference') reference: string) {
    return this.cardsService.getRequestStatus(reference);
  }
}
