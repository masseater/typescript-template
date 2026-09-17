import { Effect } from "effect";
import { deployApplication } from "./app.ts";

const result = await Effect.runPromise(deployApplication("user"));
export const workerName = result.workerName;
export const origin = result.origin;
