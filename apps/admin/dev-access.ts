import { open } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { parseEnv } from "node:util";
import { Effect, Result, Schema } from "effect";
import type { Plugin } from "vite-plus";
import { enforceAdminAccess, localAccessCookie } from "./src/access.ts";

const Credentials = Schema.Struct({
  APP_ORIGIN: Schema.String.check(Schema.makeFilter((value: string) => URL.canParse(value))),
  LOCAL_ADMIN_USER: Schema.String.check(Schema.isMinLength(1)),
  LOCAL_ADMIN_PASSWORD: Schema.String.check(Schema.isMinLength(24)),
});

async function readCredentials(file: URL) {
  const handle = await open(file, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o777) !== 0o600)
      throw new Error("ADMIN_DEV_CREDENTIALS_REQUIRE_MODE_0600");
    const parsed = Schema.decodeUnknownResult(Credentials)(parseEnv(await handle.readFile("utf8")));
    if (Result.isFailure(parsed)) throw new Error("ADMIN_DEV_CREDENTIALS_INVALID");
    const origin = new URL(parsed.success.APP_ORIGIN);
    if (
      origin.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
      origin.origin !== parsed.success.APP_ORIGIN
    )
      throw new Error("ADMIN_DEV_ORIGIN_MUST_BE_LOCAL_HTTP");
    return parsed.success;
  } finally {
    await handle.close();
  }
}

function denied() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": 'Basic realm="Local administrator access", charset="UTF-8"',
    },
  });
}

function rejectUpgrade(socket: Duplex) {
  socket.end(
    'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nCache-Control: no-store\r\nWWW-Authenticate: Basic realm="Local administrator access"\r\nContent-Length: 0\r\n\r\n',
  );
}

export function adminDevAccess(credentialsFile = new URL(".dev.vars", import.meta.url)): Plugin {
  return {
    name: "template-admin-dev-access",
    apply: (_config, environment) => environment.command === "serve" && !environment.isPreview,
    enforce: "pre",
    config() {
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
    },
    configResolved(config) {
      const { server } = config;
      if (
        !["localhost", "127.0.0.1", "::1"].includes(String(server.host)) ||
        server.https ||
        server.middlewareMode ||
        server.proxy ||
        (server.ws !== false && (server.ws?.port || server.ws?.server))
      )
        throw new Error("ADMIN_DEV_REQUIRES_LOCAL_SINGLE_HTTP_SERVER");
    },
    async configureServer(server) {
      const credentials = await readCredentials(credentialsFile);
      const expectedHost = new URL(credentials.APP_ORIGIN).host;
      const httpServer = server.httpServer;
      if (!httpServer) throw new Error("ADMIN_DEV_HTTP_SERVER_REQUIRED");
      const authorize = async (request: IncomingMessage, websocket = false) => {
        const origin = request.headers.origin;
        if (
          !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "") ||
          request.headers.host !== expectedHost ||
          (origin !== undefined && origin !== credentials.APP_ORIGIN) ||
          (websocket && origin !== credentials.APP_ORIGIN)
        )
          return denied();
        const headers = new Headers();
        if (request.headers.authorization)
          headers.set("authorization", request.headers.authorization);
        if (request.headers.cookie) headers.set("cookie", request.headers.cookie);
        return Effect.runPromise(
          enforceAdminAccess(
            new Request(new URL(request.url ?? "/", credentials.APP_ORIGIN), { headers }),
            credentials,
          ),
        );
      };
      const handleRequest = async (
        request: IncomingMessage,
        response: ServerResponse,
        next: () => void,
      ) => {
        response.setHeader("cache-control", "no-store");
        response.setHeader("cross-origin-resource-policy", "same-origin");
        try {
          const rejection = await authorize(request);
          if (!rejection) {
            const cookie = await Effect.runPromise(localAccessCookie(credentials));
            if (cookie) response.appendHeader("set-cookie", cookie);
            next();
            return;
          }
          response.statusCode = rejection.status;
          rejection.headers.forEach((value, name) => response.setHeader(name, value));
          response.end(await rejection.text());
        } catch {
          response.statusCode = 401;
          response.end("Authentication required");
        }
      };
      server.middlewares.use((request, response, next) => {
        void handleRequest(request, response, next);
      });
      httpServer.prependOnceListener("listening", () => {
        const handlers = httpServer.rawListeners("upgrade");
        httpServer.removeAllListeners("upgrade");
        const handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          socket.on("error", () => socket.destroy());
          try {
            const rejection = await authorize(request, true);
            if (rejection) {
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
        };
        httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          void handleUpgrade(request, socket, head);
        });
        httpServer.on("newListener", (event: string | symbol) => {
          if (event === "upgrade") throw new Error("ADMIN_DEV_UNGUARDED_UPGRADE_LISTENER_DENIED");
        });
      });
    },
  };
}
