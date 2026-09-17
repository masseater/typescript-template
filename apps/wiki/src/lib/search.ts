import { llms } from "fumadocs-core/source";
import { createFromSource } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import type { SearchServer } from "fumadocs-core/search/server";
import semanticAssets from "virtual:wiki-semantic-assets";
import { createSemanticIndex } from "./semantic.ts";
import type { SemanticDocument } from "./semantic.ts";
import { source } from "./source.ts";

type AssetFetcher = { fetch(request: Request): Promise<Response> };

const keyword = createFromSource(source);
const semantic = createSemanticIndex(semanticAssets, async () =>
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

export function createWikiSearch(fetcher: AssetFetcher, origin: string): SearchServer {
  return {
    export: () => keyword.export(),
    async search(query, options) {
      const [keywordResults, semanticResults] = await Promise.all([
        keyword.search(query, options),
        semantic(fetcher, origin, query, 50),
      ]);
      const scores = new Map<string, number>();
      for (const match of semanticResults) {
        const url = pageOf(match.document.url);
        scores.set(url, Math.max(scores.get(url) ?? 0, match.score));
      }
      [...new Set(keywordResults.map((result) => pageOf(result.url)))].forEach((url, rank) =>
        scores.set(url, (scores.get(url) ?? 0) + 0.15 / (1 + rank)),
      );
      return [...scores]
        .sort((left, right) => right[1] - left[1])
        .slice(0, options?.limit ?? 5)
        .flatMap(([url]): SortedResult[] => {
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
