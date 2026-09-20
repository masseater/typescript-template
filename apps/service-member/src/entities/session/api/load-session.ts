import { apiDataOrNone } from "@repo/runtime/client";
import { SessionView } from "@repo/ui";

import { userClient } from "#shared/api/index.ts";

import type { Session } from "#entities/session/model/session.ts";

async function loadSession(): Promise<Session | undefined> {
  const { api } = await userClient();
  return apiDataOrNone(SessionView, await api.session.get());
}

export { loadSession };
