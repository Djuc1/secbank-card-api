import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';

@Module({
  controllers: [CardsController],
  providers: [CardsService, ApiKeyGuard],
})
export class CardsModule {}
