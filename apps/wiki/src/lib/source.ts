import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";
import { processedMarkdown } from "./mermaid-markdown.ts";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";

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
