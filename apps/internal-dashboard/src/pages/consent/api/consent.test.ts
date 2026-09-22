import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { clientNameOptions } from "./consent.ts";

describe("oauth client name queries", () => {
  it("keeps each client name on its own key", () => {
    expect.hasAssertions();
    const client = new QueryClient();
    const ada = clientNameOptions("ada");
    const bob = clientNameOptions("bob");
    client.setQueryData(ada.queryKey, "Ada");
    client.setQueryData(bob.queryKey, "Bob");
    return client.invalidateQueries({ queryKey: ada.queryKey }).then(() => {
      expect(client.getQueryState(ada.queryKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(bob.queryKey)?.isInvalidated).toBe(false);
      expect(client.getQueryData(bob.queryKey)).toBe("Bob");
    });
  });
});
