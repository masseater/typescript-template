import { authorizeMcpRequest } from "@template/auth/mcp";
import { readWikiConfig } from "@template/config";
import type { RequestContext } from "@template/observability";
import * as v from "valibot";
import { buildRuntime } from "./index.ts";

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const embeddingOutput = v.object({ data: v.array(v.array(v.number())) });

export function createWikiRuntime(bindings: unknown, routes: Readonly<Record<string, string>>) {
  const config = readWikiConfig(bindings);
  const runtime = buildRuntime(config, "wiki", routes);
  const ai = config.AI;
  return {
    ...runtime,
    config: { ...runtime.config, APP_RELEASE: config.APP_RELEASE },
    forRequest(correlation: RequestContext) {
      const request = runtime.forRequest(correlation);
      return {
        ...request,
        authorizeMcp: (incoming: Request) =>
          authorizeMcpRequest({
            auth: request.auth,
            database: request.database,
            origin: config.APP_ORIGIN,
            request: incoming,
          }),
        embedder() {
          if (!ai) return null;
          return async (texts: readonly string[]) => {
            const vectors: number[][] = [];
            for (let start = 0; start < texts.length; start += embeddingBatch) {
              const text = texts.slice(start, start + embeddingBatch);
              const output = await ai.run(embeddingModel, { text });
              const { data } = v.parse(embeddingOutput, output);
              if (data.length !== text.length) throw new Error("WIKI_EMBEDDING_COUNT_MISMATCH");
              vectors.push(...data);
            }
            return vectors;
          };
        },
      };
    },
  };
}
