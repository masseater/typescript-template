import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applications as apps, type Application as App } from "@template/config";

import type { ConfigEnv, Connect, Plugin, ResolvedConfig, UserConfig } from "vite-plus";

const forbiddenStatus = 403;
const badRequestStatus = 400;

const otherApps = (app: App): App[] => {
  return apps.filter((name) => name !== app);
};

const privateAdminPath = (normalized: string, app: App): boolean => {
  return (
    app !== "admin" &&
    (/(?:^|\/)libs\/db\/src\/admin(?:\.[^/]*)?$/u.test(normalized) ||
      /@template\/db\/admin(?:\/|$)/u.test(normalized))
  );
};

type BoundaryRoots = {
  readonly app: App;
  readonly appRoot: string;
  readonly canonicalRepository: string;
  readonly repository: string;
};

const privatePath = (
  value: string,
  roots: Readonly<Pick<BoundaryRoots, "app">>,
  repository: string,
): boolean => {
  const normalized = value.replaceAll("\\", "/");
  const relative = path.relative(repository, normalized).replaceAll("\\", "/");
  const others = otherApps(roots.app).join("|");
  return (
    /^(?:infra|tools)(?:\/|$)/u.test(relative) ||
    new RegExp(`(?:^|/)apps/(?:${others})(?:/|$)`, "u").test(normalized) ||
    new RegExp(`@template/(?:${others})(?:/|$)`, "u").test(normalized) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)libs\/db\/src\/(?:remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|[^/]*\.(?:pem|key))$/u.test(
      normalized,
    ) ||
    /@template\/db\/(?:remote|testing)(?:\/|$)/u.test(normalized) ||
    privateAdminPath(normalized, roots.app)
  );
};

const serverOptions = (app: App, appRoot: string, repository: string): UserConfig => {
  return {
    server: {
      cors: false,
      fs: {
        allow: [appRoot, path.join(repository, "libs"), path.join(repository, "node_modules")],
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem,key}",
          "**/.git/**",
          "**/.dev.vars*",
          "**/.local/**",
          "**/.local-agents/**",
          ...otherApps(app).map((name) => `**/apps/${name}/**`),
          ...(app === "admin" ? [] : ["**/libs/db/src/admin.*"]),
          "**/libs/db/src/remote*",
          "**/libs/db/src/bootstrap*",
          "**/libs/db/src/testing.*",
          "**/infra/**",
          "**/tools/**",
        ],
        strict: true,
      },
    },
  };
};

const maxDecodeDepth = 3;

const decodedPathname = (url: string | undefined): string => {
  let [pathname = "/"] = (url ?? "/").split("?");
  for (let depth = 0; depth < maxDecodeDepth; depth += 1) {
    const decoded = decodeURIComponent(pathname);
    if (decoded === pathname) {
      break;
    }
    pathname = decoded;
  }
  return pathname;
};

const deniesRequest = async (url: string | undefined, roots: BoundaryRoots): Promise<boolean> => {
  const pathname = decodedPathname(url);
  const file = pathname.startsWith("/@fs/")
    ? pathname.slice("/@fs".length)
    : path.resolve(roots.appRoot, `.${pathname}`);
  const resolved = await realpath(file).catch(() => file);
  return (
    privatePath(pathname, roots, roots.repository) ||
    privatePath(file, roots, roots.repository) ||
    privatePath(resolved, roots, roots.canonicalRepository)
  );
};

type DevRequest = Parameters<Connect.NextHandleFunction>[0];
type DevResponse = Parameters<Connect.NextHandleFunction>[1];

const createRequestGuard = (
  roots: () => BoundaryRoots,
): ((
  request: Readonly<Pick<DevRequest, "url">>,
  response: Readonly<Pick<DevResponse, "end" | "writeHead">>,
  next: () => void,
) => void) => {
  return (request, response, next) => {
    const guard = async (): Promise<void> => {
      try {
        if (!(await deniesRequest(request.url, roots()))) {
          next();
          return;
        }
        response.writeHead(forbiddenStatus, { "cache-control": "no-store" });
        response.end("Private development resource denied");
      } catch {
        response.writeHead(badRequestStatus);
        response.end("Invalid request");
      }
    };
    void guard();
  };
};

const devBoundary = (
  app: App,
  repository = fileURLToPath(new URL("../../../", import.meta.url)),
): Plugin => {
  let appRoot = path.join(repository, "apps", app);
  let canonicalRepository = repository;
  return {
    apply: (_config: unknown, environment: Readonly<ConfigEnv>) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: () => serverOptions(app, appRoot, repository),
    async configResolved(
      config: Readonly<{ root: string; server: Readonly<Pick<ResolvedConfig["server"], "host">> }>,
    ) {
      appRoot = config.root;
      canonicalRepository = await realpath(repository);
      if (!["127.0.0.1", "localhost", "::1"].includes(String(config.server.host))) {
        throw new Error("DEV_SERVER_MUST_LISTEN_ON_LOOPBACK");
      }
    },
    configureServer(server: Readonly<{ middlewares: Readonly<Pick<Connect.Server, "use">> }>) {
      server.middlewares.use(
        createRequestGuard(() => ({ app, appRoot, canonicalRepository, repository })),
      );
    },
    enforce: "pre",
    async load(id) {
      const [file = ""] = id.split("?");
      if (file === "" || file.startsWith("\0")) {
        return;
      }
      const resolved = await realpath(file).catch(() => file);
      if (
        privatePath(file, { app }, repository) ||
        privatePath(resolved, { app }, canonicalRepository)
      ) {
        throw new Error("Private development module denied");
      }
    },
    name: `template-${app}-dev-boundary`,
  };
};

export { devBoundary };
