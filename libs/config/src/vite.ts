import type { Connect, Plugin } from "vite-plus";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

const NOT_FOUND = 404;
const loopbackHosts: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

async function readDevVars(appRoot: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(appRoot, ".dev.vars"), "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function previewDevVars(appRoot: string): Plugin {
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    async generateBundle() {
      const source = await readDevVars(appRoot);
      if (source !== undefined) {
        this.emitFile({ fileName: ".dev.vars", source, type: "asset" });
      }
    },
    name: "template-preview-dev-vars",
  };
}

function requestedHost(host: string | undefined): string {
  return URL.parse(`http://${host ?? "invalid"}`)?.hostname ?? "invalid";
}

function rejectRemoteRuntimeTools(): Connect.NextHandleFunction {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request, response, next) => {
    const [pathname = "/"] = (request.url ?? "/").split("?", 1);
    if (
      pathname.startsWith("/cdn-cgi/") &&
      !loopbackHosts.has(requestedHost(request.headers.host))
    ) {
      response.statusCode = NOT_FOUND;
      response.setHeader("cache-control", "no-store");
      response.end();
      return;
    }
    next();
  };
}

function localRuntimeToolsOnLoopback(): Plugin {
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    configurePreviewServer(server) {
      server.middlewares.use(rejectRemoteRuntimeTools());
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    configureServer(server) {
      server.middlewares.use(rejectRemoteRuntimeTools());
    },
    enforce: "pre",
    name: "template-local-runtime-tools-on-loopback",
  };
}

export { localRuntimeToolsOnLoopback, previewDevVars };
