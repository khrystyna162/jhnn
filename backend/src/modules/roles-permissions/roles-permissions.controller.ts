import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserScopesDto } from './dto/update-user-scopes.dto';
import { UpdateUserServiceAccessDto } from './dto/update-user-service-access.dto';
import { RolesPermissionsService } from './roles-permissions.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RolesPermissionsController {
  constructor(private readonly rolesPermissionsService: RolesPermissionsService) {}

  @Get('permissions')
  listPermissions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.rolesPermissionsService.listPermissions({ page, limit });
  }

  @Get('users/:userId/access')
  getUserAccess(@Param('userId') userId: string) {
    return this.rolesPermissionsService.getUserAccess(userId);
  }

  @Put('users/:userId/permissions')
  updateUserPermissions(@Param('userId') userId: string, @Body() dto: UpdateUserPermissionsDto) {
    return this.rolesPermissionsService.updateUserPermissions(userId, dto);
  }

  @Put('users/:userId/scopes')
  updateUserScopes(@Param('userId') userId: string, @Body() dto: UpdateUserScopesDto) {
    return this.rolesPermissionsService.updateUserScopes(userId, dto);
  }

  @Put('users/:userId/service-access')
  updateUserServiceAccess(@Param('userId') userId: string, @Body() dto: UpdateUserServiceAccessDto) {
    return this.rolesPermissionsService.updateUserServiceAccess(userId, dto);
  }
}
