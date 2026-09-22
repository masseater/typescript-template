import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { userListKey, userListOptions } from "./list-users.ts";

import type { ListedUsers } from "./load-users.ts";

describe("admin user list queries", () => {
  it("invalidates every search when a row changes the list", () => {
    expect.hasAssertions();
    const client = new QueryClient();
    const unread = (): Promise<ListedUsers> => {
      throw new Error("ユーザー一覧の取得はこのテストの対象外です。");
    };
    const first = userListOptions({ offset: "0" }, unread);
    const second = userListOptions({ keyword: "ada", offset: "0" }, unread);
    const empty: ListedUsers = { total: 0, users: [] };
    client.setQueryData(first.queryKey, empty);
    client.setQueryData(second.queryKey, empty);
    return client.invalidateQueries({ queryKey: userListKey }).then(() => {
      expect(client.getQueryState(first.queryKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(second.queryKey)?.isInvalidated).toBe(true);
    });
  });
});
