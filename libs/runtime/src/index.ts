import type { Audience, Database } from "@template/db";
import type { Instrumentation, RequestContext } from "@template/observability";
import { createAuth, verifySession } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import type { AppConfig } from "@template/config";
import type { Auth } from "@template/auth";
import { createDb } from "@template/db";
import { createInstrumentation } from "@template/observability";

type Session = Awaited<ReturnType<typeof verifySession>>;

interface RequestRuntime {
  readonly audience: Audience;
  readonly auth: Auth;
  readonly config: { readonly APP_ORIGIN: string; readonly APP_RELEASE: string };
  readonly database: Database;
  readonly reportError: (error: unknown) => void;
  readonly session: (
    request: Readonly<{ headers: Readonly<Headers> }>,
    allowEnrollment?: boolean,
  ) => Promise<Session>;
  readonly telemetry: Instrumentation;
}

interface Runtime {
  readonly config: Pick<AppConfig, "ASSETS">;
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
      "APP_ORIGIN" | "APP_RELEASE" | "AUTH_SECRET" | "EMAIL" | "EMAIL_FROM" | "MAILPIT_URL"
    >
  > & { readonly DB: Readonly<AppConfig["DB"]> };
  readonly correlation: RequestContext;
  readonly telemetry: Instrumentation;
}

function createRequestRuntime(input: RequestRuntimeInput): RequestRuntime {
  const { audience, config, correlation, telemetry } = input;
  function reportError(error: unknown): void {
    telemetry.reportError(correlation, error);
  }
  const database = createDb(config.DB);
  const auth = createAuth({
    audience,
    baseURL: config.APP_ORIGIN,
    database,
    onError: reportError,
    secret: config.AUTH_SECRET,
    sendVerificationEmail: async (message) => sendVerificationEmail(config, message),
  });
  return {
    audience,
    auth,
    config: { APP_ORIGIN: config.APP_ORIGIN, APP_RELEASE: config.APP_RELEASE },
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
    release: config.APP_RELEASE,
    routes,
    serviceName: audience,
  });
  return {
    config: { ASSETS: config.ASSETS },
    forRequest: (correlation) => createRequestRuntime({ audience, config, correlation, telemetry }),
    telemetry,
  };
}

export { createRuntime };
export type { AppRequestContext };
