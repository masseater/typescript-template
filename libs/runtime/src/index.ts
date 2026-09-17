import { createAuth, verifySession } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import type { AppConfig } from "@template/config";
import { createDb } from "@template/db";
import type { Audience } from "@template/db";
import { createInstrumentation } from "@template/observability";
import type { RequestContext } from "@template/observability";

export function createRuntime(
  bindings: unknown,
  audience: Exclude<Audience, "wiki">,
  routes: Readonly<Record<string, string>>,
) {
  return buildRuntime(readConfig(bindings), audience, routes);
}

export function buildRuntime(
  config: AppConfig,
  audience: Audience,
  routes: Readonly<Record<string, string>>,
) {
  const telemetry = createInstrumentation({
    serviceName: audience,
    release: config.APP_RELEASE,
    routes,
  });
  return {
    config: { ASSETS: config.ASSETS },
    telemetry,
    forRequest(correlation: RequestContext) {
      const reportError = (error: unknown) => {
        telemetry.reportError(correlation, error);
      };
      const database = createDb(config.DB);
      const auth = createAuth({
        database,
        baseURL: config.APP_ORIGIN,
        secret: config.AUTH_SECRET,
        audience,
        onError: reportError,
        sendVerificationEmail: (message) => sendVerificationEmail(config, message),
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
