import { deployApplication } from "./app.ts";

const result = await deployApplication("user");
export const workerName = result.workerName;
export const origin = result.origin;
