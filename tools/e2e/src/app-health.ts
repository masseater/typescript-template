// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

const requestTimeout = 120_000;
const okStatus = 200;
const logTailLength = 10_000;
const healthPath = "/api/health";

async function healthy(origin: string): Promise<boolean> {
  try {
    const response = await fetch(new URL(healthPath, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeout),
    });
    await response.body?.cancel();
    return response.status === okStatus;
  } catch {
    return false;
  }
}

async function logTail(file: string): Promise<string> {
  try {
    const content = await readFile(file, "utf-8");
    return content.slice(-logTailLength);
  } catch {
    return "";
  }
}

export { healthy, logTail };
