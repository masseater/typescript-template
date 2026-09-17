import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import type { Plugin } from "vite-plus";

const repository = "hotchpotch/static-embedding-japanese";
const revision = "95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3";
const sources = {
  model: {
    path: "0_StaticEmbedding/model.safetensors",
    sha256: "f0c60b3d2952fb89e67a063ac4aa558ff4b02facaac5fd674d637b9e2c52ccca",
  },
  tokenizer: {
    path: "0_StaticEmbedding/tokenizer.json",
    sha256: "833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9",
  },
} as const;
const semanticDimensions = 256;
const virtualId = "virtual:wiki-semantic-assets";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function cachedSource(cache: string, source: (typeof sources)[keyof typeof sources]) {
  const file = path.join(cache, revision, source.path);
  const existing = await readFile(file).catch(() => undefined);
  if (existing && sha256(existing) === source.sha256) return existing;
  const response = await fetch(
    `https://huggingface.co/${repository}/resolve/${revision}/${source.path}`,
    { signal: AbortSignal.timeout(300_000) },
  );
  if (!response.ok) throw new Error(`WIKI_MODEL_DOWNLOAD_FAILED: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== source.sha256) throw new Error("WIKI_MODEL_CHECKSUM_MISMATCH");
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(`${file}.partial`, bytes, { mode: 0o600 });
  await rename(`${file}.partial`, file);
  return bytes;
}

function quantizeEmbeddings(safetensors: Uint8Array, dimensions: number) {
  const view = new DataView(safetensors.buffer, safetensors.byteOffset, safetensors.byteLength);
  const headerLength = Number(view.getBigUint64(0, true));
  const header = v.parse(
    v.object({
      "embedding.weight": v.object({
        dtype: v.literal("F32"),
        shape: v.tuple([v.number(), v.number()]),
        data_offsets: v.tuple([v.number(), v.number()]),
      }),
    }),
    JSON.parse(new TextDecoder().decode(safetensors.subarray(8, 8 + headerLength))),
  );
  const tensor = header["embedding.weight"];
  const [rows, columns] = tensor.shape;
  const [start] = tensor.data_offsets;
  if (columns < dimensions) throw new Error("WIKI_MODEL_TENSOR_INVALID");
  const offset = 8 + headerLength + start;
  const output = new Uint8Array(rows * 4 + rows * dimensions);
  const scales = new DataView(output.buffer);
  const values = new Int8Array(output.buffer, rows * 4);
  for (let row = 0; row < rows; row++) {
    let maximum = 0;
    for (let column = 0; column < dimensions; column++)
      maximum = Math.max(
        maximum,
        Math.abs(view.getFloat32(offset + (row * columns + column) * 4, true)),
      );
    const scale = maximum / 127 || 1;
    scales.setFloat32(row * 4, scale, true);
    for (let column = 0; column < dimensions; column++)
      values[row * dimensions + column] = Math.round(
        view.getFloat32(offset + (row * columns + column) * 4, true) / scale,
      );
  }
  return { rows, bytes: output };
}

function browserTokenizer(tokenizer: Uint8Array) {
  const json = v.parse(
    v.looseObject({
      normalizer: v.object({
        type: v.literal("Sequence"),
        normalizers: v.array(v.looseObject({ type: v.string() })),
      }),
    }),
    JSON.parse(new TextDecoder().decode(tokenizer)),
  );
  const normalizers = json.normalizer.normalizers.filter((normalizer) => normalizer.type !== "Nmt");
  return new TextEncoder().encode(
    JSON.stringify({ ...json, normalizer: { ...json.normalizer, normalizers } }),
  );
}

export async function prepareSemanticAssets(root: string, publicDirectory: string) {
  const cache = path.join(root, ".local", "models", repository);
  const [safetensors, tokenizer] = await Promise.all([
    cachedSource(cache, sources.model),
    cachedSource(cache, sources.tokenizer),
  ]);
  const table = quantizeEmbeddings(safetensors, semanticDimensions);
  const tokenizerBytes = browserTokenizer(tokenizer);
  const model = `model-${sha256(table.bytes).slice(0, 16)}.bin`;
  const tokenizerName = `tokenizer-${sha256(tokenizerBytes).slice(0, 16)}.json`;
  await mkdir(publicDirectory, { recursive: true });
  for (const entry of await readdir(publicDirectory))
    if (![model, tokenizerName].includes(entry))
      await rm(path.join(publicDirectory, entry), { force: true });
  await writeFile(path.join(publicDirectory, model), table.bytes);
  await writeFile(path.join(publicDirectory, tokenizerName), tokenizerBytes);
  return {
    model: `/semantic/${model}`,
    tokenizer: `/semantic/${tokenizerName}`,
    rows: table.rows,
    dimensions: semanticDimensions,
  };
}

export function wikiSemanticAssets(): Plugin {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const publicDirectory = fileURLToPath(new URL("public/semantic/", import.meta.url));
  let prepared: ReturnType<typeof prepareSemanticAssets> | undefined;
  return {
    name: "wiki-semantic-assets",
    async buildStart() {
      prepared ??= prepareSemanticAssets(root, publicDirectory);
      await prepared;
    },
    resolveId(id) {
      return id === virtualId ? `\0${virtualId}` : undefined;
    },
    async load(id) {
      if (id !== `\0${virtualId}`) return undefined;
      prepared ??= prepareSemanticAssets(root, publicDirectory);
      return `export default ${JSON.stringify(await prepared)};`;
    },
  };
}
