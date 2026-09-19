// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

const composeFile = fileURLToPath(new URL("../compose.yaml", import.meta.url));
const imagePattern = /^\s+image:\s*(?<image>grafana\/otel-lgtm:\S+)\s*$/mu;

const receiverImage = Effect.fn("receiverImage")(function* receiverImage() {
  const contents = yield* Effect.tryPromise({
    catch: () => "compose file unreadable" as const,
    try: async () => readFile(composeFile, "utf-8"),
  });
  const found = imagePattern.exec(contents)?.groups?.["image"];
  if (found === undefined) {
    return yield* Effect.fail("compose names no receiver" as const);
  }
  return found;
});

export { receiverImage };
