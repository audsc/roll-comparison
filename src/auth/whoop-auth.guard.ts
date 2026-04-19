import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class WhoopAuthGuard extends AuthGuard('whoop') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.query.sessionId) {
      req.session.pendingSessionId = req.query.sessionId;
      req.session.pendingIsCreator = req.query.role === 'creator';
    }
    return super.canActivate(context);
  }
}
