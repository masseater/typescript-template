import { readAi, readConfig } from "@repo/config";
import { Effect } from "effect";

const readWikiConfig = Effect.fn("readWikiConfig")(function* readWikiConfig(input: unknown) {
  const config = yield* readConfig(input);
  return { ...config, AI: yield* readAi(input) };
});

export { readWikiConfig };
