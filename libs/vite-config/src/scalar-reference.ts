import { fileURLToPath } from "node:url";

import { scalarReferencePath } from "@repo/config";
import { Cause, Effect } from "effect";

import { filesystem, paths } from "./host.ts";

import type { Plugin } from "vite-plus";

const scalarReferenceEntry = fileURLToPath(import.meta.resolve("@scalar/api-reference"));
const scalarReferenceSource = paths.join(
  paths.dirname(scalarReferenceEntry),
  "browser/standalone.js",
);

const readScalarReference = (): Effect.Effect<string> =>
  filesystem.readFileString(scalarReferenceSource).pipe(Effect.orDie);

const serveScalarReference = (
  ...handlerArguments: readonly [
    unknown,
    Readonly<{
      end: (body: string) => void;
      setHeader: (name: string, value: string) => void;
    }>,
    (error?: unknown) => void,
  ]
): Promise<void> => {
  const [, serverReply, proceed] = handlerArguments;
  return Effect.runPromise(
    Effect.gen(function* writeScalarReference() {
      const source = yield* readScalarReference();
      serverReply.setHeader("content-type", "text/javascript");
      serverReply.end(source);
    }).pipe(
      Effect.catchCause((unreadReference) => {
        proceed(Cause.squash(unreadReference));
        return Effect.void;
      }),
    ),
  );
};

const scalarReference = (): Plugin => ({
  applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "client",
  configureServer(server: {
    readonly middlewares: Readonly<{
      use: (path: string, guard: typeof serveScalarReference) => unknown;
    }>;
  }) {
    server.middlewares.use(scalarReferencePath, serveScalarReference);
  },
  generateBundle() {
    const emit = (file: Readonly<{ fileName: string; source: string; type: "asset" }>): void => {
      this.emitFile(file);
    };
    return Effect.runPromise(
      readScalarReference().pipe(
        Effect.map((source) => {
          emit({ fileName: scalarReferencePath.slice(1), source, type: "asset" });
        }),
      ),
    );
  },
  name: "template-scalar-reference",
});

export { readScalarReference, scalarReference };
