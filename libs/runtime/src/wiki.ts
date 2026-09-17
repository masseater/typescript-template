import type { Instrumentation, RequestContext } from "@template/observability";
import { array, number, object, parse } from "valibot";
import { createInstrumentation } from "@template/observability";
import { readWikiConfig } from "@template/config";
import { reportSentryError } from "@template/observability/sentry-server";

type Embedder = (texts: readonly string[]) => Promise<number[][]>;
type AiBinding = NonNullable<ReturnType<typeof readWikiConfig>["AI"]>;

interface WikiRuntime {
  readonly config: Pick<ReturnType<typeof readWikiConfig>, "APP_ORIGIN" | "ASSETS" | "sentry">;
  readonly embedder: (correlation: RequestContext) => Embedder | undefined;
  readonly reportError: (correlation: RequestContext, error: unknown) => void;
  readonly telemetry: Instrumentation;
}

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const embeddingVector = array(number());
const embeddingOutput = object({ data: array(embeddingVector) });

interface EmbeddingSource {
  readonly ai: AiBinding;
  readonly correlation: RequestContext;
  readonly telemetry: Instrumentation;
}

async function embedBatches(
  source: EmbeddingSource,
  texts: readonly string[],
): Promise<number[][]> {
  const text = texts.slice(0, embeddingBatch);
  if (text.length === 0) {
    return [];
  }
  const output = await source.telemetry.withExternalSpan(source.correlation, "ai", async () =>
    source.ai.run(embeddingModel, { text }),
  );
  const { data } = parse(embeddingOutput, output);
  if (data.length !== text.length) {
    throw new Error("WIKI_EMBEDDING_COUNT_MISMATCH");
  }
  const rest = await embedBatches(source, texts.slice(embeddingBatch));
  return [...data, ...rest];
}

function createWikiRuntime(
  bindings: unknown,
  routes: Readonly<Record<string, string>>,
): WikiRuntime {
  const config = readWikiConfig(bindings);
  const telemetry = createInstrumentation({
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: config.otelHeaders,
    routes,
    serviceName: "wiki",
  });
  const ai = config.AI;
  return {
    config: { APP_ORIGIN: config.APP_ORIGIN, ASSETS: config.ASSETS, sentry: config.sentry },
    embedder: (correlation) =>
      ai === undefined
        ? undefined
        : async (texts) => embedBatches({ ai, correlation, telemetry }, texts),
    reportError(correlation, error) {
      telemetry.reportError(correlation, error);
      if (config.sentry) {
        reportSentryError(error);
      }
    },
    telemetry,
  };
}

export { createWikiRuntime };
