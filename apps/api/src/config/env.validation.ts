import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Configuration is validated at boot, so a missing or weak secret stops the
 * process instead of surfacing later as an authentication bug in production.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SEC = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 30;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
