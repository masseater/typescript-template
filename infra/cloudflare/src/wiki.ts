import { deployApplication } from "./app.ts";

const { origin, workerName } = await deployApplication("wiki");

export { origin, workerName };
