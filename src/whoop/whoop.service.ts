import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class WhoopService {
  constructor(private authService: AuthService) {}

  /**
   * Get user profile information from WHOOP
   */
  async getUserProfile(accessToken: string, refreshToken: string) {
    return this.authService.makeWhoopApiRequest(
      '/user/profile/basic',
      accessToken,
      refreshToken,
    );
  }

  /**
   * Get recovery data for a specific date or date range
   */
  async getRecovery(
    accessToken: string,
    refreshToken: string | undefined,
    startDate?: string,
    endDate?: string,
  ) {
    let endpoint = '/recovery';

    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.authService.makeWhoopApiRequest(
      endpoint,
      accessToken,
      refreshToken,
    );
  }

  /**
   * Get cycle data (sleep + strain)
   */
  async getCycles(
    accessToken: string,
    refreshToken: string | undefined,
    startDate?: string,
    endDate?: string,
  ) {
    let endpoint = '/cycle';

    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.authService.makeWhoopApiRequest(
      endpoint,
      accessToken,
      refreshToken,
    );
  }

  /**
   * Get workout data
   */
  async getWorkouts(
    accessToken: string,
    refreshToken: string | undefined,
    startDate?: string,
    endDate?: string,
  ) {
    let endpoint = '/workout';

    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.authService.makeWhoopApiRequest(
      endpoint,
      accessToken,
      refreshToken,
    );
  }

  /**
   * Get sleep data
   */
  async getSleep(
    accessToken: string,
    refreshToken: string | undefined,
    startDate?: string,
    endDate?: string,
  ) {
    let endpoint = '/sleep';

    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.authService.makeWhoopApiRequest(
      endpoint,
      accessToken,
      refreshToken,
    );
  }
}
