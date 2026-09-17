import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite-plus";

function privatePath(value: string, repository: string): boolean {
  const normalized = value.replaceAll("\\", "/");
  const relative = path.relative(repository, normalized).replaceAll("\\", "/");
  return (
    /^(?:infra|internal)(?:\/|$)/.test(relative) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)apps\/admin(?:\/|$)|(?:^|\/)packages\/db\/src\/(?:admin|remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|[^/]*\.(?:pem|key))$/.test(
      normalized,
    ) ||
    /@template\/(?:admin(?:\/|$)|db\/(?:admin|remote|testing)(?:\/|$))/.test(normalized)
  );
}

export function userDevBoundary(
  repository = fileURLToPath(new URL("../../", import.meta.url)),
): Plugin {
  let appRoot = path.join(repository, "apps/user");
  let canonicalRepository = repository;
  return {
    name: "template-user-dev-boundary",
    enforce: "pre",
    apply: (_config, environment) => environment.command === "serve" && !environment.isPreview,
    config() {
      return {
        server: {
          cors: false,
          fs: {
            strict: true,
            allow: [
              appRoot,
              path.join(repository, "packages"),
              path.join(repository, "node_modules"),
            ],
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem,key}",
              "**/.git/**",
              "**/.dev.vars*",
              "**/.local/**",
              "**/.local-agents/**",
              "**/apps/admin/**",
              "**/packages/db/src/admin.*",
              "**/packages/db/src/remote*",
              "**/packages/db/src/bootstrap*",
              "**/packages/db/src/testing.*",
              "**/infra/**",
              "**/internal/**",
            ],
          },
        },
      };
    },
    async configResolved(config) {
      appRoot = config.root;
      canonicalRepository = await realpath(repository);
      if (!["127.0.0.1", "localhost", "::1"].includes(String(config.server.host)))
        throw new Error("USER_DEV_REQUIRES_LOCAL_SERVER");
    },
    async load(id) {
      const file = id.split("?")[0];
      if (!file || file.startsWith("\0")) return undefined;
      const resolved = await realpath(file).catch(() => file);
      if (privatePath(file, repository) || privatePath(resolved, canonicalRepository))
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
            privatePath(pathname, repository) ||
            privatePath(file, repository) ||
            privatePath(resolved, canonicalRepository)
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
