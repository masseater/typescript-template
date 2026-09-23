import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  localUserInbox,
  readRealtime,
  realtimeSocketUrl,
  userInboxBinding,
  userInboxClassName,
} from "./realtime.ts";

describe.for([
  ["https://app.example.test", "wss://app.example.test/api/realtime"],
  ["http://localhost:3001", "ws://localhost:3001/api/realtime"],
] as const)("the realtime socket URL for %s", ([origin, socketUrl]) => {
  const it = test.extend("builtSocketUrl", () => realtimeSocketUrl(origin));

  it("follows the application origin onto the realtime path", ({ builtSocketUrl }) => {
    expect(builtSocketUrl).toBe(socketUrl);
  });
});

describe("a worker env without an inbox binding", () => {
  const it = test.extend("realtimeBindings", () => Effect.runPromise(readRealtime({})));

  it("reads no inbox", ({ realtimeBindings }) => {
    expect(realtimeBindings).toStrictEqual({ inbox: undefined });
  });
});

describe("the local user inbox", () => {
  const it = test.extend("userInbox", () => localUserInbox);

  it("binds the user inbox class", ({ userInbox }) => {
    expect(userInbox).toStrictEqual({ class_name: userInboxClassName, name: userInboxBinding });
  });
});
