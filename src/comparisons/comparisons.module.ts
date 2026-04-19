import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comparison } from './comparisons.entity';
import { ComparisonsService } from './comparisons.service';
import { ComparisonsController } from './comparisons.controller';
import { ParticipantsModule } from '../participants/participants.module';
import { WhoopModule } from '../whoop/whoop.module';
import { AuthModule } from '../auth/auth.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comparison]),
    ParticipantsModule,
    WhoopModule,
    forwardRef(() => AuthModule),
    SseModule,
  ],
  controllers: [ComparisonsController],
  providers: [ComparisonsService],
  exports: [ComparisonsService],
})
export class ComparisonsModule {}
