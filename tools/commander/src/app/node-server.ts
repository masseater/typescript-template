import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";

interface NodeServerOptions {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly hostname: string;
  readonly port: number;
  readonly staticDirectory: string;
}

function standardRequest(request: Request): Request {
  const { body, headers, method, signal, url } = request;
  const carriesBody = method !== "GET" && method !== "HEAD";
  return new Request(url, {
    ...(carriesBody ? { body, duplex: "half" } : {}),
    headers,
    method,
    signal,
  });
}

function nodeServer(options: NodeServerOptions): ReturnType<typeof serve> {
  return serve({
    fetch: async (request) => options.fetch(standardRequest(request)),
    hostname: options.hostname,
    middleware: [staticMiddleware({ dir: options.staticDirectory })],
    port: options.port,
    silent: true,
  });
}

export { nodeServer };
