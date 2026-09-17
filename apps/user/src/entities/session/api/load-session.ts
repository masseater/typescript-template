import type { Session } from "#entities/session/model/session.ts";
import { SessionView } from "@template/runtime/contracts";
import { readApi } from "#shared/api/index.ts";

const unauthorized = 401;

async function loadSession(): Promise<Session | undefined> {
  return readApi("/api/session", SessionView, unauthorized);
}

export { loadSession };
