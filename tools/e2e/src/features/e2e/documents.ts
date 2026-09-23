import { Effect, FileSystem, Path } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";
import { applicationRoot } from "./repository.ts";

import type { Application } from "@repo/config";

const markdown = /\.mdx?$/u;
const minimumPages = 2;

const documentPaths = (
  application: Application,
): Effect.Effect<readonly string[], JourneyFailure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* listDocumentPaths() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = paths.join(applicationRoot(application), "content", "docs");
    const found = yield* filesystem
      .readDirectory(root, { recursive: true })
      .pipe(Effect.mapError((cause) => failed("E2E_DOCUMENT_LIST_FAILED", cause)));
    const pages = found
      .filter((documentPath) => markdown.test(documentPath))
      .map((documentPath) =>
        paths.relative(
          root,
          paths.isAbsolute(documentPath) ? documentPath : paths.join(root, documentPath),
        ),
      )
      .map((file) => `/wiki/${file.replace(markdown, "").replace(/\/index$/u, "")}`)
      .toSorted();
    if (pages.length < minimumPages) {
      return yield* failed("E2E_NOT_ENOUGH_DOCUMENT_PAGES");
    }
    return pages;
  });

export { documentPaths };
