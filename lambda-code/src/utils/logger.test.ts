import { logger, generateRequestId } from './logger';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log with structured format', () => {
    logger.info('test message', { requestId: 'test-123' });

    expect(consoleLogSpy).toHaveBeenCalled();
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(logged.level).toBe('info');
    expect(logged.message).toBe('test message');
    expect(logged.requestId).toBe('test-123');
    expect(logged.timestamp).toBeDefined();
  });

  it('should redact sensitive fields', () => {
    logger.info('test', { password: 'secret123', AWS_SECRET_ACCESS_KEY: 'key' });

    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logged.password).toBe('[REDACTED]');
    expect(logged.AWS_SECRET_ACCESS_KEY).toBe('[REDACTED]');
  });

  it('should generate unique request IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
