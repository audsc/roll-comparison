import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  serializeUser(user: any, done: (err: Error | null, user: any) => void): void {
    // Store the entire user object in session
    done(null, user);
  }

  deserializeUser(
    payload: any,
    done: (err: Error | null, user: any) => void,
  ): void {
    // Retrieve user from session
    done(null, payload);
  }
}
