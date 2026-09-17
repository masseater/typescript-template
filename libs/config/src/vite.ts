import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Connect, Plugin } from "vite-plus";

export function previewDevVars(appRoot: string): Plugin {
  return {
    name: "template-preview-dev-vars",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "ssr",
    async generateBundle() {
      const source = await readFile(path.join(appRoot, ".dev.vars"), "utf8").catch(
        (error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT")
            return undefined;
          throw error;
        },
      );
      if (source !== undefined) this.emitFile({ type: "asset", fileName: ".dev.vars", source });
    },
  };
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function rejectRemoteRuntimeTools(): Connect.NextHandleFunction {
  return (request, response, next) => {
    const pathname = (request.url ?? "/").split("?", 1)[0] ?? "/";
    const host = new URL(`http://${request.headers.host ?? "invalid"}`).hostname;
    if (pathname.startsWith("/cdn-cgi/") && !loopbackHosts.has(host)) {
      response.statusCode = 404;
      response.setHeader("cache-control", "no-store");
      response.end();
      return;
    }
    next();
  };
}

export function localRuntimeToolsOnLoopback(): Plugin {
  return {
    name: "template-local-runtime-tools-on-loopback",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(rejectRemoteRuntimeTools());
    },
    configurePreviewServer(server) {
      server.middlewares.use(rejectRemoteRuntimeTools());
    },
  };
}
