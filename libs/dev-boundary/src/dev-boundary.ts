import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loopbackAddress, type Application } from "@repo/config";

import { privatePath } from "./private-path.ts";
import { createRequestGuard, resolvePath, type RequestGuard } from "./request-guard.ts";
import { serverOptions } from "./server-options.ts";

import type { ConfigEnv, Plugin, ResolvedConfig } from "vite-plus";

const devBoundary = (
  application: Application,
  repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url)),
): Plugin => {
  const canonicalRepositoryRoot = realpath(repositoryRoot);
  return {
    apply: (_config: unknown, environment: Readonly<ConfigEnv>) =>
      environment.command === "serve" && environment.isPreview !== true,
    config: () =>
      serverOptions({
        application,
        applicationRoot: path.join(repositoryRoot, "apps", application),
        repositoryRoot,
      }),
    async configResolved(
      config: Readonly<{ server: Readonly<Pick<ResolvedConfig["server"], "host">> }>,
    ) {
      await canonicalRepositoryRoot;
      if (![loopbackAddress, "localhost", "::1"].includes(String(config.server.host))) {
        throw new Error("DEV_SERVER_MUST_LISTEN_ON_LOOPBACK");
      }
    },
    configureServer(
      server: Readonly<{
        config: Readonly<Pick<ResolvedConfig, "root">>;
        middlewares: Readonly<{ use: (guard: RequestGuard) => unknown }>;
      }>,
    ) {
      server.middlewares.use(
        createRequestGuard(async () => ({
          application,
          applicationRoot: server.config.root,
          canonicalRepositoryRoot: await canonicalRepositoryRoot,
          repositoryRoot,
        })),
      );
    },
    enforce: "pre",
    async load(moduleId) {
      const [modulePath = ""] = moduleId.split("?");
      if (modulePath === "" || modulePath.startsWith("\0")) {
        return;
      }
      const resolved = await resolvePath(modulePath);
      if (resolved.kind === "unresolvable") {
        throw new Error("Private development module denied");
      }
      const canonicalModulePath = resolved.kind === "resolved" ? resolved.path : modulePath;
      if (
        privatePath({ application, candidatePath: modulePath, repositoryRoot }) ||
        privatePath({
          application,
          candidatePath: canonicalModulePath,
          repositoryRoot: await canonicalRepositoryRoot,
        })
      ) {
        throw new Error("Private development module denied");
      }
    },
    name: `template-${application}-dev-boundary`,
  };
};

export { devBoundary };
