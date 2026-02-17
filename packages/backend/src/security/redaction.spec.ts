import { redactSecrets, redactObjectSecrets } from './redaction';

describe('redactSecrets', () => {
  it('should redact Authorization: Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature';
    const result = redactSecrets(input);
    expect(result).toBe('Authorization: Bearer [REDACTED]');
    expect(result).not.toContain('eyJ');
  });

  it('should redact Authorization: Basic tokens', () => {
    const input = 'Authorization: Basic dXNlcjpwYXNz';
    const result = redactSecrets(input);
    expect(result).toBe('Authorization: Basic [REDACTED]');
  });

  it('should redact api_key=... patterns', () => {
    const input = 'api_key=sk_live_abcdefghij1234567890';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('sk_live_abcdefghij');
  });

  it('should redact api-key: value patterns', () => {
    const input = 'api-key: my-secret-key-value';
    const result = redactSecrets(input);
    expect(result).toBe('api-key: [REDACTED]');
  });

  it('should redact secret_key=... patterns', () => {
    const input = 'secret_key=very-secret-123';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('very-secret');
  });

  it('should redact password=... patterns', () => {
    const input = 'password=hunter2';
    const result = redactSecrets(input);
    expect(result).toBe('password=[REDACTED]');
  });

  it('should redact token=... patterns', () => {
    const input = 'token=abc123xyz789';
    const result = redactSecrets(input);
    expect(result).toBe('token=[REDACTED]');
  });

  it('should redact sk-live style keys', () => {
    const input = 'Key is sk-live-abcdefghijklmnopqrstuvwx';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('abcdefghijklmnopqrstuvwx');
  });

  it('should handle multiple secrets in one string', () => {
    const input = 'Authorization: Bearer tok123 and api_key=secret456';
    const result = redactSecrets(input);
    expect(result).not.toContain('tok123');
    expect(result).not.toContain('secret456');
  });

  it('should not alter strings without secrets', () => {
    const input = 'This is a normal log message with no secrets.';
    const result = redactSecrets(input);
    expect(result).toBe(input);
  });

  it('should be case-insensitive for header names', () => {
    const input = 'authorization: bearer my-token-123';
    const result = redactSecrets(input);
    expect(result).not.toContain('my-token-123');
  });
});

describe('redactObjectSecrets', () => {
  it('should redact string values in an object', () => {
    const obj = {
      url: 'https://api.example.com',
      auth: 'Authorization: Bearer secret-token',
      count: 42
    };
    const result = redactObjectSecrets(obj);
    expect(result.url).toBe('https://api.example.com');
    expect(result.auth).toContain('[REDACTED]');
    expect(result.count).toBe(42);
  });
});
