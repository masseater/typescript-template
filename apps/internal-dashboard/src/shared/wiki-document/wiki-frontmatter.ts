import { Effect, Schema } from "effect";
import { parse } from "yaml";

import { WikiPageInvalid } from "./wiki-page-invalid.ts";

const frontmatterPattern = /^---\n(?<yaml>[\s\S]*?)\n---\n/u;

const decodeFrontmatter = Schema.decodeUnknownEffect(
  Schema.Struct({ description: Schema.String, title: Schema.String }),
);

const readWikiFrontmatter = Effect.fn("readWikiFrontmatter")(function* readWikiFrontmatter(
  source: string,
) {
  const frontmatter = frontmatterPattern.exec(source);
  const yaml = yield* Effect.try({
    catch: () => new WikiPageInvalid(),
    try: (): unknown => parse(frontmatter?.groups?.["yaml"] ?? ""),
  });
  const { description, title } = yield* decodeFrontmatter(yaml).pipe(
    Effect.mapError(() => new WikiPageInvalid()),
  );
  return { body: source.slice(frontmatter?.[0].length ?? 0), description, title };
});

export { readWikiFrontmatter };
