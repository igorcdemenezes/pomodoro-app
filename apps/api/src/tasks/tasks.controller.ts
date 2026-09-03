import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskDto } from './dto/task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks, optionally filtered by project or status' })
  @ApiQuery({ name: 'projectId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiOkResponse({ type: [TaskDto] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string,
    @Query('status', new ParseEnumPipe(TaskStatus, { optional: true })) status?: TaskStatus,
  ): Promise<TaskDto[]> {
    return this.tasks.findAll(user.id, { projectId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one task' })
  @ApiOkResponse({ type: TaskDto })
  @ApiNotFoundResponse({ description: 'TASK_NOT_FOUND' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskDto> {
    return this.tasks.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  @ApiCreatedResponse({ type: TaskDto })
  @ApiNotFoundResponse({ description: 'PROJECT_NOT_FOUND' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto): Promise<TaskDto> {
    return this.tasks.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a task',
    description: 'Marking a task done sets its completion instant; the client never sends it.',
  })
  @ApiOkResponse({ type: TaskDto })
  @ApiNotFoundResponse({ description: 'TASK_NOT_FOUND, PROJECT_NOT_FOUND' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a task',
    description: 'Sessions recorded against it are kept and detached, so history survives.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'TASK_NOT_FOUND' })
  @ApiBadRequestResponse({ description: 'TASK_HAS_ACTIVE_SESSION' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tasks.remove(user.id, id);
  }
}
