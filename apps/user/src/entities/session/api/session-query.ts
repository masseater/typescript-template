import type { Session } from "#entities/session/model/session.ts";
import { SessionView } from "@template/runtime/contracts";
import { apiDataOrNone } from "@template/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { userClient } from "#shared/api/index.ts";

async function loadSession(): Promise<{ readonly session: Session | undefined }> {
  const { api } = await userClient();
  return { session: apiDataOrNone(SessionView, await api.session.get()) };
}

const sessionOptions = queryOptions({ queryFn: loadSession, queryKey: ["session"] });

export { sessionOptions };
