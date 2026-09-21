import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { userListKey, userListOptions } from "./list-users.ts";

describe("admin user list queries", () => {
  it("invalidates every search when a row changes the list", async () => {
    expect.hasAssertions();
    const client = new QueryClient();
    const first = userListOptions({ offset: "0" });
    const second = userListOptions({ keyword: "ada", offset: "0" });
    const empty = { total: 0, users: [] };
    client.setQueryData(first.queryKey, empty);
    client.setQueryData(second.queryKey, empty);
    await client.invalidateQueries({ queryKey: userListKey });
    expect(client.getQueryState(first.queryKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(second.queryKey)?.isInvalidated).toBe(true);
  });
});
