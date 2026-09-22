import { register } from "node:module";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { aot } from "elysia/plugin/aot/vite";

import { paths } from "./host.ts";

import type { Plugin } from "vite-plus";

const elysiaEntry = fileURLToPath(import.meta.resolve("elysia"));

register(new URL("./cloudflare-workers-loader.mjs", import.meta.url).href);

const elysiaAot = (appRoot: string): Plugin => {
  const compiled = aot(paths.join(appRoot, "src/shared/server-api/server-app.ts"), {
    strip: true,
    target: "workerd",
  });
  const { apply: _buildOnly, ...hooks } = compiled;
  void _buildOnly;
  const start = (): Promise<void> =>
    Effect.runPromise(
      Effect.as(
        Effect.promise(() => Promise.resolve(compiled.buildStart())),
        undefined,
      ),
    );
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
