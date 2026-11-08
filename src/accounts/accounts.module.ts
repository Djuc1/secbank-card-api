import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, ApiKeyGuard],
})
export class AccountsModule {}
