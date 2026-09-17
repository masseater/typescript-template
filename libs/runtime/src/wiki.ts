import type { RequestRuntime, Runtime } from "./index.ts";
import { array, number, object, parse } from "valibot";
import type { RequestContext } from "@template/observability";
import { authorizeMcpRequest } from "@template/auth/mcp";
import { buildRuntime } from "./index.ts";
import { readWikiConfig } from "@template/config";

type Embedder = (texts: readonly string[]) => Promise<number[][]>;
type AiBinding = NonNullable<ReturnType<typeof readWikiConfig>["AI"]>;

interface WikiRequestRuntime extends RequestRuntime {
  readonly authorizeMcp: (
    request: Readonly<{ headers: Readonly<Pick<Headers, "get">> }>,
  ) => ReturnType<typeof authorizeMcpRequest>;
  readonly embedder: () => Embedder | undefined;
}

interface WikiRuntime extends Omit<Runtime, "config" | "forRequest"> {
  readonly config: Runtime["config"] & { readonly APP_RELEASE: string };
  readonly forRequest: (correlation: RequestContext) => WikiRequestRuntime;
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
  const runtime = buildRuntime(config, "wiki", routes);
  const ai = config.AI;
  return {
    config: { ...runtime.config, APP_RELEASE: config.APP_RELEASE },
    forRequest: (correlation) => {
      const request = runtime.forRequest(correlation);
      return {
        ...request,
        authorizeMcp: async (incoming) =>
          authorizeMcpRequest({
            auth: request.auth,
            database: request.database,
            origin: config.APP_ORIGIN,
            request: incoming,
          }),
        embedder: () => (ai === undefined ? undefined : async (texts) => embedBatches(ai, texts)),
      };
    },
    telemetry: runtime.telemetry,
  };
}

export { createWikiRuntime };
