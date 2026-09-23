import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

import type { DurableObjectNamespace } from "@cloudflare/workers-types";

const userInboxBinding = "USER_INBOX";
const userInboxClassName = "UserInbox";
const realtimePath = "/api/realtime";

const localUserInbox = {
  class_name: userInboxClassName,
  name: userInboxBinding,
} as const;

const RealtimeBindings = Schema.Struct({
  [userInboxBinding]: Schema.optionalKey(
    bindingWith<DurableObjectNamespace>("DurableObjectNamespace", ["get", "idFromName"]),
  ),
});

const readRealtime = Effect.fn("readRealtime")(function* readRealtime(input: unknown) {
  const bindings = yield* decode(RealtimeBindings, input);
  return { inbox: bindings[userInboxBinding] };
});

function realtimeSocketUrl(origin: string): string {
  const parsed = new URL(origin);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}${realtimePath}`;
}

export {
  localUserInbox,
  readRealtime,
  realtimePath,
  realtimeSocketUrl,
  userInboxBinding,
  userInboxClassName,
};
