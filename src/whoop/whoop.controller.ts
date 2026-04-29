import {
  Controller,
  Get,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { WhoopService } from './whoop.service';

@Controller('whoop')
export class WhoopController {
  constructor(private whoopService: WhoopService) {}

  /**
   * Example endpoint to get user profile
   * In production, you would get tokens from session/database, not headers
   */
  @Get('profile')
  async getProfile(
    @Headers('authorization') authorization: string,
    @Headers('x-refresh-token') refreshToken: string,
  ) {
    if (!authorization || !refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token required',
      );
    }

    const accessToken = authorization.replace('Bearer ', '');
    return this.whoopService.getUserProfile(accessToken, refreshToken);
  }

  /**
   * Get recovery data
   */
  @Get('recovery')
  async getRecovery(
    @Headers('authorization') authorization: string,
    @Headers('x-refresh-token') refreshToken: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string,
  ) {
    if (!authorization || !refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token required',
      );
    }

    const accessToken = authorization.replace('Bearer ', '');
    return this.whoopService.getRecovery(
      accessToken,
      refreshToken,
      startDate,
      endDate,
    );
  }

  /**
   * Get cycle data
   */
  @Get('cycles')
  async getCycles(
    @Headers('authorization') authorization: string,
    @Headers('x-refresh-token') refreshToken: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string,
  ) {
    if (!authorization || !refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token required',
      );
    }

    const accessToken = authorization.replace('Bearer ', '');
    return this.whoopService.getCycles(
      accessToken,
      refreshToken,
      startDate,
      endDate,
    );
  }

  /**
   * Get workout data
   */
  @Get('workouts')
  async getWorkouts(
    @Headers('authorization') authorization: string,
    @Headers('x-refresh-token') refreshToken: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string,
  ) {
    if (!authorization || !refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token required',
      );
    }

    const accessToken = authorization.replace('Bearer ', '');
    return this.whoopService.getWorkouts(
      accessToken,
      refreshToken,
      startDate,
      endDate,
    );
  }

  /**
   * Get sleep data
   */
  @Get('sleep')
  async getSleep(
    @Headers('authorization') authorization: string,
    @Headers('x-refresh-token') refreshToken: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string,
  ) {
    if (!authorization || !refreshToken) {
      throw new UnauthorizedException(
        'Access token and refresh token required',
      );
    }

    const accessToken = authorization.replace('Bearer ', '');
    return this.whoopService.getSleep(
      accessToken,
      refreshToken,
      startDate,
      endDate,
    );
  }
}
