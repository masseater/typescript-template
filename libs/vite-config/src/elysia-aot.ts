import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aot } from "elysia/plugin/aot/vite";

import type { Plugin } from "vite-plus";

const elysiaEntry = fileURLToPath(import.meta.resolve("elysia"));

register(new URL("./cloudflare-workers-loader.mjs", import.meta.url).href);

const elysiaAot = (appRoot: string): Plugin => {
  const compiled = aot(path.join(appRoot, "src/shared/server-api/server-app.ts"), {
    strip: true,
    target: "workerd",
  });
  const { apply: _buildOnly, ...hooks } = compiled;
  void _buildOnly;
  const start = async (): Promise<void> => {
    await compiled.buildStart();
  };
  return {
    ...hooks,
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    buildStart: start,
    configureServer: start,
    resolveId: (specifier: string): string | undefined => {
      if (specifier === "elysia") {
        return elysiaEntry;
      }
      return compiled.resolveId(specifier);
    },
  };
};

export { elysiaAot };
