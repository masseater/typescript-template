// oxlint-disable-next-line import/no-nodejs-modules
import { setTimeout as delay } from "node:timers/promises";

const pollInterval = 250;

async function until<Value>(
  attempt: () => Promise<Value | undefined> | (Value | undefined),
  deadline: number,
  reason: string,
): Promise<Value> {
  const found = await attempt();
  if (found !== undefined) {
    return found;
  }
  if (Date.now() >= deadline) {
    throw new Error(reason);
  }
  await delay(pollInterval);
  return until(attempt, deadline, reason);
}

function deadlineIn(milliseconds: number): number {
  return Date.now() + milliseconds;
}

export { deadlineIn, until };
