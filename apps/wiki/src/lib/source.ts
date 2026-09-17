import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";

const docs = defineDocs({
  dir: "content/docs",
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

export { docs, source };
