import { Effect } from "effect";
import { Embedder } from "@template/runtime/wiki";
import type { EmbeddingFailed } from "@template/runtime/wiki";

interface SemanticDocument {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

interface SemanticMatch {
  readonly document: SemanticDocument;
  readonly score: number;
}

interface PageScore {
  readonly url: string;
  readonly score: number;
}

interface SemanticIndex {
  readonly documents: readonly SemanticDocument[];
  readonly vectors: readonly (readonly number[])[];
}

type SemanticSearch = (query: string) => Effect.Effect<SemanticMatch[], EmbeddingFailed, Embedder>;

const KEYWORD_RANK_BONUS = 0.3;

function normalize(vector: readonly number[]): number[] {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map((value) => value / length) : [...vector];
}

function similarity(vector: readonly number[], target: readonly number[]): number {
  return vector.reduce((total, value, column) => total + value * (target[column] ?? 0), 0);
}

const buildIndex = Effect.fn("buildIndex")(function* buildIndex(
  loadDocuments: () => readonly SemanticDocument[],
) {
  const { embed } = yield* Embedder;
  const documents = loadDocuments();
  const vectors = yield* embed(documents.map((document) => `${document.title}\n${document.text}`));
  const index: SemanticIndex = { documents, vectors: vectors.map((vector) => normalize(vector)) };
  return index;
});

function createSemanticIndex(loadDocuments: () => readonly SemanticDocument[]): SemanticSearch {
  const cache: { index: SemanticIndex | undefined } = { index: undefined };
  const load = Effect.suspend(() =>
    cache.index === undefined
      ? buildIndex(loadDocuments).pipe(
          Effect.tap((index) =>
            Effect.sync(() => {
              cache.index = index;
            }),
          ),
        )
      : Effect.succeed(cache.index),
  );
  return Effect.fn("semanticSearch")(function* semanticSearch(query: string) {
    const { embed } = yield* Embedder;
    const [{ documents, vectors }, [queryVector = []]] = yield* Effect.all([load, embed([query])], {
      concurrency: "unbounded",
    });
    const target = normalize(queryVector);
    return documents.map((document, index) => ({
      document,
      score: similarity(vectors[index] ?? [], target),
    }));
  });
}

function exactMatchesFirst(
  query: string,
  keywordPages: readonly string[],
  textOf: (url: string) => string,
): string[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return [...keywordPages];
  }
  const exact = keywordPages.filter((url) => textOf(url).toLowerCase().includes(needle));
  const matched = new Set(exact);
  return [...exact, ...keywordPages.filter((url) => !matched.has(url))];
}

function rankPages(
  semantic: readonly PageScore[],
  keywordPages: readonly string[],
  limit: number,
): string[] {
  const scores = new Map<string, number>();
  const values = semantic.map((match) => match.score);
  const lowest = Math.min(...values);
  const range = Math.max(...values) - lowest;
  for (const match of semantic) {
    const normalized = range > 0 ? (match.score - lowest) / range : 0;
    scores.set(match.url, Math.max(scores.get(match.url) ?? 0, normalized));
  }
  for (const [rank, url] of keywordPages.entries()) {
    scores.set(url, (scores.get(url) ?? 0) + KEYWORD_RANK_BONUS / (1 + rank));
  }
  return [...scores]
    .toSorted(
      (left: readonly [string, number], right: readonly [string, number]) => right[1] - left[1],
    )
    .slice(0, limit)
    .map(([url]: readonly [string, number]) => url);
}

export { createSemanticIndex, exactMatchesFirst, rankPages };
export type { SemanticDocument, SemanticMatch };
