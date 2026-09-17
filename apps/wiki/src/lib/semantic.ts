export type Embedder = (texts: readonly string[]) => Promise<number[][]>;
export type SemanticDocument = { id: string; url: string; title: string; text: string };

function normalize(vector: readonly number[]) {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map((value) => value / length) : [...vector];
}

export function createSemanticIndex(loadDocuments: () => Promise<SemanticDocument[]>) {
  let ready: Promise<{ documents: SemanticDocument[]; vectors: number[][] }> | undefined;
  const load = async (embed: Embedder) => {
    const documents = await loadDocuments();
    const vectors = await embed(documents.map((document) => `${document.title}\n${document.text}`));
    return { documents, vectors: vectors.map(normalize) };
  };
  return async (embed: Embedder, query: string) => {
    ready ??= load(embed).catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    const [{ documents, vectors }, [queryVector]] = await Promise.all([ready, embed([query])]);
    if (!queryVector) throw new Error("WIKI_EMBEDDING_COUNT_MISMATCH");
    const target = normalize(queryVector);
    return documents.map((document, index) => ({
      document,
      score: (vectors[index] ?? []).reduce(
        (total, value, column) => total + value * (target[column] ?? 0),
        0,
      ),
    }));
  };
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
