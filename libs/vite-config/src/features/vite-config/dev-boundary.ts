import { loopbackAddress, type Application } from "@repo/config";
import { repositoryRoot as defaultRepositoryRoot } from "@repo/config/repository-root";
import { Effect } from "effect";

import { filesystem, paths } from "./host.ts";
import { privatePath } from "./private-path.ts";
import { createRequestGuard, resolvePath, type RequestGuard } from "./request-guard.ts";
import { serverOptions } from "./server-options.ts";

import type { ConfigEnv, Plugin, ResolvedConfig } from "vite-plus";

const devBoundary = (application: Application, repositoryRoot = defaultRepositoryRoot): Plugin => {
  const canonicalRepositoryRoot = Effect.runPromise(filesystem.realPath(repositoryRoot));
  return {
    apply: (_config: unknown, environment: Readonly<ConfigEnv>) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: () =>
      serverOptions({
        application,
        applicationRoot: paths.join(repositoryRoot, "apps", application),
        repositoryRoot,
      }),
    configResolved(config: Readonly<{ server: Readonly<Pick<ResolvedConfig["server"], "host">> }>) {
      return Effect.runPromise(
        Effect.gen(function* requireLoopback() {
          yield* Effect.promise(() => canonicalRepositoryRoot);
          if (![loopbackAddress, "localhost", "::1"].includes(String(config.server.host))) {
            return yield* Effect.die("DEV_SERVER_MUST_LISTEN_ON_LOOPBACK");
          }
        }),
      );
    },
    configureServer(
      server: Readonly<{
        config: Readonly<Pick<ResolvedConfig, "root">>;
        middlewares: Readonly<{ use: (guard: RequestGuard) => unknown }>;
      }>,
    ) {
      server.middlewares.use(
        createRequestGuard(() =>
          Effect.runPromise(
            Effect.promise(() => canonicalRepositoryRoot).pipe(
              Effect.map((canonical) => ({
                application,
                applicationRoot: server.config.root,
                canonicalRepositoryRoot: canonical,
                repositoryRoot,
              })),
            ),
          ),
        ),
      );
    },
    enforce: "pre",
    load(moduleId) {
      return Effect.runPromise(
        Effect.gen(function* loadModule() {
          const [modulePath = ""] = moduleId.split("?");
          if (modulePath === "" || modulePath.startsWith("\0")) {
            return;
          }
          const resolved = yield* Effect.promise(() => resolvePath(modulePath));
          if (resolved.kind === "unresolvable") {
            return yield* Effect.die("Private development module denied");
          }
          const canonicalModulePath = resolved.kind === "resolved" ? resolved.path : modulePath;
          const canonicalRoot = yield* Effect.promise(() => canonicalRepositoryRoot);
          if (
            privatePath({ application, candidatePath: modulePath, repositoryRoot }) ||
            privatePath({
              application,
              candidatePath: canonicalModulePath,
              repositoryRoot: canonicalRoot,
            })
          ) {
            return yield* Effect.die("Private development module denied");
          }
        }),
      );
    },
    name: `template-${application}-dev-boundary`,
  };
};

export { devBoundary };
