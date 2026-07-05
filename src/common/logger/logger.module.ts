import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '../middleware/correlation-id.middleware';

/**
 * Structured JSON logging via Pino. Correlation and request ids are pulled from
 * the headers set by CorrelationIdMiddleware and attached to every log line so
 * that a single request can be traced across the service.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        // Pretty-print only outside production for readability.
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        autoLogging: true,
        customProps: (req) => ({
          correlationId: req.headers[CORRELATION_ID_HEADER],
          requestId: req.headers[REQUEST_ID_HEADER],
          context: 'HTTP',
        }),
        // Never log secrets / auth material.
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
          remove: true,
        },
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
