import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCardRequestDto {
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

  @ApiProperty({
    description: 'Type of card to issue',
    enum: ['DEBIT', 'PREPAID'],
    example: 'DEBIT',
  })
  @IsString()
  @IsIn(['DEBIT', 'PREPAID'], {
    message: 'Card type must be DEBIT or PREPAID',
  })
  cardType: string;

  @ApiProperty({
    description: 'Designated bank branch for card delivery and pickup',
    example: 'Port Harcourt Main Branch',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  deliveryBranch: string;
}
