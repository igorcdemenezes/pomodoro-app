import type { User } from '@prisma/client';

import type { UserProfileDto } from './dto/user-profile.dto';

/** Never serialise a User directly: passwordHash must not leave the process. */
export function toUserProfile(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    focusDurationSec: user.focusDurationSec,
    shortBreakSec: user.shortBreakSec,
    longBreakSec: user.longBreakSec,
    cyclesUntilLongBreak: user.cyclesUntilLongBreak,
    createdAt: user.createdAt,
  };
}
