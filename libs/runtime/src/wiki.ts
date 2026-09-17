import { readWikiConfig } from "@template/config";
import { createInstrumentation } from "@template/observability";
import type { RequestContext } from "@template/observability";
import * as v from "valibot";

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const embeddingOutput = v.object({ data: v.array(v.array(v.number())) });

export function createWikiRuntime(bindings: unknown, routes: Readonly<Record<string, string>>) {
  const config = readWikiConfig(bindings);
  const telemetry = createInstrumentation({
    serviceName: "wiki",
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: config.otelHeaders,
    routes,
  });
  const ai = config.AI;
  return {
    config: { ASSETS: config.ASSETS, APP_ORIGIN: config.APP_ORIGIN },
    telemetry,
    reportError(correlation: RequestContext, error: unknown) {
      telemetry.reportError(correlation, error);
    },
    embedder(correlation: RequestContext) {
      if (!ai) return null;
      return async (texts: readonly string[]) => {
        const vectors: number[][] = [];
        for (let start = 0; start < texts.length; start += embeddingBatch) {
          const text = texts.slice(start, start + embeddingBatch);
          const output = await telemetry.withExternalSpan(correlation, "ai", () =>
            ai.run(embeddingModel, { text }),
          );
          const { data } = v.parse(embeddingOutput, output);
          if (data.length !== text.length) throw new Error("WIKI_EMBEDDING_COUNT_MISMATCH");
          vectors.push(...data);
        }
        return vectors;
      };
    },
  };
}
