import { httpStatus, wikiBasePath, wikiServerFnBase } from "@repo/config";
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

const apiPrefixes = ["/api/", "/_serverFn/", `${wikiBasePath}/api/`, `${wikiServerFnBase}/`];

function denied(path: string, signedIn: boolean): Response {
  if (apiPrefixes.some((prefix) => path.startsWith(prefix))) {
    return jsonResponse({ error: "ログインしてください。" }, httpStatus.unauthorized);
  }
  return new Response(undefined, {
    headers: { "cache-control": "no-store", location: signedIn ? "/security" : "/login" },
    status: httpStatus.found,
  });
}

function decideAccess(
  path: string,
  current: Option.Option<{ readonly strong: boolean }>,
): Option.Option<Response> {
  const allowed = Option.isSome(current) && (current.value.strong || path === "/security");
  return allowed ? Option.none() : Option.some(denied(path, Option.isSome(current)));
}

export { decideAccess, denied, sessionPresence };
export type { SessionDenial };
