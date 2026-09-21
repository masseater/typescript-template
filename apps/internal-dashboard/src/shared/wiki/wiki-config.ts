import { readAi, readConfig } from "@repo/config";
import { Effect } from "effect";

const readWikiConfig = Effect.fn("readWikiConfig")(function* readWikiConfig(input: unknown) {
  const config = yield* readConfig(input);
  return { ...config, AI: yield* readAi(input) };
});

type WikiConfig = Effect.Success<ReturnType<typeof readWikiConfig>>;

export { readWikiConfig };
export type { WikiConfig };
