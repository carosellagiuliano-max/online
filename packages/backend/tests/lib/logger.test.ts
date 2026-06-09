import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, generateRequestId, createTimer, type LogContext } from '@/lib/logging/logger';

// Mock Sentry to prevent actual API calls
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((callback) => callback({ setExtras: vi.fn(), setTag: vi.fn() })),
  captureException: vi.fn(),
}));

// ============================================
// LOGGER TESTS
// ============================================

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Default Logger', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have event logging method', () => {
      expect(typeof logger.event).toBe('function');
    });

    it('should have request logging method', () => {
      expect(typeof logger.request).toBe('function');
    });

    it('should have child logger method', () => {
      expect(typeof logger.child).toBe('function');
    });
  });

  describe('Log Methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Test warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log info with context', () => {
      logger.info('Test message', { userId: 'user-123' });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Child Logger', () => {
    it('should create a child logger with context', () => {
      const childLogger = logger.child({ salonId: 'salon-1' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });

    it('should include parent context in log output', () => {
      const childLogger = logger.child({ salonId: 'salon-1' });
      childLogger.info('Child log message');
      expect(consoleSpy).toHaveBeenCalled();

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('salon-1');
    });

    it('should merge child and parent context', () => {
      const childLogger = logger.child({ salonId: 'salon-1' });
      childLogger.info('Message', { action: 'test' });
      expect(consoleSpy).toHaveBeenCalled();

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('salon-1');
      expect(logCall).toContain('test');
    });
  });

  describe('Request Logging', () => {
    it('should log successful requests as info', () => {
      logger.request('GET', '/api/test', 200, 45);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log client errors as warnings', () => {
      logger.request('POST', '/api/test', 404, 30);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log server errors as errors', () => {
      logger.request('POST', '/api/test', 500, 100);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Event Logging', () => {
    it('should log business events', () => {
      logger.event('BOOKING_CREATED', { bookingId: 'BK-123' });
      expect(consoleSpy).toHaveBeenCalled();

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('BOOKING_CREATED');
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask email addresses', () => {
      logger.info('User logged in', { email: 'user@example.com' } as LogContext);

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('user@example.com');
      expect(logCall).toContain('***@example.com');
    });

    it('should mask password fields', () => {
      logger.info('Login attempt', { password: 'secret123' } as LogContext);

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('secret123');
      expect(logCall).toContain('[REDACTED]');
    });

    it('should mask token fields', () => {
      logger.info('Token refresh', { accessToken: 'abc123xyz' } as LogContext);

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('abc123xyz');
      expect(logCall).toContain('[REDACTED]');
    });
  });

  describe('Error Handling', () => {
    it('should log Error objects with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Operation failed', error);
      expect(consoleErrorSpy).toHaveBeenCalled();

      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('Test error');
    });

    it('should handle missing error gracefully', () => {
      expect(() => logger.error('Message without error')).not.toThrow();
    });

    it('should handle undefined context gracefully', () => {
      expect(() => logger.info('Message', undefined)).not.toThrow();
    });
  });

  describe('Structured Logging Format', () => {
    it('should produce JSON-formatted logs', () => {
      logger.info('Test message', { key: 'value' } as LogContext);

      const logCall = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
    });

    it('should include timestamp in logs', () => {
      logger.info('Timestamped message');

      const logCall = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
    });
  });
});

// ============================================
// REQUEST ID TESTS
// ============================================

describe('generateRequestId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
  });

  it('should return string IDs', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should contain hyphen separator', () => {
    const id = generateRequestId();
    expect(id).toContain('-');
  });
});

// ============================================
// TIMER TESTS
// ============================================

describe('createTimer', () => {
  it('should create a timer object', () => {
    const timer = createTimer();
    expect(timer).toBeDefined();
    expect(typeof timer.elapsed).toBe('function');
  });

  it('should measure elapsed time', async () => {
    const timer = createTimer();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('should return integer milliseconds', () => {
    const timer = createTimer();
    const elapsed = timer.elapsed();
    expect(Number.isInteger(elapsed)).toBe(true);
  });
});

// ============================================
// BUSINESS DOMAIN LOGGING TESTS
// ============================================

describe('Domain-Specific Logging', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Booking Logger', () => {
    it('should log booking creation', () => {
      const bookingLogger = logger.child({ salonId: 'salon-1', action: 'booking.create' });
      bookingLogger.info('Booking created', {
        customerId: 'CU-456',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log booking events', () => {
      logger.event('BOOKING_CANCELLED', {
        salonId: 'salon-1',
        customerId: 'CU-456',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Payment Logger', () => {
    it('should log payment success', () => {
      const paymentLogger = logger.child({ salonId: 'salon-1', action: 'payment' });
      paymentLogger.info('Payment successful', {
        customerId: 'CU-456',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should mask card details', () => {
      logger.info('Card added', {
        cardNumber: '4242424242424242',
      } as LogContext);

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).not.toContain('4242424242424242');
    });
  });

  describe('Auth Logger', () => {
    it('should log login events', () => {
      logger.event('USER_LOGIN', {
        userId: 'user-123',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
