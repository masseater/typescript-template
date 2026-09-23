import { wikiBasePath } from "@repo/config";
import { remarkWikiTerm } from "@repo/wiki-markdown";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { loader } from "fumadocs-core/source";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { SourceMapGenerator } from "source-map";

import { processedMarkdown } from "./mermaid-markdown.ts";
import { remarkMermaidSvg } from "./remark-mermaid-svg.ts";

const docs = defineDocs({
  dir: "../internal-dashboard/content/docs",
  docs: {
    mdxOptions: applyMdxPreset({
      SourceMapGenerator,
      remarkPlugins: [remarkMdxMermaid, remarkMermaidSvg, remarkWikiTerm],
    }),
    postprocess: { includeProcessedMarkdown: processedMarkdown },
  },
});

const source = loader({
  baseUrl: wikiBasePath,
  source: docs.toFumadocsSource(),
});

export { docs, source };
