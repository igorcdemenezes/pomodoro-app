import { ApiProperty } from '@nestjs/swagger';

import { UserProfileDto } from '../../users/dto/user-profile.dto';

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT sent as a Bearer token' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque token, rotated on every use' })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
