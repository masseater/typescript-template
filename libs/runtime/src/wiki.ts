import type { Instrumentation, RequestContext } from "@template/observability";
import { array, number, object, parse } from "valibot";
import { createInstrumentation } from "@template/observability";
import { readWikiConfig } from "@template/config";

type Embedder = (texts: readonly string[]) => Promise<number[][]>;
type AiBinding = NonNullable<ReturnType<typeof readWikiConfig>["AI"]>;

interface WikiRuntime {
  readonly config: Pick<ReturnType<typeof readWikiConfig>, "APP_ORIGIN" | "APP_RELEASE" | "ASSETS">;
  readonly embedder: () => Embedder | undefined;
  readonly reportError: (correlation: RequestContext, error: unknown) => void;
  readonly telemetry: Instrumentation;
}

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const embeddingVector = array(number());
const embeddingOutput = object({ data: array(embeddingVector) });

async function embedBatches(ai: AiBinding, texts: readonly string[]): Promise<number[][]> {
  const text = texts.slice(0, embeddingBatch);
  if (text.length === 0) {
    return [];
  }
  const output = await ai.run(embeddingModel, { text });
  const { data } = parse(embeddingOutput, output);
  if (data.length !== text.length) {
    throw new Error("WIKI_EMBEDDING_COUNT_MISMATCH");
  }
  const rest = await embedBatches(ai, texts.slice(embeddingBatch));
  return [...data, ...rest];
}

function createWikiRuntime(
  bindings: unknown,
  routes: Readonly<Record<string, string>>,
): WikiRuntime {
  const config = readWikiConfig(bindings);
  const telemetry = createInstrumentation({
    release: config.APP_RELEASE,
    routes,
    serviceName: "wiki",
  });
  const ai = config.AI;
  return {
    config: {
      APP_ORIGIN: config.APP_ORIGIN,
      APP_RELEASE: config.APP_RELEASE,
      ASSETS: config.ASSETS,
    },
    embedder: () => (ai === undefined ? undefined : async (texts) => embedBatches(ai, texts)),
    reportError(correlation, error) {
      telemetry.reportError(correlation, error);
    },
    telemetry,
  };
}

export { createWikiRuntime };
