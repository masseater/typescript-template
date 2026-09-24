import { describe, expect, it } from "vite-plus/test";

import { inboxRouteOf } from "./inbox-route.ts";

describe("inboxRouteOf", () => {
  it("routes a websocket upgrade to the socket regardless of path", () => {
    expect.hasAssertions();
    expect(
      inboxRouteOf(
        new Request("https://inbox.internal/anything", { headers: { Upgrade: "websocket" } }),
      ),
    ).toBe("socket");
  });

  it("routes each POST endpoint by its path suffix", () => {
    expect.hasAssertions();
    const post = (path: string): Request =>
      new Request(`https://inbox.internal/${path}`, { body: "{}", method: "POST" });
    expect(inboxRouteOf(post("notifications"))).toBe("notification");
    expect(inboxRouteOf(post("notifications/read"))).toBe("markRead");
    expect(inboxRouteOf(post("posts"))).toBe("feedPost");
  });

  it("serves the snapshot only on GET", () => {
    expect.hasAssertions();
    expect(inboxRouteOf(new Request("https://inbox.internal/snapshot"))).toBe("snapshot");
    expect(
      inboxRouteOf(new Request("https://inbox.internal/snapshot", { body: "{}", method: "POST" })),
    ).toBeUndefined();
  });

  it("leaves unknown paths and methods unrouted", () => {
    expect.hasAssertions();
    expect(inboxRouteOf(new Request("https://inbox.internal/notifications"))).toBeUndefined();
    expect(inboxRouteOf(new Request("https://inbox.internal/unknown"))).toBeUndefined();
  });
});
