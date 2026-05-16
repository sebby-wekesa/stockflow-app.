// lib/logger.ts
// Simple logging utility for development
// In production, integrate with proper logging service like Winston, Pino, etc.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logLevel: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (data) {
      return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
    }

    return baseMessage;
  }

  debug(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorData = {
        ...data,
        stack: error instanceof Error ? error.stack : undefined,
      };
      console.error(this.formatMessage('error', `${message}: ${errorMessage}`, errorData));
    }
  }

  // Specialized logging methods
  audit(userId: string, action: string, details?: Record<string, unknown>) {
    this.info(`AUDIT: User ${userId} performed ${action}`, { userId, action, details });
  }

  security(message: string, data?: Record<string, unknown>) {
    this.warn(`SECURITY: ${message}`, data);
  }

  performance(operation: string, duration: number, data?: Record<string, unknown>) {
    this.info(`PERFORMANCE: ${operation} took ${duration}ms`, { operation, duration, ...data });
  }
}

export const logger = new Logger();

// Set log level based on environment
if (process.env.NODE_ENV === 'development') {
  logger.setLevel('debug');
} else {
  logger.setLevel('info');
}