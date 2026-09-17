import type { Embedder, SemanticDocument } from "./semantic.ts";
import { createSemanticIndex, exactMatchesFirst, rankPages } from "./semantic.ts";
import type { SearchServer } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import { createFromSource } from "fumadocs-core/search/server";
import { llms } from "fumadocs-core/source";
import { source } from "./source.ts";

type WikiPage = ReturnType<typeof source.getPages>[number];
type SemanticResult = Awaited<ReturnType<ReturnType<typeof createSemanticIndex>>>[number];
type KeywordResult = Awaited<ReturnType<SearchServer["search"]>>[number];
type StructuredData = WikiPage["data"]["structuredData"];
type WikiPageView = Readonly<{
  url: string;
  data: Readonly<
    Pick<WikiPage["data"], "description" | "title"> & {
      structuredData: Readonly<{
        contents: readonly Readonly<StructuredData["contents"][number]>[];
        headings: readonly Readonly<StructuredData["headings"][number]>[];
      }>;
    }
  >;
}>;

const DEFAULT_PAGE_LIMIT = 5;
const LEXICAL_HEADING_LIMIT = 2;
const HEADING_RESULT_LIMIT = 3;

const keyword = createFromSource(source);

function sectionText(page: WikiPageView, heading?: string): string {
  return page.data.structuredData.contents
    .filter((content) => content.heading === heading)
    .map((content) => content.content)
    .join(" ");
}

function pageDocuments(page: WikiPageView): SemanticDocument[] {
  const headings = page.data.structuredData.headings.map((heading) => ({
    id: `${page.url}#${heading.id}`,
    text: sectionText(page, heading.id),
    title: `${page.data.title} ${heading.content}`,
    url: `${page.url}#${heading.id}`,
  }));
  return [
    {
      id: page.url,
      text: `${page.data.description ?? ""} ${sectionText(page)}`,
      title: page.data.title,
      url: page.url,
    },
    ...headings,
  ];
}

const semantic = createSemanticIndex(() =>
  source.getPages().flatMap((page: WikiPageView) => pageDocuments(page)),
);

const wikiLlms = llms(source, {
  renderPage: async (
    page: Readonly<{ data: Readonly<Pick<WikiPage["data"], "getText" | "title">>; url: string }>,
  ) => `# ${page.data.title} (${page.url})\n\n${await page.data.getText("processed")}`,
});

function pageOf(url: string): string {
  return url.split("#")[0] ?? url;
}

const processedTexts: { pending: Promise<ReadonlyMap<string, string>> | undefined } = {
  pending: undefined,
};

async function readProcessedTexts(): Promise<ReadonlyMap<string, string>> {
  const entries = await Promise.all(
    source
      .getPages()
      .map(
        async (
          page: Readonly<{ data: Readonly<Pick<WikiPage["data"], "getText">>; url: string }>,
        ) => [page.url, await page.data.getText("processed")] as const,
      ),
  );
  return new Map(entries);
}

async function loadProcessedTexts(): Promise<ReadonlyMap<string, string>> {
  processedTexts.pending ??= readProcessedTexts();
  try {
    return await processedTexts.pending;
  } catch (error) {
    processedTexts.pending = undefined;
    throw error;
  }
}

function pageResults(
  url: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  keywordResults: readonly KeywordResult[],
  semanticResults: readonly SemanticResult[],
): SortedResult[] {
  const page = source
    .getPages()
    .find((candidate: Readonly<Pick<WikiPage, "url">>) => candidate.url === url);
  const title = page?.data.title ?? url;
  const lexical = keywordResults.filter(
    (result: Readonly<Pick<KeywordResult, "type" | "url">>) =>
      pageOf(result.url) === url && result.type !== "page",
  );
  const related = semanticResults
    .filter(
      (match) =>
        pageOf(match.document.url) === url &&
        match.document.url !== url &&
        !lexical.some(
          (result: Readonly<Pick<KeywordResult, "url">>) => result.url === match.document.url,
        ),
    )
    .toSorted((left, right) => right.score - left.score)
    .map((match): SortedResult => ({
      content: match.document.title.slice(title.length).trim(),
      id: match.document.id,
      type: "heading",
      url: match.document.url,
    }));
  const headings = [...lexical.slice(0, LEXICAL_HEADING_LIMIT), ...related];
  return [
    { content: title, id: url, type: "page", url },
    ...headings.slice(0, HEADING_RESULT_LIMIT),
  ];
}

async function semanticSearch(
  embed: Embedder | undefined,
  query: string,
  reportError: (error: unknown) => void,
): Promise<SemanticResult[]> {
  if (!embed) {
    return [];
  }
  try {
    return await semantic(embed, query);
  } catch (error) {
    reportError(error);
    return [];
  }
}

function createWikiSearch(
  embed: Embedder | undefined,
  reportError: (error: unknown) => void,
): SearchServer {
  return {
    export: async () => keyword.export(),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    async search(query, options) {
      const [keywordResults, texts, semanticResults] = await Promise.all([
        keyword.search(query, options),
        loadProcessedTexts(),
        semanticSearch(embed, query, reportError),
      ]);
      const keywordPages = [
        ...new Set(
          keywordResults.map((result: Readonly<Pick<KeywordResult, "url">>) => pageOf(result.url)),
        ),
      ];
      const pages = rankPages(
        semanticResults.map((match) => ({ score: match.score, url: pageOf(match.document.url) })),
        exactMatchesFirst(query, keywordPages, (url) => texts.get(url) ?? ""),
        options?.limit ?? DEFAULT_PAGE_LIMIT,
      );
      return pages.flatMap((url) => pageResults(url, keywordResults, semanticResults));
    },
  };
}

export { createWikiSearch, wikiLlms };
