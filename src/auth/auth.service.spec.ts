import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService — encryption', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ENCRYPTION_KEY') return 'a'.repeat(64); // 32 bytes as hex = 64 chars
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('encrypt returns a base64 string different from input', () => {
    const result = service.encrypt('my-token');
    expect(result).not.toBe('my-token');
    expect(Buffer.from(result, 'base64').length).toBeGreaterThan(0);
  });

  it('decrypt reverses encrypt', () => {
    const original = 'eyJhbGciOiJSUzI1NiJ9.test-token';
    const encrypted = service.encrypt(original);
    expect(service.decrypt(encrypted)).toBe(original);
  });

  it('each encrypt call produces a different ciphertext (random IV)', () => {
    const a = service.encrypt('same-input');
    const b = service.encrypt('same-input');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-input');
    expect(service.decrypt(b)).toBe('same-input');
  });
});
