import { Module, forwardRef } from '@nestjs/common';
import { WhoopController } from './whoop.controller';
import { WhoopService } from './whoop.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [WhoopController],
  providers: [WhoopService],
  exports: [WhoopService],
})
export class WhoopModule {}
