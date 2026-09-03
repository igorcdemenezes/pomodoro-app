import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { SessionsModule } from './sessions/sessions.module';
import { StatsModule } from './stats/stats.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repository root holds the .env shared with docker-compose, so the
      // API and the database never disagree about credentials.
      envFilePath: ['../../.env', '.env'],
      cache: true,
      // A missing or weak JWT secret stops the process at boot rather than
      // surfacing later as an authentication bug.
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    SessionsModule,
    StatsModule,
    HealthModule,
  ],
})
export class AppModule {}
