import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  CompositePropagator,
  setGlobalErrorHandler,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  defaultResource,
  detectResources,
  envDetector,
  resourceFromAttributes,
  type Resource,
} from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { telemetrySettings, type TelemetrySettings } from "@repo/config/process-environment";
import { ConfigProvider, Effect } from "effect";
import { attemptAsync, once } from "es-toolkit";

import { reportExportFailure } from "./export-failure.ts";

export type Telemetry = {
  readonly enabled: boolean;
  readonly shutdown: () => Promise<void>;
};

const registerPropagation = (): void => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager());
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );
};

const resourceNamed = (serviceName: string): Resource =>
  defaultResource()
    .merge(resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }))
    .merge(detectResources({ detectors: [envDetector] }));

const exporterOptions = (endpoint: string | undefined): { readonly url?: string } =>
  endpoint === undefined ? {} : { url: endpoint };

type Providers = {
  readonly tracerProvider: Readonly<TracerProvider>;
  readonly meterProvider: Readonly<MeterProvider>;
  readonly loggerProvider: Readonly<LoggerProvider>;
};

const registerProviders = (serviceName: string, settings: TelemetrySettings): Providers => {
  const resource = resourceNamed(serviceName);
  const tracerProvider = new TracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor({ exporter: new OTLPTraceExporter(exporterOptions(settings.traces)) }),
    ],
  });
  trace.setGlobalTracerProvider(tracerProvider);
  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(exporterOptions(settings.metrics)),
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter(exporterOptions(settings.logs)),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
  return { tracerProvider, meterProvider, loggerProvider };
};

const shutdownProviders = (providers: Providers): Promise<readonly [Error | null, unknown]> =>
  attemptAsync(() =>
    Promise.all([
      providers.tracerProvider.shutdown(),
      providers.meterProvider.shutdown(),
      providers.loggerProvider.shutdown(),
    ]),
  );

const stoppedProviders = (providers: Providers): Effect.Effect<void> =>
  Effect.gen(function* stopProviders() {
    const [failure] = yield* Effect.promise(() => shutdownProviders(providers));
    if (failure !== null) yield* reportExportFailure(failure);
  });

const stopAfterEveryOtherExitHandler = (stop: () => Promise<void>): (() => Promise<void>) => {
  const shutdownOnce = once(stop);
  process.on("beforeExit", () => {
    queueMicrotask(() => {
      void shutdownOnce();
    });
  });
  return shutdownOnce;
};

const measuringStart = (
  serviceName: string,
  settings: TelemetrySettings,
): Effect.Effect<Telemetry> =>
  Effect.gen(function* measuring() {
    const services = yield* Effect.context();
    setGlobalErrorHandler((thrown) => {
      Effect.runSyncWith(services)(reportExportFailure(thrown));
    });
    registerPropagation();
    const providers = registerProviders(serviceName, settings);
    const shutdown = stopAfterEveryOtherExitHandler(() =>
      Effect.runPromiseWith(services)(stoppedProviders(providers)),
    );
    return { enabled: true, shutdown };
  });

const notMeasuring: Telemetry = {
  enabled: false,
  shutdown: (): Promise<void> => Promise.resolve(),
};

const firstStart = once((start: () => Telemetry): Telemetry => start());

export const measuredTelemetry = (serviceName: string): Effect.Effect<Telemetry> =>
  Effect.gen(function* measured() {
    const settings = yield* Effect.orDie(telemetrySettings);
    const services = yield* Effect.context();
    return firstStart(() =>
      Effect.runSyncWith(services)(
        settings.measured ? measuringStart(serviceName, settings) : Effect.succeed(notMeasuring),
      ),
    );
  });

export const startTelemetry = (serviceName: string): Telemetry =>
  Effect.runSync(
    measuredTelemetry(serviceName).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
    ),
  );
