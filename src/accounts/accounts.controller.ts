import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { ValidateAccountDto } from './dto/validate-account.dto.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';

@ApiTags('Accounts')
@UseGuards(ApiKeyGuard)
@ApiSecurity('X-API-Key')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a bank account for card eligibility' })
  @ApiResponse({ status: 200, description: 'Account validation completed' })
  @ApiResponse({ status: 400, description: 'Invalid account number' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  validateAccount(@Body() dto: ValidateAccountDto) {
    return this.accountsService.validateAccount(dto);
  }
}
