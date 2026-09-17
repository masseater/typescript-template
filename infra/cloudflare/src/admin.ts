import { deployApplication } from "./app.ts";

const result = await deployApplication("admin");
export const workerName = result.workerName;
export const origin = result.origin;
