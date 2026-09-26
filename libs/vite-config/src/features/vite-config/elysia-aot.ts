import { registerHooks } from "node:module";

import { Effect, Ref, Result, Schema } from "effect";
import { aot } from "elysia/plugin/aot/vite";

import { load, resolve } from "./cloudflare-workers-loader.ts";
import { paths } from "./host.ts";

import type { Plugin } from "vite-plus";

const elysiaEntry = Effect.runSync(paths.fromFileUrl(new URL(import.meta.resolve("elysia"))));

registerHooks({ load, resolve });

class AotStartFailed extends Schema.TaggedError<AotStartFailed>()("AotStartFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  message: Schema.String,
}) {}

const elysiaAot = (appRoot: string): Plugin => {
  const compiled = aot(paths.join(appRoot, "src/shared/server-api/server-app.ts"), {
    strip: true,
    target: "workerd",
  });
  const { apply: _buildOnly, ...hooks } = compiled;
  void _buildOnly;
  const startFailure = Ref.makeUnsafe<AotStartFailed | undefined>(undefined);
  const start = (): Promise<void> =>
    Effect.runPromise(
      Effect.gen(function* captureStart() {
        yield* Ref.set(startFailure, undefined);
        const compiledStart = yield* Effect.result(
          Effect.tryPromise({
            try: () => Promise.resolve(compiled.buildStart()),
            catch: (cause) =>
              new AotStartFailed({
                cause,
                message: cause instanceof Error ? cause.message : String(cause),
              }),
          }),
        );
        if (Result.isFailure(compiledStart)) {
          yield* Ref.set(startFailure, compiledStart.failure);
        }
      }),
    );
  return {
    ...hooks,
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    buildStart: start,
    buildEnd: (): void | Promise<void> => {
      const failure = Ref.getUnsafe(startFailure);
      if (failure !== undefined) {
        return Promise.reject(failure);
      }
      hooks.buildEnd();
    },
    configureServer: start,
    resolveId: (specifier: string): string | undefined => {
      if (specifier === "elysia") {
        return elysiaEntry;
      }
      return compiled.resolveId(specifier);
    },
    transform: (code: string, moduleUrl: string) => compiled.transform(code, moduleUrl),
  };
};

const jitCompile =
  'return new Function("h", fullAlias, `return ${code}`)(handler, ...paramValues);';
const jitWithoutEval = `try {
		return new Function("h", fullAlias, \`return \${code}\`)(handler, ...paramValues);
	} catch (evalRefusal) {
		if (!(evalRefusal instanceof EvalError)) {
			throw evalRefusal;
		}
		const unrunPhases = Object.entries({
			afterHandle: hasAfterHandle,
			afterResponse: hasAfterResponse,
			cookie: cookieConfig !== undefined && cookieConfig !== null,
			derive: hasDeriveDispose || (hook?.["~deriveEntries"]?.length ?? 0) > 0,
			mapResponse: hasMapResponse,
			parse: hasBody,
			trace: hasTrace,
			transform: (hook?.transform?.length ?? 0) > 0,
			validation:
				hasResponseValidator ||
				[vali?.body, vali?.query, vali?.params, vali?.headers, vali?.cookie].some(
					(validator) => validator !== undefined && validator !== null,
				),
		})
			.filter(([, present]) => present)
			.map(([phase]) => phase);
		if (unrunPhases.length > 0) {
			throw new Error(
				\`[elysia-workerd-jit] \${method} \${path} needs \${unrunPhases.join(", ")}, which the eval-free route does not run\`,
				{ cause: evalRefusal },
			);
		}
		const routeHandler = handler;
		const beforeHandles = hook?.beforeHandle === undefined ? [] : [hook.beforeHandle].flat();
		const errorHooks = hook?.error === undefined ? [] : [hook.error].flat();
		const reply = (value, context) => responseMap(value, context.set, context.request, true);
		const settle = async (context) => {
			if (responseMode === "set-with-default-headers" && inference.set) {
				materializeSetHeaders(context.set);
			}
			if (inference.query) {
				context.query = parseQueryFromURL(context.request.url, context.qi);
			}
			if (inference.headers) {
				context.headers = Object.fromEntries(context.request.headers);
			}
			if (inference.route) {
				context.route = path;
			}
			if (beforeHandlePrefix) {
				const early = await runBeforeHandlePrefixAsync(beforeHandlePrefix, context);
				if (early !== undefined) {
					return early;
				}
			}
			for (const beforeHandle of beforeHandles) {
				const early = await beforeHandle(context);
				if (early !== undefined) {
					return early;
				}
			}
			if (isHandleFunction) {
				return routeHandler(context);
			}
			if (isStaticResponse) {
				return cloneResponse(routeHandler);
			}
			if (isPromiseHandler) {
				return routeHandler.then(cloneResponse);
			}
			return routeHandler;
		};
		const recover = async (context, error) => {
			if (errorHooks.length === 0) {
				return finalizeRouteError(errorRoot, context, error);
			}
			context.error = error;
			if (error?.status) {
				context.set.status = error.status;
			} else if (context.set.status === undefined || context.set.status === 200) {
				context.set.status = 500;
			}
			for (const errorHook of errorHooks) {
				const handled = await errorHook(context);
				if (handled !== undefined) {
					if (handled instanceof Response) {
						context.set.status = handled.status;
					} else if (context.set.status === undefined || context.set.status === 200) {
						context.set.status = 500;
					}
					return reply(workerdAdoptErrorType(handled, error), context);
				}
			}
			return fallbackResponse(context, error, (value, set, fallbackContext) =>
				responseMap(value, set, fallbackContext.request, true),
			);
		};
		return async (context) => {
			try {
				const settled = await settle(context);
				if (settled instanceof Error) {
					throw settled;
				}
				return await reply(settled, context);
			} catch (error) {
				try {
					return await recover(context, error);
				} catch (unrecovered) {
					return finalizeRouteError(errorRoot, context, unrecovered);
				}
			}
		};
	}`;

const adoptErrorTypeImport =
  'import { adoptErrorType as workerdAdoptErrorType } from "../../handler/error.mjs";\n';

const jitModule = /\/elysia\/dist\/compile\/handler\/jit\.mjs(?:\?|$)/u;

const elysiaWorkerdJit = (): Plugin => ({
  applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name !== "client",
  enforce: "pre",
  name: "elysia-workerd-jit",
  transform(code: string, moduleUrl: string): { code: string; map: null } | undefined {
    if (!jitModule.test(moduleUrl)) {
      return undefined;
    }
    if (!code.includes(jitCompile)) {
      return this.error(
        `elysia-workerd-jit: ${moduleUrl} no longer contains the handler compilation it replaces`,
      );
    }
    return { code: adoptErrorTypeImport + code.replace(jitCompile, jitWithoutEval), map: null };
  },
});

export { elysiaAot, elysiaWorkerdJit };
