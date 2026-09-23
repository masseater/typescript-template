import { apiData } from "@repo/runtime/client";
import { Encoding } from "effect";

import { wikiClient } from "#shared/api/index.ts";
import { WikiDraftSaved, WikiImageUploaded, WikiSource } from "#shared/contracts/index.ts";

import type { wikiImageTypes } from "#shared/contracts/index.ts";

type DraftSave = Readonly<{
  baseRevision: string | null;
  markdown: string;
  path: string;
  version: number;
}>;

function saveDraft(draft: DraftSave): Promise<number> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api["wiki-edit"].draft.put(draft).then((response) => apiData(WikiDraftSaved, response).version),
  );
}

function discardDraft(path: string, version: number): Promise<void> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api["wiki-edit"].draft.delete({ path, version }).then((response) => {
      apiData(WikiSource, response);
    }),
  );
}

function uploadImage(
  file: Readonly<{ arrayBuffer: () => Promise<ArrayBuffer> }>,
  contentType: (typeof wikiImageTypes)[number],
): Promise<string> {
  return file
    .arrayBuffer()
    .then((buffer) =>
      Promise.resolve(wikiClient()).then(({ api }) =>
        api["wiki-edit"].images
          .post({ bytes: Encoding.encodeBase64(new Uint8Array(buffer)), contentType })
          .then((response) => apiData(WikiImageUploaded, response).url),
      ),
    );
}

export { discardDraft, saveDraft, uploadImage };
