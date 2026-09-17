import { absence, readApi } from "#shared/api/index.ts";
import type { Session } from "#entities/session/model/session.ts";
import { SessionView } from "@template/runtime/contracts";

async function loadSession(): Promise<Session | undefined> {
  return readApi("/api/session", SessionView, absence.unauthorized);
}

export { loadSession };
