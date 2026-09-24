import { Effect, Encoding } from "effect";

const docsDirectory = "../../../content/docs/";

const bundledSources = import.meta.glob<string>("../../../content/docs/**/*.md", {
  import: "default",
  query: "?raw",
});

const sourceLoaders: ReadonlyMap<string, () => Promise<string>> = new Map(
  Object.entries(bundledSources).map(([file, load]) => [file.slice(docsDirectory.length), load]),
);

function readWikiSource(path: string): Effect.Effect<string | undefined> {
  const load = sourceLoaders.get(path) ?? (() => Promise.resolve(undefined));
  return Effect.promise(load);
}

function gitBlobRevision(markdown: string): Effect.Effect<string> {
  const content = new TextEncoder().encode(markdown);
  const header = new TextEncoder().encode(`blob ${content.byteLength}\0`);
  const blob = new Uint8Array(header.byteLength + content.byteLength);
  blob.set(header);
  blob.set(content, header.byteLength);
  return Effect.promise(() => crypto.subtle.digest("SHA-1", blob)).pipe(
    Effect.map((digest) => Encoding.encodeHex(new Uint8Array(digest))),
  );
}

export { gitBlobRevision, readWikiSource };
