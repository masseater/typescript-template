import type { Plugin, UserConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { realpath } from "node:fs/promises";

const maxDecodeDepth = 3;

interface BoundaryRoots {
  readonly appRoot: string;
  readonly canonicalRepository: string;
  readonly repository: string;
}

function privatePath(value: string, repository: string): boolean {
  const normalized = value.replaceAll("\\", "/");
  const relative = path.relative(repository, normalized).replaceAll("\\", "/");
  return (
    /^(?:infra|tools)(?:\/|$)/u.test(relative) ||
    /(?:^|\/)(?:\.local(?:-agents)?|\.git)(?:\/|$)|(?:^|\/)apps\/admin(?:\/|$)|(?:^|\/)libs\/db\/src\/(?:admin|remote[^/]*|bootstrap[^/]*|testing)(?:\.[^/]*)?$|(?:^|\/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?|[^/]*\.(?:pem|key))$/u.test(
      normalized,
    ) ||
    /@template\/(?:admin(?:\/|$)|db\/(?:admin|remote|testing)(?:\/|$))/u.test(normalized)
  );
}

function serverOptions(appRoot: string, repository: string): UserConfig {
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
          "**/apps/admin/**",
          "**/libs/db/src/admin.*",
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
}

function decodedPathname(url: string | undefined): string {
  let [pathname = "/"] = (url ?? "/").split("?");
  for (let depth = 0; depth < maxDecodeDepth; depth += 1) {
    const decoded = decodeURIComponent(pathname);
    if (decoded === pathname) {
      break;
    }
    pathname = decoded;
  }
  return pathname;
}

async function deniesRequest(url: string | undefined, roots: BoundaryRoots): Promise<boolean> {
  const pathname = decodedPathname(url);
  const file = pathname.startsWith("/@fs/")
    ? pathname.slice("/@fs".length)
    : path.resolve(roots.appRoot, `.${pathname}`);
  const resolved = await realpath(file).catch(() => file);
  return (
    privatePath(pathname, roots.repository) ||
    privatePath(file, roots.repository) ||
    privatePath(resolved, roots.canonicalRepository)
  );
}

export function userDevBoundary(
  repository = fileURLToPath(new URL("../../", import.meta.url)),
): Plugin {
  let appRoot = path.join(repository, "apps/user");
  let canonicalRepository = repository;
  return {
    apply: (_config, environment) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: () => serverOptions(appRoot, repository),
    async configResolved(config) {
      appRoot = config.root;
      canonicalRepository = await realpath(repository);
      if (!["127.0.0.1", "localhost", "::1"].includes(String(config.server.host))) {
        throw new Error("USER_DEV_REQUIRES_LOCAL_SERVER");
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        async function guard(): Promise<void> {
          try {
            if (!(await deniesRequest(request.url, { appRoot, canonicalRepository, repository }))) {
              next();
              return;
            }
            response.statusCode = 403;
            response.setHeader("cache-control", "no-store");
            response.end("Private development resource denied");
          } catch {
            response.statusCode = 400;
            response.end("Invalid request");
          }
        }
        void guard();
      });
    },
    enforce: "pre",
    async load(id) {
      const [file = ""] = id.split("?");
      if (file === "" || file.startsWith("\0")) {
        return;
      }
      const resolved = await realpath(file).catch(() => file);
      if (privatePath(file, repository) || privatePath(resolved, canonicalRepository)) {
        throw new Error("Private development module denied");
      }
    },
    name: "template-user-dev-boundary",
  };
}
