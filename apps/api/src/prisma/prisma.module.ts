import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global so feature modules inject PrismaService without re-importing this
 * module. There is exactly one client per process, which matters because each
 * PrismaClient owns its own connection pool.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
