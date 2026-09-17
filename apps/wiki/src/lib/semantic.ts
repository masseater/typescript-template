import { Tokenizer } from "@huggingface/tokenizers";

export type SemanticAssets = { model: string; tokenizer: string; rows: number; dimensions: number };
export type SemanticDocument = { id: string; url: string; title: string; text: string };
type AssetFetcher = { fetch(request: Request): Promise<Response> };

function createEncoder(tokenizerJson: unknown, table: ArrayBuffer, assets: SemanticAssets) {
  if (table.byteLength !== assets.rows * 4 + assets.rows * assets.dimensions)
    throw new Error("WIKI_SEMANTIC_TABLE_SIZE_MISMATCH");
  if (typeof tokenizerJson !== "object" || tokenizerJson === null)
    throw new Error("WIKI_SEMANTIC_TOKENIZER_INVALID");
  const tokenizer = new Tokenizer(tokenizerJson, {});
  const scales = new Float32Array(table.slice(0, assets.rows * 4));
  const values = new Int8Array(table, assets.rows * 4);
  return (text: string) => {
    const vector = new Float32Array(assets.dimensions);
    const normalized = text.replace(/[\t\n\r\f\v\u00a0\u2028\u2029]/g, " ");
    for (const id of tokenizer.encode(normalized, { add_special_tokens: false }).ids) {
      if (id < 0 || id >= assets.rows) continue;
      const scale = scales[id] ?? 0;
      for (let column = 0; column < assets.dimensions; column++)
        vector[column] =
          (vector[column] ?? 0) + (values[id * assets.dimensions + column] ?? 0) * scale;
    }
    let length = 0;
    for (const value of vector) length += value * value;
    length = Math.sqrt(length);
    if (length > 0)
      for (let column = 0; column < vector.length; column++)
        vector[column] = (vector[column] ?? 0) / length;
    return vector;
  };
}

export function createSemanticIndex(
  assets: SemanticAssets,
  loadDocuments: () => Promise<SemanticDocument[]>,
) {
  let ready:
    | Promise<{
        documents: SemanticDocument[];
        vectors: Float32Array[];
        encode: (text: string) => Float32Array;
      }>
    | undefined;
  const load = async (fetcher: AssetFetcher, origin: string) => {
    const read = async (pathname: string) => {
      const response = await fetcher.fetch(new Request(new URL(pathname, origin)));
      if (!response.ok) throw new Error(`WIKI_SEMANTIC_ASSET_UNAVAILABLE: ${response.status}`);
      return response;
    };
    const [tokenizerJson, table, documents] = await Promise.all([
      read(assets.tokenizer).then((response) => response.json()),
      read(assets.model).then((response) => response.arrayBuffer()),
      loadDocuments(),
    ]);
    const encode = createEncoder(tokenizerJson, table, assets);
    return {
      documents,
      vectors: documents.map((document) => encode(`${document.title} ${document.text}`)),
      encode,
    };
  };
  return async (fetcher: AssetFetcher, origin: string, query: string, limit: number) => {
    ready ??= load(fetcher, origin).catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    const { documents, vectors, encode } = await ready;
    const target = encode(query);
    return documents
      .map((document, index) => {
        let score = 0;
        const vector = vectors[index];
        if (vector)
          for (let column = 0; column < target.length; column++)
            score += (vector[column] ?? 0) * (target[column] ?? 0);
        return { document, score };
      })
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  };
}
