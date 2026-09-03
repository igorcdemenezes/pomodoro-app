import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Profile and Pomodoro preferences of the signed-in user' })
  @ApiOkResponse({ type: UserProfileDto })
  find(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    return this.users.findById(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the name or the default session durations' })
  @ApiOkResponse({ type: UserProfileDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.users.update(user.id, dto);
  }
}
