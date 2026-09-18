import { apiDataOrNone } from "@template/runtime/client";
import { SessionView } from "@template/runtime/contracts";

import { userClient } from "#shared/api/index.ts";

import type { Session } from "#entities/session/model/session.ts";

const loadSession = async (): Promise<Session | undefined> => {
  const { api } = await userClient();
  return apiDataOrNone(SessionView, await api.session.get());
};

export { loadSession };
