import { webCrypto } from "@repo/config";
import { Effect } from "effect";

const freshId = webCrypto.randomUUIDv4.pipe(Effect.orDie);

export { freshId };
