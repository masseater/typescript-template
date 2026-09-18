import type { Session } from "#entities/session/model/session.ts";
import { SessionView } from "@repo/runtime/contracts";
import { apiDataOrNone } from "@repo/runtime/client";
import { userClient } from "#shared/api/index.ts";

async function loadSession(): Promise<Session | undefined> {
  const { api } = await userClient();
  return apiDataOrNone(SessionView, await api.session.get());
}

export { loadSession };
