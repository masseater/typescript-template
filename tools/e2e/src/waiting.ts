import { setTimeout as delay } from "node:timers/promises";

const pollInterval = 250;

const until = async <Value>(polling: {
  readonly attempt: () => Promise<Value | undefined> | (Value | undefined);
  readonly deadline: number;
  readonly reason: string;
}): Promise<Value> => {
  const found = await polling.attempt();
  if (found !== undefined) {
    return found;
  }
  if (Date.now() >= polling.deadline) {
    throw new Error(polling.reason);
  }
  await delay(pollInterval);
  return until(polling);
};

const deadlineIn = (milliseconds: number): number => {
  return Date.now() + milliseconds;
};

export { deadlineIn, until };
