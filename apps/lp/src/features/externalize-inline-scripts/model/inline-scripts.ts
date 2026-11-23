import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { Array as Arr, Effect, FileSystem, Layer, Option, Path, String as Str, pipe } from "effect";
import type { Plugin } from "vite-plus";

import { SCRIPT_DIR, externalize } from "./externalize-scripts.ts";

const externalizeFile = Effect.fn("externalizeFile")(function* externalizeFile(
  outDir: string,
  file: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(outDir, file);
  const { html, scripts } = yield* externalize({
    html: yield* fileSystem.readFileString(target),
    file,
  });
  yield* Effect.forEach(
    scripts,
    ({ src, code }) => fileSystem.writeFileString(path.join(outDir, src), code),
    { concurrency: 1 },
  );
  yield* fileSystem.writeFileString(target, html);
});

const externalizeAll = Effect.fn("externalizeAll")(function* externalizeAll(
  root: string,
  outDir: string,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(root, outDir);
  yield* fileSystem.makeDirectory(path.join(directory, SCRIPT_DIR), { recursive: true });
  const entries = yield* fileSystem.readDirectory(directory, { recursive: true });
  const files = pipe(entries, Arr.filter(Str.endsWith(".html")));
  yield* Effect.forEach(files, (file) => externalizeFile(directory, file), { concurrency: 1 });
});

const runInNode = (root: string, outDir: string): Promise<void> =>
  Effect.runPromise(
    Layer.build(nodeServices).pipe(
      Effect.flatMap((context) => Effect.provideContext(externalizeAll(root, outDir), context)),
      Effect.scoped,
    ),
  );

export const externalizeInlineScripts = (): Plugin => ({
  name: "externalize-inline-scripts",
  enforce: "post",
  buildApp: {
    order: "post",
    handler: ({ environments }) =>
      Option.match(Option.fromNullishOr(environments["client"]), {
        onNone: () => Promise.resolve(),
        onSome: ({ config }) => runInNode(config.root, config.build.outDir),
      }),
  },
});
