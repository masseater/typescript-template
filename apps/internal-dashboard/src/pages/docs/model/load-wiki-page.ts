import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { source } from "#shared/content/index.ts";

const loadWikiPage = createServerFn({ method: "GET" })
  .validator((slugs: readonly string[]) => [...slugs])
  .handler(({ data: slugs }: Readonly<{ data: readonly string[] }>) =>
    Effect.runPromise(
      Effect.gen(function* loadPage() {
        const page = source.getPage([...slugs]);
        if (!page) {
          throw notFound();
        }
        return {
          pageTree: yield* Effect.promise(() => source.serializePageTree(source.getPageTree())),
          path: page.path,
        };
      }),
    ),
  );

export { loadWikiPage };
