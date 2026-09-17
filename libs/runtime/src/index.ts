import { createAuth, verifySession } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import { createDb } from "@template/db";
import type { Audience } from "@template/db";
import { createInstrumentation } from "@template/observability";
import type { RequestContext } from "@template/observability";

export function createRuntime(
  bindings: unknown,
  audience: Audience,
  routes: Readonly<Record<string, string>>,
) {
  const config = readConfig(bindings);
  const telemetry = createInstrumentation({
    serviceName: audience,
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: config.otelHeaders,
    routes,
  });
  return {
    config: { ASSETS: config.ASSETS },
    telemetry,
    forRequest(correlation: RequestContext) {
      const reportError = (error: unknown) => {
        telemetry.reportError(correlation, error);
      };
      const database = createDb(config.DB, (operation, execute) =>
        telemetry.withDbSpan(correlation, operation, execute),
      );
      const auth = createAuth({
        database,
        baseURL: config.APP_ORIGIN,
        secret: config.AUTH_SECRET,
        audience,
        onError: reportError,
        sendVerificationEmail: (message) =>
          telemetry.withExternalSpan(correlation, "email", (child) =>
            sendVerificationEmail(config, message, child.traceparent),
          ),
      });
      return {
        config: { APP_ORIGIN: config.APP_ORIGIN },
        database,
        telemetry,
        auth,
        reportError,
        session: (request: Request, allowEnrollment = false) =>
          verifySession({ auth, database, headers: request.headers, audience, allowEnrollment }),
      };
    },
  };
}

type Runtime = ReturnType<ReturnType<typeof createRuntime>["forRequest"]>;
export type AppRequestContext = { runtime: Runtime; correlation: RequestContext };
