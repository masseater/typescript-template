import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { remarkMermaidSource } from "./mermaid-markdown.ts";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    mdxOptions: applyMdxPreset({ remarkPlugins: [remarkMdxMermaid, remarkMermaidSource] }),
    postprocess: { includeProcessedMarkdown: true },
  },
});

const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

export { docs, source };
