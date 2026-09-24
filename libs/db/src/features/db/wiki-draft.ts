import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { clockDate } from "./clock-date.ts";
import { query } from "./database.ts";
import { wikiDraft } from "./schema.ts";
import { WikiDraftConflict } from "./wiki-draft-conflict.ts";

const draftColumns = {
  baseRevision: wikiDraft.baseRevision,
  markdown: wikiDraft.markdown,
  path: wikiDraft.path,
  updatedAt: wikiDraft.updatedAt,
  version: wikiDraft.version,
};

export const findWikiDraft = Effect.fn("findWikiDraft")(function* findWikiDraft(path: string) {
  const [draft] = yield* query((database) =>
    database.select(draftColumns).from(wikiDraft).where(eq(wikiDraft.path, path)).limit(1),
  );
  return draft;
});

export const saveWikiDraft = Effect.fn("saveWikiDraft")(function* saveWikiDraft(draft: {
  readonly baseRevision: string | null;
  readonly markdown: string;
  readonly path: string;
  readonly updatedBy: string;
  readonly version: number;
}) {
  const updatedAt = yield* clockDate;
  const { baseRevision, markdown, path, updatedBy, version } = draft;
  const [saved] = yield* query((database) =>
    version === 0
      ? database
          .insert(wikiDraft)
          .values({ baseRevision, markdown, path, updatedAt, updatedBy })
          .onConflictDoNothing()
          .returning({ version: wikiDraft.version })
      : database
          .update(wikiDraft)
          .set({ markdown, updatedAt, updatedBy, version: version + 1 })
          .where(and(eq(wikiDraft.path, path), eq(wikiDraft.version, version)))
          .returning({ version: wikiDraft.version }),
  );
  if (saved === undefined) {
    return yield* new WikiDraftConflict();
  }
  return saved.version;
});

export const discardWikiDraft = Effect.fn("discardWikiDraft")(function* discardWikiDraft(
  path: string,
  version: number,
) {
  const [discarded] = yield* query((database) =>
    database
      .delete(wikiDraft)
      .where(and(eq(wikiDraft.path, path), eq(wikiDraft.version, version)))
      .returning({ path: wikiDraft.path }),
  );
  if (discarded === undefined) {
    return yield* new WikiDraftConflict();
  }
});

export { WikiDraftConflict } from "./wiki-draft-conflict.ts";
