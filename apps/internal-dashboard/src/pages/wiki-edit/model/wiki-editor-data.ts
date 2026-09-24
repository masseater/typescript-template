import type { WikiSource } from "#shared/contracts/index.ts";
import type { WikiDocument } from "#shared/wiki-document/index.ts";

type WikiEditorData = Readonly<{
  document: WikiDocument;
  source: WikiSource;
}>;

export type { WikiEditorData };
