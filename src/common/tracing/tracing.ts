import { Logger } from '@nestjs/common';

const logger = new Logger('Tracing');

/**
 * OpenTelemetry bootstrap.
 *
 * The authorization engine already creates spans via `@opentelemetry/api`
 * (`authorization.checkAccess`). Those spans are no-ops until a tracer provider
 * is registered here. Export is opt-in (OTEL_ENABLED=true) and the SDK is loaded
 * dynamically so the base image stays slim when tracing is off.
 *
 * To enable end-to-end tracing:
 *   npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
 *         @opentelemetry/exporter-trace-otlp-http
 *   OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318 npm start
 */
export async function initTracing(): Promise<void> {
  if (process.env.OTEL_ENABLED !== 'true') {
    logger.log('Tracing disabled (set OTEL_ENABLED=true to enable). Spans are no-ops.');
    return;
  }

  try {
    // Indirect specifiers so TypeScript/webpack don't require these opt-in
    // packages at build time; they are loaded only when tracing is enabled.
    const sdkPkg = '@opentelemetry/sdk-node';
    const exporterPkg = '@opentelemetry/exporter-trace-otlp-http';
    const instrPkg = '@opentelemetry/auto-instrumentations-node';
    const { NodeSDK } = await import(sdkPkg);
    const { OTLPTraceExporter } = await import(exporterPkg);
    const { getNodeAutoInstrumentations } = await import(instrPkg);

    const sdk = new NodeSDK({
      serviceName: 'iam-access-control-service',
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    logger.log('OpenTelemetry tracing enabled');

    process.on('SIGTERM', () => {
      void sdk.shutdown().finally(() => process.exit(0));
    });
  } catch (err) {
    logger.warn(
      `OTEL_ENABLED=true but the OpenTelemetry SDK is not installed — tracing stays no-op. (${(err as Error).message})`,
    );
  }
}
