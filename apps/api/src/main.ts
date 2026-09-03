import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

const API_PREFIX = 'api/v1';
const DOCS_PATH = 'api/docs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: true });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown properties are rejected instead of silently ignored, so a
      // client cannot smuggle fields the DTO never declared.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const document = new DocumentBuilder()
    .setTitle('Pomodoro API')
    .setDescription(
      'Projects, tasks and Pomodoro focus sessions. The backend owns every business rule; ' +
        'clients derive the running timer from the timestamps returned here.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  SwaggerModule.setup(DOCS_PATH, app, SwaggerModule.createDocument(app, document), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/${API_PREFIX}`);
  logger.log(`API docs on http://localhost:${port}/${DOCS_PATH}`);
}

void bootstrap();
