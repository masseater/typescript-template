import { llms } from "fumadocs-core/source";
import { createFromSource } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import type { SearchServer } from "fumadocs-core/search/server";
import { createSemanticIndex, exactMatchesFirst, rankPages } from "./semantic.ts";
import type { Embedder, SemanticDocument } from "./semantic.ts";
import { source } from "./source.ts";

const keyword = createFromSource(source);
const semantic = createSemanticIndex(async () =>
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

let processedTexts: Promise<Map<string, string>> | undefined;
const loadProcessedTexts = () =>
  (processedTexts ??= Promise.all(
    source
      .getPages()
      .map(async (page) => [page.url, await page.data.getText("processed")] as const),
  )
    .then((entries) => new Map(entries))
    .catch((error: unknown) => {
      processedTexts = undefined;
      throw error;
    }));

export function createWikiSearch(
  embed: Embedder | null,
  reportError: (error: unknown) => void,
): SearchServer {
  return {
    export: () => keyword.export(),
    async search(query, options) {
      const [keywordResults, texts, semanticResults] = await Promise.all([
        keyword.search(query, options),
        loadProcessedTexts(),
        embed
          ? semantic(embed, query).catch((error: unknown) => {
              reportError(error);
              return [];
            })
          : [],
      ]);
      const pages = rankPages(
        semanticResults.map((match) => ({
          url: pageOf(match.document.url),
          score: match.score,
        })),
        exactMatchesFirst(
          query,
          [...new Set(keywordResults.map((result) => pageOf(result.url)))],
          (url) => texts.get(url) ?? "",
        ),
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
    },
  };
}
