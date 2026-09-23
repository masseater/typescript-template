import { verifySession } from "@repo/auth";
import { Effect } from "effect";

import { FlagEditorAccess } from "./flag-editor-access.ts";

const requireFlagEditor = Effect.fn("requireFlagEditor")(function* requireFlagEditor(
  headers: Headers,
) {
  const { session, user } = yield* verifySession(headers);
  const access = yield* FlagEditorAccess;
  yield* access.assertEditor(user);
  return { session, user };
});

export { requireFlagEditor };
