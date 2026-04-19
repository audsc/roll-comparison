import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { WhoopStrategy } from './whoop.strategy';
import { AuthService } from './auth.service';
import { SessionSerializer } from './session.serializer';
import { ParticipantsModule } from '../participants/participants.module';
import { WhoopModule } from '../whoop/whoop.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    ParticipantsModule,
    WhoopModule,
    SessionsModule,
    SseModule,
  ],
  controllers: [AuthController],
  providers: [WhoopStrategy, AuthService, SessionSerializer],
  exports: [PassportModule, AuthService],
})
export class AuthModule {}
