import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ComparisonsService } from './comparisons.service';

@ApiTags('comparisons')
@Controller('comparisons')
export class ComparisonsController {
  constructor(private readonly comparisonsService: ComparisonsService) {}

  @ApiOperation({ summary: 'Get the stored comparison result for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Comparison with per-participant workout, HR zones, and recovery metrics',
    schema: {
      example: {
        id: 'uuid',
        sessionId: 'uuid',
        generatedAt: '2026-04-20T20:44:25Z',
        results: [
          {
            participantId: 'uuid',
            displayName: 'Alex',
            workout: { strain: 14.2, avgHr: 142, maxHr: 183, calories: 620, duration: 3600, sport: 3 },
            hrZones: { light: 12, moderate: 18, vigorous: 22, peak: 8 },
            recovery: { score: 72, hrv: 68, restingHr: 52, sleepPerformance: 84 },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Comparison not found' })
  @Get(':sessionId')
  async findBySession(@Param('sessionId') sessionId: string) {
    const comparison = await this.comparisonsService.findBySession(sessionId);
    if (!comparison) throw new NotFoundException('Comparison not found');
    return comparison;
  }
}
