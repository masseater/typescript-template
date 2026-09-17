import { deployApplication } from "./app.ts";

const { origin, workerName } = await deployApplication("admin");

export { origin, workerName };
