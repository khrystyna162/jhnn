import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: RolesGuard;

  const buildContext = (role?: string) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector);
  });

  it('allows request when route has no roles metadata', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    expect(guard.canActivate(buildContext('OPERATOR'))).toBe(true);
  });

  it('allows request for whitelisted role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN', 'SYSADMIN']);

    expect(guard.canActivate(buildContext('ADMIN'))).toBe(true);
  });

  it('throws for non-whitelisted role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN', 'SYSADMIN']);

    expect(() => guard.canActivate(buildContext('OPERATOR'))).toThrow(ForbiddenException);
  });

  it('throws when user role is missing', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });
});
