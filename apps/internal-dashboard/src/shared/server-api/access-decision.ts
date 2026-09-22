import { httpStatus } from "@repo/config";

import { jsonResponse } from "@repo/runtime/http";
import { Option } from "effect";

type SessionDenial =
  | { readonly _tag: "AdminMfaRequired" }
  | { readonly _tag: "AdminRequired" }
  | { readonly _tag: "SessionInvalid" }
  | { readonly _tag: "SessionRequired" };

function sessionPresence(
  outcome: SessionDenial | { readonly strong: boolean },
): Option.Option<{ readonly strong: boolean }> {
  if ("strong" in outcome) {
    return Option.some({ strong: outcome.strong });
  }
  if (outcome._tag === "AdminMfaRequired") {
    return Option.some({ strong: false });
  }
  return Option.none();
}

function denied(path: string, signedIn: boolean): Response {
  if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) {
    return jsonResponse({ error: "ログインしてください。" }, httpStatus.unauthorized);
  }
  return new Response(undefined, {
    headers: { "cache-control": "no-store", location: signedIn ? "/security" : "/login" },
    status: httpStatus.found,
  });
}

export { denied, sessionPresence };
