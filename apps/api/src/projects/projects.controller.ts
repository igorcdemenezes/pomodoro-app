import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDto } from './dto/project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List the projects of the signed-in user' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiOkResponse({ type: [ProjectDto] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived?: boolean,
  ): Promise<ProjectDto[]> {
    return this.projects.findAll(user.id, includeArchived ?? false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ description: 'PROJECT_NOT_FOUND' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiConflictResponse({ description: 'PROJECT_NAME_TAKEN' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, recolour, archive or restore a project' })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ description: 'PROJECT_NOT_FOUND' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Archive a project',
    description:
      'Archiving rather than deleting, because sessions recorded against its tasks are history.',
  })
  @ApiOkResponse({ type: ProjectDto })
  @ApiNotFoundResponse({ description: 'PROJECT_NOT_FOUND' })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDto> {
    return this.projects.archive(user.id, id);
  }
}
