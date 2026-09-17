import type { AppRequestContext } from "./index.ts";
import type { Audience } from "@template/db";
import type { RequestContext } from "@template/observability";
import { createRuntime } from "./index.ts";
import { secureResponse } from "./http.ts";

type Runtime = ReturnType<typeof createRuntime>;
type StartOptions = Readonly<{ context: AppRequestContext }>;

interface StartHandler {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request, options: StartOptions) => Promise<Response> | Response;
}

interface AppWorkerOptions {
  readonly audience: Audience;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
  readonly gate?: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
    bindings: unknown,
  ) => Promise<Response | undefined>;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly finalize?: (response: Response, bindings: unknown) => Promise<Response>;
}

interface AppWorker {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request, bindings: unknown) => Promise<Response>;
}

const badRequest = 400;
const notFound = 404;

function requestPath(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function infrastructureResponse({
  incoming,
  path,
  runtime,
}: Readonly<{
  incoming: Request;
  path: string;
  runtime: Runtime;
}>): Promise<Response> | Response | undefined {
  if (path.endsWith(".map")) {
    return new Response(undefined, { status: notFound });
  }
  if (path.startsWith("/assets/")) {
    return runtime.config.ASSETS.fetch(incoming);
  }
  if (path === "/api/telemetry") {
    return runtime.telemetry.ingestBrowser(incoming);
  }
  return undefined;
}

async function route(
  options: AppWorkerOptions,
  runtime: Runtime,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { correlation, incoming }: Readonly<{ correlation: RequestContext; incoming: Request }>,
): Promise<Response> {
  const path = requestPath(incoming.url);
  if (path === undefined) {
    return new Response(undefined, { status: badRequest });
  }
  const infrastructure = infrastructureResponse({ incoming, path, runtime });
  if (infrastructure !== undefined) {
    return infrastructure;
  }
  const response = await options.handler.fetch(incoming, {
    context: { correlation, runtime: runtime.forRequest(correlation) },
  });
  return secureResponse(response);
}

function createAppWorker(options: AppWorkerOptions): AppWorker {
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    fetch: async (request, bindings) => {
      const runtime = createRuntime(bindings, options.audience, options.routes);
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      return runtime.telemetry.wrapRequest(request, async (incoming, correlation) => {
        const denied = await options.gate?.(incoming, bindings);
        if (denied !== undefined) {
          return denied;
        }
        const response = await route(options, runtime, { correlation, incoming });
        return options.finalize ? options.finalize(response, bindings) : response;
      });
    },
  };
}

export { createAppWorker };
