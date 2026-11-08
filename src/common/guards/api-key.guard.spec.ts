import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExecutionContext,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  const configMock = {
    get: vi.fn(),
  };

  const createExecutionContext = (headers: Record<string, string>) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ApiKeyGuard(configMock as unknown as ConfigService);
  });

  it('should allow a request with a valid API key', () => {
    configMock.get.mockReturnValue('test-secret-api-key');

    const context = createExecutionContext({
      'x-api-key': 'test-secret-api-key',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject a request when the API key is missing', () => {
    configMock.get.mockReturnValue('test-secret-api-key');

    const context = createExecutionContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject an incorrect API key', () => {
    configMock.get.mockReturnValue('test-secret-api-key');

    const context = createExecutionContext({
      'x-api-key': 'wrong-secret-api-key',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject requests when the server API key is not configured', () => {
    configMock.get.mockReturnValue(undefined);

    const context = createExecutionContext({
      'x-api-key': 'test-secret-api-key',
    });

    expect(() => guard.canActivate(context)).toThrow(
      InternalServerErrorException,
    );
  });
});
