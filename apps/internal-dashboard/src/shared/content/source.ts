import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { loader } from "fumadocs-core/source";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { SourceMapGenerator } from "source-map";

import { processedMarkdown } from "./mermaid-markdown.ts";
import { WIKI_DOCS_BASE_URL } from "./resolve-wiki-doc-href.ts";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    mdxOptions: applyMdxPreset({ SourceMapGenerator, remarkPlugins: [remarkMdxMermaid] }),
    postprocess: { includeProcessedMarkdown: processedMarkdown },
  },
});

const source = loader({
  baseUrl: WIKI_DOCS_BASE_URL,
  source: docs.toFumadocsSource(),
});

export { docs, source };
