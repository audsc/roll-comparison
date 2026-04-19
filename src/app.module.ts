import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WhoopModule } from './whoop/whoop.module';
import { SessionsModule } from './sessions/sessions.module';
import { ParticipantsModule } from './participants/participants.module';
import { ComparisonsModule } from './comparisons/comparisons.module';
import { SseModule } from './sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // dev only — disable in production
      }),
    }),
    AuthModule,
    WhoopModule,
    SessionsModule,
    ParticipantsModule,
    ComparisonsModule,
    SseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
