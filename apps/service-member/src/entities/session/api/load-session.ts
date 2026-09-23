import { SessionView } from "@repo/auth-ui";
import { apiDataOrNone } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";

import type { Session } from "#entities/session/model/session.ts";

function loadSession(): Promise<Session | undefined> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.session.get().then((response) => apiDataOrNone(SessionView, response)),
  );
}

export { loadSession };
