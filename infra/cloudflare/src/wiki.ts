import { Effect } from "effect";
import { deployApplication } from "./app.ts";

const { origin, workerName } = await Effect.runPromise(deployApplication("wiki"));

export { origin, workerName };
