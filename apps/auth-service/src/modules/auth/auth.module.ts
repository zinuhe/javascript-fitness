import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { AuthEnv } from '../../config/env';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { TokenService } from './application/token.service';
import { USER_REPOSITORY } from './domain/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { AuthController } from './infrastructure/auth.controller';
import { JwtStrategy } from './infrastructure/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AuthEnv, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtStrategy,
    // Bind repository ports to their Prisma adapters — swap here to change datastore.
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
})
export class AuthModule {}
