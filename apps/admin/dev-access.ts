import type { Connect, HttpServer, Plugin, UserConfig } from "vite-plus";
import type { IncomingMessage, ServerResponse } from "node:http";
import { enforceAdminAccess, localAccessCookie } from "./src/access.ts";
import { minLength, object, pipe, safeParse, string, url } from "valibot";
import type { Duplex } from "node:stream";
import type { InferOutput } from "valibot";
import { open } from "node:fs/promises";
import { parseEnv } from "node:util";

const permissionBits = 0o777;
const privateFileMode = 0o600;
const localAdminPasswordMinLength = 24;
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const loopbackAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const credentialsSchema = object({
  APP_ORIGIN: pipe(string(), url()),
  LOCAL_ADMIN_PASSWORD: pipe(string(), minLength(localAdminPasswordMinLength)),
  LOCAL_ADMIN_USER: pipe(string(), minLength(1)),
});

type LocalCredentials = Readonly<InferOutput<typeof credentialsSchema>>;
type Authorize = (request: IncomingMessage, websocket: boolean) => Promise<Response | undefined>;

interface RequestSource {
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly remoteAddress: string | undefined;
  readonly websocket: boolean;
}

function parseCredentials(text: string): LocalCredentials {
  const parsed = safeParse(credentialsSchema, parseEnv(text));
  if (!parsed.success) {
    throw new Error("ADMIN_DEV_CREDENTIALS_INVALID");
  }
  const origin = new URL(parsed.output.APP_ORIGIN);
  if (
    origin.protocol !== "http:" ||
    !localHosts.has(origin.hostname) ||
    origin.origin !== parsed.output.APP_ORIGIN
  ) {
    throw new Error("ADMIN_DEV_ORIGIN_MUST_BE_LOCAL_HTTP");
  }
  return parsed.output;
}

async function readCredentials(file: Readonly<URL>): Promise<LocalCredentials> {
  const handle = await open(file, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & permissionBits) !== privateFileMode) {
      throw new Error("ADMIN_DEV_CREDENTIALS_REQUIRE_MODE_0600");
    }
    return parseCredentials(await handle.readFile("utf-8"));
  } finally {
    await handle.close();
  }
}

function serverOptions(): UserConfig {
  return {
    server: {
      cors: false,
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem}",
          "**/.git/**",
          "**/.dev.vars*",
          "**/.local/**",
          "**/.local-agents/**",
        ],
      },
    },
  };
}

function denied(): Response {
  return new Response("Authentication required", {
    headers: {
      "cache-control": "no-store",
      "www-authenticate": 'Basic realm="Local administrator access", charset="UTF-8"',
    },
    status: 401,
  });
}

function rejectUpgrade(socket: Duplex): void {
  socket.end(
    'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nCache-Control: no-store\r\nWWW-Authenticate: Basic realm="Local administrator access"\r\nContent-Length: 0\r\n\r\n',
  );
}

function trustedSource(source: RequestSource, appOrigin: string): boolean {
  return (
    loopbackAddresses.has(source.remoteAddress ?? "") &&
    source.host === new URL(appOrigin).host &&
    (source.origin === undefined || source.origin === appOrigin) &&
    (!source.websocket || source.origin === appOrigin)
  );
}

function forwardedHeaders(authorization: string | undefined, cookie: string | undefined): Headers {
  const headers = new Headers();
  if (authorization !== undefined && authorization !== "") {
    headers.set("authorization", authorization);
  }
  if (cookie !== undefined && cookie !== "") {
    headers.set("cookie", cookie);
  }
  return headers;
}

function createAuthorizer(credentials: LocalCredentials): Authorize {
  return async (request, websocket) => {
    const { authorization, cookie, host, origin } = request.headers;
    const { remoteAddress } = request.socket;
    if (!trustedSource({ host, origin, remoteAddress, websocket }, credentials.APP_ORIGIN)) {
      return denied();
    }
    const target = new URL(request.url ?? "/", credentials.APP_ORIGIN);
    return enforceAdminAccess(
      new Request(target, { headers: forwardedHeaders(authorization, cookie) }),
      credentials,
    );
  };
}

async function sendRejection(response: ServerResponse, rejection: Response): Promise<void> {
  response.statusCode = rejection.status;
  for (const [name, value] of rejection.headers) {
    response.setHeader(name, value);
  }
  response.end(await rejection.text());
}

async function appendLocalAccessCookie(
  response: ServerResponse,
  credentials: LocalCredentials,
): Promise<void> {
  const cookie = await localAccessCookie(credentials);
  if (cookie !== undefined) {
    response.appendHeader("set-cookie", cookie);
  }
}

function failClosed(response: ServerResponse): void {
  response.statusCode = 401;
  response.end("Authentication required");
}

function createRequestGuard(
  credentials: LocalCredentials,
  authorize: Authorize,
): Connect.NextHandleFunction {
  return (request, response, next) => {
    async function guard(): Promise<void> {
      response.setHeader("cache-control", "no-store");
      response.setHeader("cross-origin-resource-policy", "same-origin");
      try {
        const rejection = await authorize(request, false);
        if (rejection === undefined) {
          await appendLocalAccessCookie(response, credentials);
          next();
          return;
        }
        await sendRejection(response, rejection);
      } catch {
        failClosed(response);
      }
    }
    void guard();
  };
}

function guardUpgrades(httpServer: HttpServer, authorize: Authorize): void {
  const handlers = httpServer.rawListeners("upgrade");
  httpServer.removeAllListeners("upgrade");
  async function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    try {
      const rejection = await authorize(request, true);
      if (rejection !== undefined) {
        rejectUpgrade(socket);
        return;
      }
      if (handlers.length === 0) {
        socket.destroy();
        return;
      }
      await Promise.all(
        handlers.map(async (handler) => {
          await handler.call(httpServer, request, socket, head);
        }),
      );
    } catch {
      socket.destroy();
    }
  }
  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on("error", () => {
      socket.destroy();
    });
    void handleUpgrade(request, socket, head);
  });
  httpServer.on("newListener", (event: string | symbol) => {
    if (event === "upgrade") {
      throw new Error("ADMIN_DEV_UNGUARDED_UPGRADE_LISTENER_DENIED");
    }
  });
}

export function adminDevAccess(credentialsFile = new URL(".dev.vars", import.meta.url)): Plugin {
  return {
    apply: (_config, environment) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: serverOptions,
    configResolved(config) {
      const { server } = config;
      if (
        !["localhost", "127.0.0.1", "::1"].includes(String(server.host)) ||
        server.https ||
        server.middlewareMode !== false ||
        server.proxy ||
        (server.ws !== false && ((server.ws?.port ?? 0) !== 0 || server.ws?.server !== undefined))
      ) {
        throw new Error("ADMIN_DEV_REQUIRES_LOCAL_SINGLE_HTTP_SERVER");
      }
    },
    async configureServer(server) {
      const credentials = await readCredentials(credentialsFile);
      const { httpServer } = server;
      if (!httpServer) {
        throw new Error("ADMIN_DEV_HTTP_SERVER_REQUIRED");
      }
      const authorize = createAuthorizer(credentials);
      server.middlewares.use(createRequestGuard(credentials, authorize));
      httpServer.prependOnceListener("listening", () => {
        guardUpgrades(httpServer, authorize);
      });
    },
    enforce: "pre",
    name: "template-admin-dev-access",
  };
}
