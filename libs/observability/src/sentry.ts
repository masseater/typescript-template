import type { ErrorEvent, Exception, StackFrame } from "@sentry/react";
import { validRequestId, validTraceId } from "./protocol.ts";

interface SentryConfiguration {
  readonly dsn?: string;
  readonly environment: string;
  readonly release: string;
}

type FrameInput = Readonly<Pick<StackFrame, "colno" | "filename" | "in_app" | "lineno">>;
type ExceptionInput = Readonly<Pick<Exception, "type">> & {
  readonly stacktrace?: { readonly frames?: readonly FrameInput[] };
};
type EventInput = Readonly<Pick<ErrorEvent, "event_id" | "timestamp" | "type">> & {
  readonly exception?: { readonly values?: readonly ExceptionInput[] };
  readonly tags?: Readonly<NonNullable<ErrorEvent["tags"]>>;
};
interface SentryOptions {
  readonly autoSessionTracking: false;
  readonly beforeBreadcrumb: () => null;
  readonly beforeSend: (event: EventInput) => ErrorEvent | null;
  readonly beforeSendTransaction: () => null;
  readonly dsn?: string;
  readonly enableLogs: false;
  readonly enabled: boolean;
  readonly environment: string;
  readonly release: string;
  readonly sendClientReports: false;
  readonly sendDefaultPii: false;
  readonly tracesSampleRate: number;
}

function present(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function safeFrame(frame: FrameInput): StackFrame {
  const [filename] = frame.filename?.split(/[?#]/u, 1) ?? [];
  const publicAsset =
    present(filename) &&
    /^(?:https?:\/\/[^/]+\/assets\/|\/assets\/|[\w./-]+\.[cm]?js$)/u.test(filename);
  return {
    ...(publicAsset ? { filename } : {}),
    ...(frame.lineno === undefined ? {} : { lineno: frame.lineno }),
    ...(frame.colno === undefined ? {} : { colno: frame.colno }),
    ...(frame.in_app === undefined ? {} : { in_app: frame.in_app }),
  };
}

function safeException(exception: ExceptionInput): Exception {
  const type = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(exception.type ?? "")
    ? (exception.type ?? "Error")
    : "Error";
  const value = "Application error; inspect the correlated local telemetry";
  if (!exception.stacktrace) {
    return { type, value };
  }
  return {
    stacktrace: { frames: exception.stacktrace.frames?.map((frame) => safeFrame(frame)) ?? [] },
    type,
    value,
  };
}

function safeTags(event: EventInput): Record<string, string> {
  const requestId = event.tags?.["request_id"];
  const traceId = event.tags?.["otel_trace_id"];
  return {
    ...(validRequestId(requestId) ? { request_id: requestId } : {}),
    ...(validTraceId(traceId) ? { otel_trace_id: traceId } : {}),
  };
}

function sanitizeEvent(configuration: SentryConfiguration, event: EventInput): ErrorEvent {
  return {
    type: undefined,
    ...(present(event.event_id) ? { event_id: event.event_id } : {}),
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    environment: configuration.environment,
    exception: {
      values: (event.exception?.values ?? []).map((exception) => safeException(exception)),
    },
    level: "error",
    platform: "javascript",
    release: configuration.release,
    tags: safeTags(event),
  };
}

function validateConfiguration(input: SentryConfiguration): void {
  if (
    !/^[a-z0-9.-]{1,64}$/u.test(input.environment) ||
    !/^[a-zA-Z0-9._-]{1,128}$/u.test(input.release)
  ) {
    throw new Error("Invalid Sentry environment or release");
  }
  if (present(input.dsn)) {
    const dsn = new URL(input.dsn);
    if (
      dsn.protocol !== "https:" ||
      dsn.username === "" ||
      dsn.password !== "" ||
      dsn.search !== "" ||
      dsn.hash !== ""
    ) {
      throw new Error("Invalid Sentry DSN");
    }
  }
}

function sentryBoundary(input: SentryConfiguration): SentryOptions {
  validateConfiguration(input);
  const enabled = present(input.dsn);
  return {
    autoSessionTracking: false,
    // oxlint-disable-next-line unicorn/no-null
    beforeBreadcrumb: (): null => null,
    // oxlint-disable-next-line unicorn/no-null
    beforeSend: (event) => (enabled ? sanitizeEvent(input, event) : null),
    // oxlint-disable-next-line unicorn/no-null
    beforeSendTransaction: (): null => null,
    ...(present(input.dsn) ? { dsn: input.dsn } : {}),
    enableLogs: false,
    enabled,
    environment: input.environment,
    release: input.release,
    sendClientReports: false,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}

export { sentryBoundary };
export type { SentryConfiguration };
