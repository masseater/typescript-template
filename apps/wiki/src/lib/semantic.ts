import { Embedder } from "@template/runtime/wiki";
import { Effect } from "effect";

export type SemanticDocument = { id: string; url: string; title: string; text: string };

function normalize(vector: readonly number[]) {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map((value) => value / length) : [...vector];
}

export function createSemanticIndex(loadDocuments: () => readonly SemanticDocument[]) {
  let index:
    | { readonly documents: readonly SemanticDocument[]; readonly vectors: number[][] }
    | undefined;
  const load = Effect.gen(function* () {
    if (index !== undefined) return index;
    const { embed } = yield* Embedder;
    const documents = loadDocuments();
    const vectors = yield* embed(
      documents.map((document) => `${document.title}\n${document.text}`),
    );
    index = { documents, vectors: vectors.map(normalize) };
    return index;
  });
  return Effect.fn("semanticSearch")(function* (query: string) {
    const { embed } = yield* Embedder;
    const [{ documents, vectors }, [queryVector]] = yield* Effect.all([load, embed([query])], {
      concurrency: "unbounded",
    });
    const target = normalize(queryVector ?? []);
    return documents.map((document, position) => ({
      document,
      score: (vectors[position] ?? []).reduce(
        (total, value, column) => total + value * (target[column] ?? 0),
        0,
      ),
    }));
  });
}

export function rankPages(
  semantic: readonly { url: string; score: number }[],
  keywordPages: readonly string[],
  limit: number,
) {
  const scores = new Map<string, number>();
  const values = semantic.map((match) => match.score);
  const lowest = Math.min(...values);
  const range = Math.max(...values) - lowest;
  for (const match of semantic) {
    const normalized = range > 0 ? (match.score - lowest) / range : 0;
    scores.set(match.url, Math.max(scores.get(match.url) ?? 0, normalized));
  }
  keywordPages.forEach((url, rank) => scores.set(url, (scores.get(url) ?? 0) + 0.3 / (1 + rank)));
  return [...scores]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([url]) => url);
}
