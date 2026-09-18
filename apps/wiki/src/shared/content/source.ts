import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { loader } from "fumadocs-core/source";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";

import { processedMarkdown } from "./mermaid-markdown.ts";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    mdxOptions: applyMdxPreset({ remarkPlugins: [remarkMdxMermaid] }),
    postprocess: { includeProcessedMarkdown: processedMarkdown },
  },
});

const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

export { docs, source };
