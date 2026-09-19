import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { loader } from "fumadocs-core/source";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { SourceMapGenerator } from "source-map";

import { processedMarkdown } from "./mermaid-markdown.ts";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    mdxOptions: applyMdxPreset({ SourceMapGenerator, remarkPlugins: [remarkMdxMermaid] }),
    postprocess: { includeProcessedMarkdown: processedMarkdown },
  },
});

const source = loader({
  baseUrl: "/wiki",
  source: docs.toFumadocsSource(),
});

export { docs, source };
