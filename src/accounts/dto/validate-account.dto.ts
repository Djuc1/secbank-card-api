import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ValidateAccountDto {
  @ApiProperty({
    description: '10-digit bank account number',
    example: '0123456789',
    pattern: '^\\d{10}$',
  })
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'Account number must contain exactly 10 digits',
  })
  accountNumber: string;
}
