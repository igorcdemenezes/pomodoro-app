import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserProfileDto } from './dto/user-profile.dto';
import { toUserProfile } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      // Reachable when a valid token outlives the account it belongs to.
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }

    return toUserProfile(user);
  }

  async update(id: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({ where: { id }, data: dto });

    return toUserProfile(user);
  }
}
