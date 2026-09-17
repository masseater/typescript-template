import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite-plus";

type App = "user" | "admin" | "wiki";
const apps: readonly App[] = ["user", "admin", "wiki"];

function privatePath(value: string, repository: string, app: App): boolean {
  const normalized = value.replaceAll("\\", "/");
  const relative = path.relative(repository, normalized).replaceAll("\\", "/");
  const otherApps = apps.filter((name) => name !== app).join("|");
  return (
    /^(?:infra|tools)(?:\/|$)/.test(relative) ||
    new RegExp(`(?:^|/)apps/(?:${otherApps})(?:/|$)`).test(normalized) ||
    new RegExp(`@template/(?:${otherApps})(?:/|$)`).test(normalized) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)libs\/db\/src\/(?:remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|[^/]*\.(?:pem|key))$/.test(
      normalized,
    ) ||
    /@template\/db\/(?:remote|testing)(?:\/|$)/.test(normalized) ||
    (app !== "admin" &&
      (/(?:^|\/)libs\/db\/src\/admin(?:\.[^/]*)?$/.test(normalized) ||
        /@template\/db\/admin(?:\/|$)/.test(normalized)))
  );
}

export function devBoundary(
  app: App,
  repository = fileURLToPath(new URL("../../../", import.meta.url)),
): Plugin {
  let appRoot = path.join(repository, "apps", app);
  let canonicalRepository = repository;
  return {
    name: `template-${app}-dev-boundary`,
    enforce: "pre",
    apply: (_config, environment) => environment.command === "serve" && !environment.isPreview,
    config() {
      return {
        server: {
          cors: false,
          fs: {
            strict: true,
            allow: [appRoot, path.join(repository, "libs"), path.join(repository, "node_modules")],
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem,key}",
              "**/.git/**",
              "**/.dev.vars*",
              "**/.local/**",
              "**/.local-agents/**",
              ...apps.filter((name) => name !== app).map((name) => `**/apps/${name}/**`),
              ...(app === "admin" ? [] : ["**/libs/db/src/admin.*"]),
              "**/libs/db/src/remote*",
              "**/libs/db/src/bootstrap*",
              "**/libs/db/src/testing.*",
              "**/infra/**",
              "**/tools/**",
            ],
          },
        },
      };
    },
    async configResolved(config) {
      appRoot = config.root;
      canonicalRepository = await realpath(repository);
      if (!["127.0.0.1", "localhost", "::1"].includes(String(config.server.host)))
        throw new Error("DEV_SERVER_MUST_LISTEN_ON_LOOPBACK");
    },
    async load(id) {
      const file = id.split("?")[0];
      if (!file || file.startsWith("\0")) return undefined;
      const resolved = await realpath(file).catch(() => file);
      if (privatePath(file, repository, app) || privatePath(resolved, canonicalRepository, app))
        throw new Error("Private development module denied");
      return undefined;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const check = async () => {
          let pathname = (request.url ?? "/").split("?")[0] ?? "/";
          for (let depth = 0; depth < 3; depth++) {
            const decoded = decodeURIComponent(pathname);
            if (decoded === pathname) break;
            pathname = decoded;
          }
          const file = pathname.startsWith("/@fs/")
            ? pathname.slice("/@fs".length)
            : path.resolve(appRoot, `.${pathname}`);
          const resolved = await realpath(file).catch(() => file);
          if (
            privatePath(pathname, repository, app) ||
            privatePath(file, repository, app) ||
            privatePath(resolved, canonicalRepository, app)
          ) {
            response.statusCode = 403;
            response.setHeader("cache-control", "no-store");
            response.end("Private development resource denied");
            return;
          }
          next();
        };
        void check().catch(() => {
          response.statusCode = 400;
          response.end("Invalid request");
        });
      });
    },
  };
}
