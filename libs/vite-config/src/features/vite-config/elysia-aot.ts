import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { aot } from "elysia/plugin/aot/vite";

import { load, resolve } from "./cloudflare-workers-loader.ts";
import { paths } from "./host.ts";

import type { Plugin } from "vite-plus";

const elysiaEntry = fileURLToPath(import.meta.resolve("elysia"));

registerHooks({ load, resolve });

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

const jitCompile =
  'return new Function("h", fullAlias, `return ${code}`)(handler, ...paramValues);';
const jitWithoutEval = `try {
		return new Function("h", fullAlias, \`return \${code}\`)(handler, ...paramValues);
	} catch {
		const routeHandler = handler;
		const routeHook = hook;
		const mapResponse = responseMap;
		return (context) => {
			const run = async () => {
				if (
					context.request.method !== "GET" &&
					context.request.method !== "HEAD" &&
					context.request.headers.get("content-type")?.includes("json") === true
				) {
					context.body = await context.request.clone().json();
				}
				const befores = routeHook?.beforeHandle;
				if (befores !== undefined) {
					for (const hookFn of Array.isArray(befores) ? befores : [befores]) {
						const early = await hookFn(context);
						if (early !== undefined) {
							return mapResponse(early, context.set, context.request, true);
						}
					}
				}
				return mapResponse(await routeHandler(context), context.set, context.request, true);
			};
			return run();
		};
	}`;

const elysiaWorkerdJit = (): Plugin => ({
  applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name !== "client",
  enforce: "pre",
  name: "elysia-workerd-jit",
  transform: (code: string, moduleUrl: string): { code: string; map: null } | undefined => {
    if (!moduleUrl.includes("/elysia/") || !moduleUrl.includes("/compile/handler/jit.")) {
      return undefined;
    }
    if (!code.includes(jitCompile)) {
      return undefined;
    }
    return { code: code.replace(jitCompile, jitWithoutEval), map: null };
  },
});

export { elysiaAot, elysiaWorkerdJit };
