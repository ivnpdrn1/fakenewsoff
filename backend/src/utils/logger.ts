/**
 * Structured Logger
 * 
 * Provides consistent logging with request IDs and redaction
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  event?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private service = 'fakenewsoff-backend';
  
  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
  
  private redact(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const redacted = { ...obj as Record<string, unknown> };
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization',
      'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'
    ];
    
    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      }
    }
    
    return redacted;
  }
  
  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const redactedContext = this.redact(context) as LogContext;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...redactedContext
    };
    
    console.log(JSON.stringify(entry));
  }
  
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }
  
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}

export const logger = new Logger();

/**
 * Generate request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}
