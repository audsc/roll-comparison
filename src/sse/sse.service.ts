import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface SseEvent {
  type: 'participant_joined' | 'session_closed' | 'comparison_ready';
  data: Record<string, unknown>;
}

@Injectable()
export class SseService {
  private subjects = new Map<string, Subject<SseEvent>>();

  private getOrCreate(sessionId: string): Subject<SseEvent> {
    if (!this.subjects.has(sessionId)) {
      this.subjects.set(sessionId, new Subject<SseEvent>());
    }
    return this.subjects.get(sessionId)!;
  }

  stream(sessionId: string): Observable<SseEvent> {
    return this.getOrCreate(sessionId).asObservable();
  }

  broadcast(sessionId: string, event: SseEvent): void {
    this.subjects.get(sessionId)?.next(event);
  }

  complete(sessionId: string): void {
    this.subjects.get(sessionId)?.complete();
    this.subjects.delete(sessionId);
  }
}
