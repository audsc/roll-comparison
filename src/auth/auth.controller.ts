import { Controller, Get, UseGuards, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { WhoopAuthGuard } from './whoop-auth.guard';
import { ParticipantsService } from '../participants/participants.service';
import { AuthService } from './auth.service';
import { WhoopService } from '../whoop/whoop.service';
import { SessionsService } from '../sessions/sessions.service';
import { SseService } from '../sse/sse.service';
import { CloseReason, SessionStatus } from '../sessions/sessions.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly authService: AuthService,
    private readonly whoopService: WhoopService,
    private readonly sessionsService: SessionsService,
    private readonly sseService: SseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Initiate WHOOP OAuth for a session participant' })
  @ApiQuery({ name: 'sessionId', required: true, description: 'Session UUID to join' })
  @ApiQuery({ name: 'role', required: false, enum: ['creator'], description: 'Pass role=creator for the session creator' })
  @ApiResponse({ status: 302, description: 'Redirects to WHOOP authorization page' })
  @Get('whoop')
  @UseGuards(WhoopAuthGuard)
  whoopAuth() {
    // Guard handles the redirect to WHOOP
  }

  @ApiOperation({ summary: 'WHOOP OAuth callback — handled automatically, do not call directly' })
  @ApiResponse({ status: 302, description: 'Redirects to Angular lobby with participantToken' })
  @Get('whoop/callback')
  @UseGuards(AuthGuard('whoop'))
  async whoopAuthCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user as {
      accessToken: string;
      refreshToken: string;
    };
    const sessionId: string | undefined = req.session.pendingSessionId;
    const isCreator: boolean = req.session.pendingIsCreator ?? false;

    delete req.session.pendingSessionId;
    delete req.session.pendingIsCreator;

    if (!sessionId) {
      return res.json({
        message: 'Authenticated with WHOOP',
        accessToken,
        refreshToken,
      });
    }

    const session = await this.sessionsService.findOne(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    if (session.status === SessionStatus.CLOSED) {
      return res.status(400).json({ message: 'Session is already closed' });
    }

    const profile = await this.whoopService.getUserProfile(
      accessToken,
      refreshToken,
    );
    const participant = await this.participantsService.add({
      sessionId,
      whoopUserId: String(profile.user_id),
      displayName: profile.first_name ?? 'Athlete',
      accessToken: this.authService.encrypt(accessToken),
      refreshToken: refreshToken ? this.authService.encrypt(refreshToken) : null,
      isCreator,
    });

    const count = await this.participantsService.countBySession(sessionId);
    this.sseService.broadcast(sessionId, {
      type: 'participant_joined',
      data: {
        name: participant.displayName,
        count,
        maxParticipants: session.maxParticipants,
      },
    });

    if (session.maxParticipants && count >= session.maxParticipants) {
      await this.sessionsService.close(session, CloseReason.MAX_REACHED);
    }

    const participantToken = this.jwtService.sign({
      participantId: participant.id,
      sessionId,
    });
    const angularUrl =
      this.configService.get<string>('ANGULAR_APP_URL') ??
      'http://localhost:4200';
    return res.redirect(
      `${angularUrl}/session/${sessionId}/lobby?participantToken=${participantToken}`,
    );
  }

  @Get('status')
  getAuthStatus() {
    return {
      message: 'Auth endpoints available',
      endpoints: { login: '/auth/whoop', callback: '/auth/whoop/callback' },
    };
  }
}
