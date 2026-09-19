import { readFile } from "node:fs/promises";

const healthPath = "/api/health";

const requestTimeout = 120_000;

const okStatus = 200;

const servingHealth = "serving";

const healthReport = async (origin: string): Promise<string> => {
  try {
    const probe = await fetch(new URL(healthPath, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(requestTimeout),
    });
    await probe.body?.cancel();
    return probe.status === okStatus ? servingHealth : `E2E_HEALTH_STATUS ${probe.status}`;
  } catch (unreachable) {
    return `E2E_HEALTH_UNREACHABLE ${String(unreachable)}`;
  }
};

const logTailLength = 10_000;

const logTail = async (file: string): Promise<string> => {
  try {
    const recorded = await readFile(file, "utf-8");
    return recorded.slice(-logTailLength);
  } catch (unreadable) {
    return `E2E_LOG_UNREADABLE ${String(unreadable)}`;
  }
};

export { healthReport, logTail, servingHealth };
