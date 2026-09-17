import { Effect } from "effect";
import { deployApplication } from "./app.ts";

const { origin, workerName } = await Effect.runPromise(deployApplication("admin"));

export { origin, workerName };
