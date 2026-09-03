import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SessionDto } from './session.dto';

export class SessionPageDto {
  @ApiProperty({ type: [SessionDto] })
  items!: SessionDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Pass as `cursor` to fetch the next page. Null when the history ends.',
  })
  nextCursor!: string | null;
}
