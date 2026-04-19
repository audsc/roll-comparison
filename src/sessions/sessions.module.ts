import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './sessions.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SseModule } from '../sse/sse.module';
import { ComparisonsModule } from '../comparisons/comparisons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    SseModule,
    forwardRef(() => ComparisonsModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
