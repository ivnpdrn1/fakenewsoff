import { withTimeout, retry, getRetryConfig } from './resilience';

describe('resilience', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });
  
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
      jest.useFakeTimers();
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
      jest.clearAllTimers();
    });

    it('should reject if promise exceeds timeout', async () => {
      jest.useFakeTimers();
      
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      const timeoutPromise = withTimeout(promise, 1000, { opName: 'test' });
      
      jest.advanceTimersByTime(1000);
      
      await expect(timeoutPromise).rejects.toThrow('test timed out after 1000ms');
      
      jest.clearAllTimers();
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn, { retries: 2 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      jest.useFakeTimers();
      
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');
      
      const retryPromise = retry(fn, { retries: 2, baseDelayMs: 100 });
      
      // Advance past retry delay
      await jest.advanceTimersByTimeAsync(200);
      
      const result = await retryPromise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('validation error'));
      
      await expect(retry(fn, { retries: 2 })).rejects.toThrow('validation error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRetryConfig', () => {
    it('should disable retries in demo mode', () => {
      process.env.DEMO_MODE = 'true';
      const config = getRetryConfig();
      expect(config.maxAttempts).toBe(0);
    });

    it('should enable retries in normal mode', () => {
      delete process.env.DEMO_MODE;
      const config = getRetryConfig();
      expect(config.maxAttempts).toBe(2);
    });
  });
});
