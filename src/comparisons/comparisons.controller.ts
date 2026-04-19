import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ComparisonsService } from './comparisons.service';

@Controller('comparisons')
export class ComparisonsController {
  constructor(private readonly comparisonsService: ComparisonsService) {}

  @Get(':sessionId')
  async findBySession(@Param('sessionId') sessionId: string) {
    const comparison = await this.comparisonsService.findBySession(sessionId);
    if (!comparison) throw new NotFoundException('Comparison not found');
    return comparison;
  }
}
