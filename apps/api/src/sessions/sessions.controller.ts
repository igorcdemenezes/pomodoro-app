import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SessionDto } from './dto/session.dto';
import { SessionPageDto } from './dto/session-page.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { SessionsService } from './sessions.service';

const MAX_PAGE_SIZE = 100;

@ApiTags('sessions')
@ApiBearerAuth('access-token')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start a Pomodoro session',
    description:
      'Refused while another session is active. The rule is enforced by the service and, ' +
      'independently, by a partial unique index, so two devices racing cannot both succeed.',
  })
  @ApiCreatedResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'SESSION_ALREADY_ACTIVE' })
  @ApiNotFoundResponse({ description: 'TASK_NOT_FOUND' })
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartSessionDto): Promise<SessionDto> {
    return this.sessions.start(user.id, dto);
  }

  @Get('active')
  @ApiOperation({
    summary: 'The session the client should be showing',
    description:
      'Answers 204 when there is none. This is what a client calls on launch to recover a ' +
      'timer that was running when the app was closed.',
  })
  @ApiOkResponse({ type: SessionDto })
  @ApiNoContentResponse({ description: 'No active session' })
  async findActive(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionDto | undefined> {
    const active = await this.sessions.findActive(user.id);

    if (!active) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return active;
  }

  @Get()
  @ApiOperation({ summary: 'Finished sessions, most recent first' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 instant' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 instant' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: SessionPageDto })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<SessionPageDto> {
    return this.sessions.history(user.id, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor,
      limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
    });
  }

  @Patch(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze the timer' })
  @ApiOkResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'INVALID_SESSION_TRANSITION' })
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionDto> {
    return this.sessions.pause(user.id, id);
  }

  @Patch(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused session, shifting its deadline' })
  @ApiOkResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'INVALID_SESSION_TRANSITION' })
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionDto> {
    return this.sessions.resume(user.id, id);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish a session early, counting it as done' })
  @ApiOkResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'INVALID_SESSION_TRANSITION' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionDto> {
    return this.sessions.finish(user.id, id, SessionStatus.COMPLETED);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandon a session, excluding it from completed metrics' })
  @ApiOkResponse({ type: SessionDto })
  @ApiConflictResponse({ description: 'INVALID_SESSION_TRANSITION' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionDto> {
    return this.sessions.finish(user.id, id, SessionStatus.CANCELLED);
  }
}
