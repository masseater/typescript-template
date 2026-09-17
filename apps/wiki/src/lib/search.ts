import { reportFailure } from "@template/observability";
import type { WikiServices } from "@template/runtime/wiki";
import { Embedder } from "@template/runtime/wiki";
import { Cause, Context, Effect } from "effect";
import { llms } from "fumadocs-core/source";
import { createFromSource } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import type { SearchServer } from "fumadocs-core/search/server";
import { createSemanticIndex, rankPages } from "./semantic.ts";
import type { SemanticDocument } from "./semantic.ts";
import { source } from "./source.ts";

const keyword = createFromSource(source);
const semantic = createSemanticIndex(() =>
  source.getPages().flatMap((page): SemanticDocument[] => {
    const { structuredData } = page.data;
    const pageText = structuredData.contents
      .filter((content) => content.heading === undefined)
      .map((content) => content.content)
      .join(" ");
    return [
      {
        id: page.url,
        url: page.url,
        title: page.data.title ?? page.url,
        text: `${page.data.description ?? ""} ${pageText}`,
      },
      ...structuredData.headings.map((heading) => ({
        id: `${page.url}#${heading.id}`,
        url: `${page.url}#${heading.id}`,
        title: `${page.data.title ?? ""} ${heading.content}`,
        text: structuredData.contents
          .filter((content) => content.heading === heading.id)
          .map((content) => content.content)
          .join(" "),
      })),
    ];
  }),
);

export const wikiLlms = llms(source, {
  renderPage: async (page) =>
    `# ${page.data.title ?? page.url} (${page.url})\n\n${await page.data.getText("processed")}`,
});

const pageOf = (url: string) => url.split("#")[0] ?? url;

type SearchOptions = Parameters<SearchServer["search"]>[1];

export const searchWiki = Effect.fn("searchWiki")(function* (
  query: string,
  options?: SearchOptions,
) {
  const embedder = yield* Embedder;
  const [keywordResults, semanticResults] = yield* Effect.all(
    [
      Effect.promise(() => keyword.search(query, options)),
      embedder.available
        ? semantic(query).pipe(
            Effect.catch((error) => reportFailure(Cause.fail(error)).pipe(Effect.as([]))),
          )
        : Effect.succeed([]),
    ],
    { concurrency: "unbounded" },
  );
  const pages = rankPages(
    semanticResults.map((match) => ({ url: pageOf(match.document.url), score: match.score })),
    [...new Set(keywordResults.map((result) => pageOf(result.url)))],
    options?.limit ?? 5,
  );
  return pages.flatMap((url): SortedResult[] => {
    const page = source.getPages().find((candidate) => candidate.url === url);
    const title = page?.data.title ?? url;
    const lexical = keywordResults.filter(
      (result) => pageOf(result.url) === url && result.type !== "page",
    );
    const related = semanticResults
      .filter(
        (match) =>
          pageOf(match.document.url) === url &&
          match.document.url !== url &&
          !lexical.some((result) => result.url === match.document.url),
      )
      .sort((left, right) => right.score - left.score)
      .map((match): SortedResult => ({
        id: match.document.id,
        url: match.document.url,
        type: "heading",
        content: match.document.title.slice(title.length).trim(),
      }));
    return [
      { id: url, url, type: "page", content: title },
      ...[...lexical.slice(0, 2), ...related].slice(0, 3),
    ];
  });
});

export const searchServer = (context: Context.Context<WikiServices>): SearchServer => ({
  export: () => keyword.export(),
  search: (query, options) => Effect.runPromiseWith(context)(searchWiki(query, options)),
});
