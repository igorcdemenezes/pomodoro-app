import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repository root holds the .env shared with docker-compose, so the
      // API and the database never disagree about credentials.
      envFilePath: ['../../.env', '.env'],
      cache: true,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
