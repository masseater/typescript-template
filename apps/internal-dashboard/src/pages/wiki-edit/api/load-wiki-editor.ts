import { absent, apiDataOrNoneFor } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";
import { Effect } from "effect";

import { wikiClient } from "#shared/api/index.ts";
import { WikiSource } from "#shared/contracts/index.ts";
import { readWikiDocument } from "#shared/wiki-document/index.ts";

import type { WikiEditorData } from "#pages/wiki-edit/model/wiki-editor-data.ts";

function loadWikiEditor(path: string): Promise<WikiEditorData> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api["wiki-edit"].source.get({ query: { path } }).then((response) => {
      const source = apiDataOrNoneFor(absent.notFound)(WikiSource, response);
      if (source === undefined) {
        throw notFound();
      }
      return Effect.runPromise(
        readWikiDocument(source.markdown).pipe(Effect.map((document) => ({ document, source }))),
      );
    }),
  );
}

export { loadWikiEditor };
