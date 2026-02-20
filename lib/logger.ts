/**
 * Structured JSON logger for server-side code.
 *
 * Outputs one JSON line per log entry so that Vercel's log drain,
 * Sentry, and any future observability tool can parse fields
 * without regex.  Falls back to pretty-printed output in dev.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry) {
  const payload = { ...entry, timestamp: new Date().toISOString() };

  if (process.env.NODE_ENV === 'production') {
    // Single-line JSON for log aggregators
    const line = JSON.stringify(payload);
    if (entry.level === 'error') {
      console.error(line);
    } else if (entry.level === 'warn') {
      console.warn(line);
    } else {
      console.info(line);
    }
  } else {
    // Readable output for local development
    const { level, message, timestamp: _ts, ...rest } = payload;
    const prefix = '['.concat(level, '] ', message);
    const extra = Object.keys(rest).length > 0 ? rest : undefined;
    if (level === 'error') {
      console.error(prefix, extra ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, extra ?? '');
    } else {
      console.info(prefix, extra ?? '');
    }
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    emit({ level: 'info', message, ...meta });
  },
  warn(message: string, meta?: Record<string, unknown>) {
    emit({ level: 'warn', message, ...meta });
  },
  error(message: string, meta?: Record<string, unknown>) {
    emit({ level: 'error', message, ...meta });
  },
};
