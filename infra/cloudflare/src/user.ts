import { deployApplication } from "./app.ts";

const { origin, workerName } = await deployApplication("user");

export { origin, workerName };
