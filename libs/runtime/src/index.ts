import type { Audience, Database } from "@template/db";
import type { Instrumentation, RequestContext } from "@template/observability";
import { createAuth, verifySession } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import type { AppConfig } from "@template/config";
import type { Auth } from "@template/auth";
import { createDb } from "@template/db";
import { createInstrumentation } from "@template/observability";
import { reportSentryError } from "@template/observability/sentry-server";

type Session = Awaited<ReturnType<typeof verifySession>>;

interface RequestRuntime {
  readonly auth: Auth;
  readonly config: { readonly APP_ORIGIN: string };
  readonly database: Database;
  readonly reportError: (error: unknown) => void;
  readonly session: (
    request: Readonly<{ headers: Readonly<Headers> }>,
    allowEnrollment?: boolean,
  ) => Promise<Session>;
  readonly telemetry: Instrumentation;
}

interface Runtime {
  readonly config: Pick<AppConfig, "ASSETS" | "sentry">;
  readonly forRequest: (correlation: RequestContext) => RequestRuntime;
  readonly telemetry: Instrumentation;
}

interface AppRequestContext {
  runtime: RequestRuntime;
  correlation: RequestContext;
}

interface RequestRuntimeInput {
  readonly audience: Audience;
  readonly config: Readonly<
    Pick<
      AppConfig,
      "APP_ORIGIN" | "AUTH_SECRET" | "EMAIL" | "EMAIL_FROM" | "MAILPIT_URL" | "sentry"
    >
  > & { readonly DB: Readonly<AppConfig["DB"]> };
  readonly correlation: RequestContext;
  readonly telemetry: Instrumentation;
}

function createRequestRuntime(input: RequestRuntimeInput): RequestRuntime {
  const { audience, config, correlation, telemetry } = input;
  function reportError(error: unknown): void {
    telemetry.reportError(correlation, error);
    if (config.sentry) {
      reportSentryError(error);
    }
  }
  const database = createDb(config.DB, async (operation, execute) =>
    telemetry.withDbSpan(correlation, operation, execute),
  );
  const auth = createAuth({
    audience,
    baseURL: config.APP_ORIGIN,
    database,
    onError: reportError,
    secret: config.AUTH_SECRET,
    sendVerificationEmail: async (message) =>
      telemetry.withExternalSpan(correlation, "email", async (child) =>
        sendVerificationEmail(config, message, child.traceparent),
      ),
  });
  return {
    auth,
    config: { APP_ORIGIN: config.APP_ORIGIN },
    database,
    reportError,
    session: async (request, allowEnrollment = false) =>
      verifySession({ allowEnrollment, audience, auth, database, headers: request.headers }),
    telemetry,
  };
}

function createRuntime(
  bindings: unknown,
  audience: Audience,
  routes: Readonly<Record<string, string>>,
): Runtime {
  const config = readConfig(bindings);
  const telemetry = createInstrumentation({
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: config.otelHeaders,
    routes,
    serviceName: audience,
  });
  return {
    config: { ASSETS: config.ASSETS, sentry: config.sentry },
    forRequest: (correlation) => createRequestRuntime({ audience, config, correlation, telemetry }),
    telemetry,
  };
}

export { createRuntime };
export type { AppRequestContext };
