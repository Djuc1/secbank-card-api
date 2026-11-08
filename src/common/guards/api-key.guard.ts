import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const providedKey = request.headers['x-api-key'];
    const configuredKey = this.configService.get<string>('FINTECH_API_KEY');

    if (!configuredKey) {
      throw new InternalServerErrorException(
        'API key authentication is not configured',
      );
    }

    if (typeof providedKey !== 'string') {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    const providedBuffer = Buffer.from(providedKey);
    const configuredBuffer = Buffer.from(configuredKey);

    if (
      providedBuffer.length !== configuredBuffer.length ||
      !timingSafeEqual(providedBuffer, configuredBuffer)
    ) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    return true;
  }
}
