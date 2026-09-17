import { deployApplication } from "./app.ts";

const { accessAudience, origin, workerName } = await deployApplication("admin");

export { accessAudience, origin, workerName };
