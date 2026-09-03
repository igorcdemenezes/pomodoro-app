import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The repository root holds the .env shared with docker-compose, so the
      // API and the database never disagree about credentials.
      envFilePath: ['../../.env', '.env'],
      cache: true,
    }),
    HealthModule,
  ],
})
export class AppModule {}
