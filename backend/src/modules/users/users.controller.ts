import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = search || status ? { search, status } : undefined;
    return this.usersService.list(role, filters, { page, limit });
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUserId() actorId?: string) {
    return this.usersService.create(dto, actorId);
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() dto: UpdateUserDto, @CurrentUserId() actorId?: string) {
    return this.usersService.update(userId, dto, actorId);
  }

  @Post(':userId/deactivate')
  deactivate(@Param('userId') userId: string, @CurrentUserId() actorId?: string) {
    return this.usersService.deactivate(userId, actorId);
  }

  @Post(':userId/reset-password')
  resetPassword(@Param('userId') userId: string, @CurrentUserId() actorId?: string) {
    return this.usersService.resetPassword(userId, actorId);
  }
}
