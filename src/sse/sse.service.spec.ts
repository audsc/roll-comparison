import { SseService, SseEvent } from './sse.service';

describe('SseService', () => {
  let service: SseService;

  beforeEach(() => {
    service = new SseService();
  });

  it('stream emits events broadcast to that sessionId', (done) => {
    const received: SseEvent[] = [];
    service.stream('session-1').subscribe({ next: (e) => received.push(e) });
    service.broadcast('session-1', { type: 'participant_joined', data: { name: 'Alex' } });
    setTimeout(() => {
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('participant_joined');
      done();
    }, 10);
  });

  it('broadcast to one session does not emit to another', (done) => {
    const received: SseEvent[] = [];
    service.stream('session-2').subscribe({ next: (e) => received.push(e) });
    service.broadcast('session-1', { type: 'session_closed', data: {} });
    setTimeout(() => {
      expect(received).toHaveLength(0);
      done();
    }, 10);
  });

  it('complete closes the stream and removes the subject', (done) => {
    let completed = false;
    service.stream('session-3').subscribe({ complete: () => { completed = true; } });
    service.complete('session-3');
    setTimeout(() => {
      expect(completed).toBe(true);
      done();
    }, 10);
  });
});
